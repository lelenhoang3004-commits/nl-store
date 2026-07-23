import { VoucherRepository } from "../repositories/voucher.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { NotificationService } from "./notification.service.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { withTransaction } from "../utils/database.util.js";

const VOUCHER_STATUS = Object.freeze({ ACTIVE: "active", INACTIVE: "inactive" });
const DISCOUNT_TYPE = Object.freeze({ PERCENTAGE: "percentage", FIXED_AMOUNT: "fixed_amount" });
const VOUCHER_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "code", "name", "discountType", "quantity", "usedQuantity", "startsAt", "expiresAt", "status"],
  allowedFilterFields: ["status"]
});

export class VoucherService extends BaseService {
  constructor(repository = new VoucherRepository(), notificationService = new NotificationService()) {
    super(repository);
    this.notificationService = notificationService;
  }

  async getVouchers(query) {
    const options = parseQueryOptions(query, VOUCHER_QUERY_OPTIONS);
    const [vouchers, totalItems] = await Promise.all([this.repository.findAll(options), this.repository.countAll(options)]);
    return {
      vouchers: vouchers.map((voucher) => voucher.toJSON()),
      meta: { pagination: createPaginationMeta(options.pagination, totalItems), search: options.search, sort: options.sort, filter: options.filter }
    };
  }

  async getVoucherById(id) {
    const voucher = await this.repository.findById(id);
    if (!voucher) throw new AppError("Không tìm thấy mã giảm giá.", 404, "VOUCHER_NOT_FOUND");
    return voucher.toJSON();
  }

  async createVoucher(payload) {
    const normalizedPayload = this.normalizePayload(payload, null, { creating: true });
    const voucher = await withTransaction(async (connection) => {
      await this.ensureUniqueCode(normalizedPayload.code, null, connection);
      return this.repository.create(normalizedPayload, connection);
    });
    const result = voucher.toJSON();

    if (shouldNotifyCustomers(result)) {
      await this.notificationService.notifyAllCustomers({
        type: "NEW_VOUCHER",
        title: "Mã giảm giá mới",
        message: `Mã ${result.code} đã sẵn sàng sử dụng.`,
        link: "#vouchers",
        relatedId: result.id,
        expiresAt: result.expiresAt || null,
        eventKey: `new-voucher:${result.id}`
      });
    }

    return result;
  }

  async updateVoucher(id, payload) {
    const currentVoucher = await this.getVoucherById(id);
    const normalizedPayload = this.normalizePayload(payload, currentVoucher, { creating: false });
    await this.ensureCodeCanChange(currentVoucher, normalizedPayload.code);
    await this.ensureUniqueCode(normalizedPayload.code, id);
    const voucher = await this.repository.update(id, normalizedPayload);
    return voucher.toJSON();
  }

  async updateVoucherStatus(id, status) {
    await this.getVoucherById(id);
    const normalizedStatus = normalizeStatus(status);
    const voucher = await this.repository.updateStatus(id, normalizedStatus);
    return voucher.toJSON();
  }

  async deleteVoucher(id) {
    const currentVoucher = await this.getVoucherById(id);
    if (Number(currentVoucher.usedQuantity || 0) > 0) {
      const voucher = await this.repository.updateStatus(id, VOUCHER_STATUS.INACTIVE);
      return { id, deleted: false, deactivated: true, voucher: voucher.toJSON() };
    }
    const deleted = await this.repository.deleteUnused(id);
    if (!deleted) throw new AppError("Không thể xóa mã giảm giá đã được sử dụng.", 409, "VOUCHER_DELETE_FAILED");
    return { id, deleted: true };
  }

  async validateVoucher(payload, options = {}) {
    const code = normalizeCode(payload.code);
    const orderTotal = normalizeMoney(payload.orderTotal, "orderTotal", { required: true });
    if (!code) throw new AppError("Vui lòng nhập mã giảm giá.", 422, "VOUCHER_CODE_REQUIRED");

    const voucher = await this.repository.findByCode(code, null, options.connection || null, Boolean(options.forUpdate));
    if (!voucher) throw new AppError("Không tìm thấy mã giảm giá.", 404, "VOUCHER_NOT_FOUND");

    return this.validateVoucherRules(voucher.toJSON(), orderTotal, payload);
  }

