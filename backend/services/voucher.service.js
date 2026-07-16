import { VoucherRepository } from "../repositories/voucher.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";

const VOUCHER_STATUS = Object.freeze({ ACTIVE: "active", INACTIVE: "inactive", EXPIRED: "expired" });
const DISCOUNT_TYPE = Object.freeze({ PERCENTAGE: "percentage", FIXED: "fixed" });
const VOUCHER_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "code", "name", "discountType", "quantity", "usedQuantity", "startsAt", "expiresAt", "status"],
  allowedFilterFields: ["status"]
});

export class VoucherService extends BaseService {
  constructor(repository = new VoucherRepository()) { super(repository); }

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
    if (!voucher) throw new AppError("Voucher was not found.", 404, "VOUCHER_NOT_FOUND");
    return voucher.toJSON();
  }

  async createVoucher(payload) {
    const normalizedPayload = this.normalizePayload(payload);
    await this.ensureUniqueCode(normalizedPayload.code);
    const voucher = await this.repository.create(normalizedPayload);
    return voucher.toJSON();
  }

  async updateVoucher(id, payload) {
    const currentVoucher = await this.getVoucherById(id);
    const normalizedPayload = this.normalizePayload(payload, currentVoucher);
    await this.ensureUniqueCode(normalizedPayload.code, id);
    const voucher = await this.repository.update(id, normalizedPayload);
    return voucher.toJSON();
  }

  async updateVoucherStatus(id, status) {
    await this.getVoucherById(id);
    const normalizedStatus = String(status || "").trim().toLowerCase();
    if (!Object.values(VOUCHER_STATUS).includes(normalizedStatus)) throw new AppError("Voucher status is invalid.", 422, "INVALID_VOUCHER_STATUS");
    const voucher = await this.repository.updateStatus(id, normalizedStatus);
    return voucher.toJSON();
  }

  async deleteVoucher(id) {
    await this.getVoucherById(id);
    const deleted = await this.repository.softDelete(id);
    if (!deleted) throw new AppError("Voucher could not be deleted.", 409, "VOUCHER_DELETE_FAILED");
    return { id, deleted: true };
  }

  async validateVoucher(payload, options = {}) {
    const code = String(payload.code || "").trim().toUpperCase();
    const orderTotal = Number(payload.orderTotal || 0);
    if (!code) throw new AppError("Voucher code is required.", 422, "VOUCHER_CODE_REQUIRED");
    if (orderTotal < 0) throw new AppError("Order total is invalid.", 422, "INVALID_ORDER_TOTAL");

    const voucher = await this.repository.findByCode(code, null, options.connection || null, Boolean(options.forUpdate));
    if (!voucher) throw new AppError("Voucher was not found.", 404, "VOUCHER_NOT_FOUND");

    return this.validateVoucherRules(voucher.toJSON(), orderTotal);
  }

  async markVoucherUsed(code, connection = null) {
    if (!code) return;
    const voucher = await this.repository.findByCode(code, null, connection, true);
    if (voucher) await this.repository.incrementUsedCount(voucher.id, connection);
  }

  validateVoucherRules(voucher, orderTotal) {
    if (voucher.status !== VOUCHER_STATUS.ACTIVE) throw new AppError("Voucher is not active.", 409, "VOUCHER_NOT_ACTIVE");
    const now = new Date();
    if (voucher.startsAt && new Date(voucher.startsAt) > now) throw new AppError("Voucher has not started.", 409, "VOUCHER_NOT_STARTED");
    if (voucher.expiresAt && new Date(voucher.expiresAt) < now) throw new AppError("Voucher has expired.", 409, "VOUCHER_EXPIRED");
    if (voucher.quantity !== null && Number(voucher.usedQuantity || 0) >= Number(voucher.quantity)) throw new AppError("Voucher usage limit exceeded.", 409, "VOUCHER_USAGE_LIMIT_EXCEEDED");
    if (orderTotal < Number(voucher.minOrderAmount || 0)) throw new AppError("Order total does not meet voucher minimum.", 409, "VOUCHER_MIN_ORDER_NOT_MET");

    let discountAmount = voucher.discountType === DISCOUNT_TYPE.PERCENTAGE
      ? Math.round(orderTotal * Number(voucher.discountValue || 0) / 100)
      : Number(voucher.discountValue || 0);

    if (voucher.maxDiscountAmount !== null && voucher.maxDiscountAmount !== undefined) discountAmount = Math.min(discountAmount, Number(voucher.maxDiscountAmount));
    discountAmount = Math.max(Math.min(discountAmount, orderTotal), 0);

    return { valid: true, voucher, code: voucher.code, discountAmount, finalTotal: Math.max(orderTotal - discountAmount, 0) };
  }

  normalizePayload(payload, currentVoucher = null) {
    const discountType = normalizeDiscountType(payload.discountType ?? payload.discount_type ?? currentVoucher?.discountType ?? currentVoucher?.discount_type ?? DISCOUNT_TYPE.FIXED);
    const discountValue = Number(payload.discountValue ?? payload.discount_value ?? currentVoucher?.discountValue ?? currentVoucher?.discount_value ?? 0);
    const quantity = normalizeNullableInteger(payload.quantity ?? payload.usageLimit ?? payload.usage_limit ?? currentVoucher?.quantity ?? currentVoucher?.usageLimit ?? currentVoucher?.usage_limit);
    const usedQuantity = Number(payload.usedQuantity ?? payload.used_quantity ?? payload.usedCount ?? payload.used_count ?? currentVoucher?.usedQuantity ?? currentVoucher?.used_quantity ?? currentVoucher?.usedCount ?? currentVoucher?.used_count ?? 0);
    const startsAt = normalizeNullableDate(payload.startsAt ?? payload.starts_at ?? payload.startDate ?? payload.start_date ?? currentVoucher?.startsAt ?? currentVoucher?.starts_at ?? currentVoucher?.startDate ?? currentVoucher?.start_date);
    const expiresAt = normalizeNullableDate(payload.expiresAt ?? payload.expires_at ?? payload.endDate ?? payload.end_date ?? currentVoucher?.expiresAt ?? currentVoucher?.expires_at ?? currentVoucher?.endDate ?? currentVoucher?.end_date);

    this.ensureDiscountIsValid(discountType, discountValue);
    if (quantity !== null && quantity < usedQuantity) throw new AppError("quantity must be greater than or equal to usedQuantity.", 422, "VOUCHER_QUANTITY_LESS_THAN_USED");
    if (startsAt && expiresAt && new Date(startsAt) > new Date(expiresAt)) throw new AppError("startsAt must be before expiresAt.", 422, "VOUCHER_DATE_RANGE_INVALID");

    return {
      code: String(payload.code ?? currentVoucher?.code ?? "").trim().toUpperCase(),
      name: String(payload.name ?? currentVoucher?.name ?? "").trim(),
      description: payload.description !== undefined ? String(payload.description || "").trim() : currentVoucher?.description || null,
      discountType,
      discountValue,
      minOrderAmount: Number(payload.minOrderAmount ?? payload.min_order_amount ?? currentVoucher?.minOrderAmount ?? currentVoucher?.min_order_amount ?? 0),
      maxDiscountAmount: normalizeNullableNumber(payload.maxDiscountAmount ?? payload.max_discount_amount ?? currentVoucher?.maxDiscountAmount ?? currentVoucher?.max_discount_amount),
      quantity,
      usedQuantity,
      startsAt,
      expiresAt,
      status: String(payload.status || currentVoucher?.status || VOUCHER_STATUS.ACTIVE).trim().toLowerCase(),
      conditions: normalizeConditions(payload.conditions ?? currentVoucher?.conditions)
    };
  }

  ensureDiscountIsValid(discountType, discountValue) {
    if (!Object.values(DISCOUNT_TYPE).includes(discountType)) throw new AppError("discountType must be percentage or fixed.", 422, "INVALID_DISCOUNT_TYPE");
    if (discountValue <= 0) throw new AppError("discountValue must be greater than 0.", 422, "INVALID_DISCOUNT_VALUE");
    if (discountType === DISCOUNT_TYPE.PERCENTAGE && discountValue > 100) throw new AppError("Percentage discount must not exceed 100.", 422, "VOUCHER_PERCENT_TOO_HIGH");
  }

  async ensureUniqueCode(code, excludedId = null) {
    const duplicatedVoucher = await this.repository.findByCode(code, excludedId);
    if (duplicatedVoucher) throw new AppError("Voucher code already exists.", 409, "VOUCHER_CODE_EXISTS");
  }
}

function normalizeDiscountType(value) { return String(value || "").trim().toLowerCase() === "percent" ? "percentage" : String(value || "").trim().toLowerCase(); }
function normalizeNullableNumber(value) { return value === undefined || value === null || value === "" ? null : Number(value); }
function normalizeNullableInteger(value) { return value === undefined || value === null || value === "" ? null : Number.parseInt(value, 10); }
function normalizeNullableDate(value) { return value === undefined || value === null || value === "" ? null : value; }
function normalizeConditions(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export { DISCOUNT_TYPE, VOUCHER_STATUS };