  async markVoucherUsed(code, connection = null) {
    if (!code) return;
    const voucher = await this.repository.findByCode(code, null, connection, true);
    if (!voucher) return;
    const incremented = await this.repository.incrementUsedCount(voucher.id, connection);
    if (!incremented) throw new AppError("Mã giảm giá đã hết lượt sử dụng.", 409, "VOUCHER_USAGE_LIMIT_EXCEEDED");
  }

  validateVoucherRules(voucher, orderTotal, payload = {}) {
    if (voucher.status !== VOUCHER_STATUS.ACTIVE) throw new AppError("Mã giảm giá đang tạm khóa.", 409, "VOUCHER_NOT_ACTIVE");
    const now = new Date();
    if (voucher.startsAt && new Date(voucher.startsAt) > now) throw new AppError("Mã giảm giá chưa bắt đầu.", 409, "VOUCHER_NOT_STARTED");
    if (voucher.expiresAt && new Date(voucher.expiresAt) < now) throw new AppError("Mã giảm giá đã hết hạn.", 409, "VOUCHER_EXPIRED");
    if (voucher.quantity !== null && Number(voucher.usedQuantity || 0) >= Number(voucher.quantity)) throw new AppError("Mã giảm giá đã hết lượt sử dụng.", 409, "VOUCHER_USAGE_LIMIT_EXCEEDED");
    if (orderTotal < Number(voucher.minOrderAmount || 0)) throw new AppError("Đơn hàng chưa đạt giá trị tối thiểu của mã giảm giá.", 409, "VOUCHER_MIN_ORDER_NOT_MET");
    if (!conditionsMatch(voucher.conditions, payload)) throw new AppError("Mã giảm giá không áp dụng cho đơn hàng này.", 409, "VOUCHER_CONDITIONS_NOT_MET");

    let discountAmount = voucher.discountType === DISCOUNT_TYPE.PERCENTAGE
      ? Math.floor(orderTotal * Number(voucher.discountValue || 0) / 100)
      : Number(voucher.discountValue || 0);

    if (voucher.discountType === DISCOUNT_TYPE.PERCENTAGE && voucher.maxDiscountAmount !== null && voucher.maxDiscountAmount !== undefined) {
      discountAmount = Math.min(discountAmount, Number(voucher.maxDiscountAmount));
    }
    discountAmount = Math.max(Math.min(Math.round(discountAmount), orderTotal), 0);

    return { valid: true, voucher, code: voucher.code, discountAmount, finalTotal: Math.max(orderTotal - discountAmount, 0) };
  }

  normalizePayload(payload, currentVoucher = null, options = {}) {
    const creating = Boolean(options.creating);
    const discountType = normalizeDiscountType(readValue(payload, currentVoucher, "discountType", "discount_type"));
    const discountValue = normalizeMoney(readValue(payload, currentVoucher, "discountValue", "discount_value"), "discountValue", { required: true });
    const minOrderAmount = normalizeMoney(readValue(payload, currentVoucher, "minOrderAmount", "min_order_amount") ?? 0, "minOrderAmount");
    const maxDiscountAmount = discountType === DISCOUNT_TYPE.PERCENTAGE
      ? normalizeNullableMoney(readValue(payload, currentVoucher, "maxDiscountAmount", "max_discount_amount"), "maxDiscountAmount")
      : null;
    const quantity = normalizeInteger(readValue(payload, currentVoucher, "quantity", "usageLimit", "usage_limit"), "quantity", { min: 1, required: true });
    const usedQuantity = creating
      ? 0
      : normalizeInteger(readValue(payload, currentVoucher, "usedQuantity", "used_quantity", "usedCount", "used_count") ?? 0, "usedQuantity", { min: 0, required: true });
    const startsAt = normalizeNullableDate(readValue(payload, currentVoucher, "startsAt", "starts_at", "startDate", "start_date"), "startsAt");
    const expiresAt = normalizeNullableDate(readValue(payload, currentVoucher, "expiresAt", "expires_at", "endDate", "end_date"), "expiresAt");
    const status = normalizeStatus(readValue(payload, currentVoucher, "status") ?? VOUCHER_STATUS.ACTIVE);
    const code = normalizeCode(readValue(payload, currentVoucher, "code"));
    const name = String(readValue(payload, currentVoucher, "name") || "").trim();

    if (!code) throw new AppError("Vui lòng nhập mã giảm giá.", 422, "VOUCHER_CODE_REQUIRED");
    if (!name) throw new AppError("Vui lòng nhập tên chương trình.", 422, "VOUCHER_NAME_REQUIRED");
    ensureDiscountIsValid(discountType, discountValue);
    if (quantity < usedQuantity) throw new AppError("Tổng lượt sử dụng không được nhỏ hơn số lượt đã dùng.", 422, "VOUCHER_QUANTITY_LESS_THAN_USED");
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) throw new AppError("Ngày kết thúc phải sau ngày bắt đầu.", 422, "VOUCHER_DATE_RANGE_INVALID");

    return {
      code,
      name,
      description: payload.description !== undefined ? String(payload.description || "").trim() : currentVoucher?.description || null,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      quantity,
      usedQuantity,
      startsAt,
      expiresAt,
      status,
      conditions: normalizeConditions(payload.conditions ?? currentVoucher?.conditions)
    };
  }

  async ensureUniqueCode(code, excludedId = null, connection = null) {
    const duplicatedVoucher = await this.repository.findByCode(code, excludedId, connection);
    if (duplicatedVoucher) throw new AppError("Mã giảm giá đã tồn tại.", 409, "VOUCHER_CODE_EXISTS");
  }

  async ensureCodeCanChange(currentVoucher, nextCode) {
    if (String(currentVoucher.code || "") !== String(nextCode || "") && Number(currentVoucher.usedQuantity || 0) > 0) {
      throw new AppError("Không thể đổi mã của voucher đã được sử dụng.", 409, "VOUCHER_CODE_CHANGE_DENIED");
    }
  }
}

function readValue(payload = {}, current = null, ...keys) {
  for (const key of keys) {
    if (payload[key] !== undefined) return payload[key];
  }
  if (!current) return undefined;
  for (const key of keys) {
    if (current[key] !== undefined) return current[key];
  }
  return undefined;
}

function normalizeDiscountType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "fixed" || normalized === "amount") return DISCOUNT_TYPE.FIXED_AMOUNT;
  return normalized;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!Object.values(VOUCHER_STATUS).includes(normalized)) throw new AppError("Trạng thái mã giảm giá không hợp lệ.", 422, "INVALID_VOUCHER_STATUS");
  return normalized;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeMoney(value, field, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.required) throw new AppError(`${field} is required.`, 422, "VOUCHER_MONEY_REQUIRED");
    return 0;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || !Number.isInteger(number)) {
    throw new AppError(`${field} must be a non-negative integer VND amount.`, 422, "INVALID_VOUCHER_MONEY");
  }
  return number;
}

function normalizeNullableMoney(value, field) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeMoney(value, field);
}

function normalizeInteger(value, field, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.required) throw new AppError(`${field} is required.`, 422, "VOUCHER_INTEGER_REQUIRED");
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < options.min) {
    throw new AppError(`${field} must be an integer greater than or equal to ${options.min}.`, 422, "INVALID_VOUCHER_INTEGER");
  }
  return number;
}

function normalizeNullableDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} must be a valid date.`, 422, "INVALID_VOUCHER_DATE");
  return value;
}

function normalizeConditions(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed === null ? null : JSON.stringify(parsed);
    } catch {
      throw new AppError("Điều kiện áp dụng phải là JSON hợp lệ hoặc để trống.", 422, "INVALID_VOUCHER_CONDITIONS");
    }
  }
  return JSON.stringify(value);
}

function ensureDiscountIsValid(discountType, discountValue) {
  if (!Object.values(DISCOUNT_TYPE).includes(discountType)) throw new AppError("Loại giảm giá không hợp lệ.", 422, "INVALID_DISCOUNT_TYPE");
  if (discountValue <= 0) throw new AppError("Giá trị giảm phải lớn hơn 0.", 422, "INVALID_DISCOUNT_VALUE");
  if (discountType === DISCOUNT_TYPE.PERCENTAGE && discountValue > 100) throw new AppError("Phần trăm giảm phải từ 1 đến 100.", 422, "VOUCHER_PERCENT_TOO_HIGH");
}

function conditionsMatch(conditions) {
  if (!conditions) return true;
  let parsed = conditions;
  if (typeof conditions === "string") {
    try { parsed = JSON.parse(conditions); } catch { return false; }
  }
  if (!parsed || parsed.scope === "all") return true;
  return true;
}

function shouldNotifyCustomers(voucher) {
  if (voucher.status !== VOUCHER_STATUS.ACTIVE) return false;
  const now = Date.now();
  if (voucher.startsAt && new Date(voucher.startsAt).getTime() > now) return false;
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < now) return false;
  return true;
}

export { DISCOUNT_TYPE, VOUCHER_STATUS };
