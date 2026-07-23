/**
 * User service.
 * It owns user business rules, password hashing, role/permission normalization, profile, avatar, and address updates.
 */
import { AUTH_PERMISSIONS, AUTH_ROLES, getPermissionsByRole } from "../config/auth.config.js";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { UserRepository } from "../repositories/user.repository.js";
import { BaseService } from "./base.service.js";
import { UploadService } from "./upload.service.js";
import { AppError } from "../utils/app-error.util.js";
import { hashPassword } from "../utils/password.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { logger } from "../utils/logger.util.js";

const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  LOCKED: "locked"
});

const USER_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "fullName", "email", "role", "status", "lastLoginAt"],
  allowedFilterFields: ["role", "status"]
});
const MISSING_OPTIONAL_PROFILE_TABLE_CODES = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_TABLE_ERROR"]);

export class UserService extends BaseService {
  constructor(repository = new UserRepository(), uploadService = new UploadService()) {
    super(repository);
    this.uploadService = uploadService;
  }

  async getUsers(query) {
    const options = parseQueryOptions(query, USER_QUERY_OPTIONS);
    const [users, totalItems] = await Promise.all([
      this.repository.findAll(options),
      this.repository.countAll(options)
    ]);

    return {
      users: users.map((user) => user.toJSON()),
      meta: {
        pagination: createPaginationMeta(options.pagination, totalItems),
        search: options.search,
        sort: options.sort,
        filter: options.filter
      }
    };
  }

  async getUserById(id) {
    const user = await this.repository.findById(id);

    if (!user) {
      throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
    }

    return user.toJSON();
  }

  async createUser(payload) {
    const normalizedPayload = await this.normalizeUserPayload(payload, { requirePassword: true });
    await this.ensureUniqueEmail(normalizedPayload.email);

    const user = await this.repository.create(normalizedPayload);
    return user.toJSON();
  }

  async updateUser(id, payload) {
    await this.getUserById(id);

    const normalizedPayload = await this.normalizeUserPayload(payload, { requirePassword: false });
    await this.ensureUniqueEmail(normalizedPayload.email, id);

    const user = await this.repository.update(id, normalizedPayload);
    return user.toJSON();
  }

  async updateAdminUser(id, payload, actor = {}) {
    const currentUser = await this.getUserById(id);
    const normalizedPayload = await this.normalizeAdminUserPayload(payload, currentUser, actor);

    if (normalizedPayload.email && normalizedPayload.email !== currentUser.email) {
      await this.ensureUniqueEmail(normalizedPayload.email, id);
    }

    const user = await this.repository.patchFields(id, normalizedPayload);
    return user.toJSON();
  }

  async normalizeAdminUserPayload(payload = {}, currentUser = {}, actor = {}) {
    const result = {};
    const fullName = payload.fullName ?? payload.full_name;

    if (fullName !== undefined) {
      result.fullName = String(fullName).trim();
    }

    if (payload.email !== undefined) {
      result.email = String(payload.email).trim().toLowerCase();
    }

    if (payload.phone !== undefined) {
      result.phone = normalizeNullableString(payload.phone);
    }

    if (payload.role !== undefined) {
      const normalizedRole = String(payload.role || "").trim().toUpperCase();

      if (!Object.values(AUTH_ROLES).includes(normalizedRole) || normalizedRole === AUTH_ROLES.GUEST) {
        throw new AppError("User role is invalid.", 422, "INVALID_USER_ROLE");
      }

      if (String(currentUser.id) === String(actor.id) && normalizedRole !== currentUser.role) {
        throw new AppError("You cannot change your own role in a way that removes your access.", 409, "USER_SELF_ROLE_CHANGE_NOT_ALLOWED");
      }

      if (normalizedRole === AUTH_ROLES.ADMIN && actor.role !== AUTH_ROLES.ADMIN) {
        throw new AppError("Only ADMIN can assign ADMIN role.", 403, "ADMIN_ROLE_ASSIGNMENT_FORBIDDEN");
      }

      result.role = normalizedRole;

      if (payload.permissions === undefined) {
        result.permissions = getPermissionsByRole(normalizedRole);
      }
    }

    if (payload.status !== undefined) {
      const normalizedStatus = String(payload.status || "").trim().toLowerCase();

      if (!Object.values(USER_STATUS).includes(normalizedStatus)) {
        throw new AppError("User status must be active, inactive, or locked.", 422, "INVALID_USER_STATUS");
      }

      if (String(currentUser.id) === String(actor.id) && normalizedStatus === USER_STATUS.LOCKED) {
        throw new AppError("Không thể tự khóa tài khoản đang đăng nhập.", 409, "USER_SELF_LOCK_NOT_ALLOWED");
      }

      result.status = normalizedStatus;
    }

    if (payload.permissions !== undefined) {
      if (currentUser.role === AUTH_ROLES.ADMIN && actor.role !== AUTH_ROLES.ADMIN) {
        throw new AppError("Only ADMIN can update ADMIN permissions.", 403, "ADMIN_PERMISSION_UPDATE_FORBIDDEN");
      }

      result.permissions = normalizeAdminPermissions(payload.permissions);
    }

    return result;
  }

  async updateUserStatus(id, status, actor = {}) {
    await this.getUserById(id);
    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (!Object.values(USER_STATUS).includes(normalizedStatus)) {
      throw new AppError("User status must be active, inactive, or locked.", 422, "INVALID_USER_STATUS");
    }

    if (String(id) === String(actor.id) && normalizedStatus === USER_STATUS.LOCKED) {
      throw new AppError("Không thể tự khóa tài khoản đang đăng nhập.", 409, "USER_SELF_LOCK_NOT_ALLOWED");
    }

    const user = await this.repository.patchFields(id, { status: normalizedStatus });
    return user.toJSON();
  }

  async updateUserRole(id, role, actor = {}) {
    await this.getUserById(id);
    const normalizedRole = String(role || "").trim().toUpperCase();

    if (!Object.values(AUTH_ROLES).includes(normalizedRole) || normalizedRole === AUTH_ROLES.GUEST) {
      throw new AppError("User role is invalid.", 422, "INVALID_USER_ROLE");
    }

    if (String(id) === String(actor.id)) {
      throw new AppError("You cannot change your own role.", 409, "USER_SELF_ROLE_CHANGE_NOT_ALLOWED");
    }

    if (normalizedRole === AUTH_ROLES.ADMIN && actor.role !== AUTH_ROLES.ADMIN) {
      throw new AppError("Only ADMIN can assign ADMIN role.", 403, "ADMIN_ROLE_ASSIGNMENT_FORBIDDEN");
    }

    const user = await this.repository.patchFields(id, {
      role: normalizedRole,
      permissions: getPermissionsByRole(normalizedRole)
    });
    return user.toJSON();
  }

  async updateUserPermissions(id, permissions, actor = {}) {
    const currentUser = await this.getUserById(id);

    if (currentUser.role === AUTH_ROLES.ADMIN && actor.role !== AUTH_ROLES.ADMIN) {
      throw new AppError("Only ADMIN can update ADMIN permissions.", 403, "ADMIN_PERMISSION_UPDATE_FORBIDDEN");
    }

    const user = await this.repository.patchFields(id, {
      permissions: normalizePermissions(permissions, currentUser.role)
    });
    return user.toJSON();
  }

  async deleteUser(id, currentUserId) {
    if (String(id) === String(currentUserId)) {
      throw new AppError("You cannot delete your own account.", 409, "USER_SELF_DELETE_NOT_ALLOWED");
    }

    await this.getUserById(id);

    const deleted = await this.repository.softDelete(id);

    if (!deleted) {
      throw new AppError("User could not be deleted.", 409, "USER_DELETE_FAILED");
    }

    return {
      id,
      deleted: true
    };
  }

  async getProfile(userId) {
    const user = await this.repository.findByIdWithAuth(userId);
    if (!user) {
      throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
    }
    return user.toJSON();
  }

  async updateProfile(userId, payload) {
    const currentUser = await this.repository.findByIdWithAuth(userId);
    if (!currentUser) {
      throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
    }
    const email = payload.email === undefined ? currentUser.email : normalizeEmail(payload.email);
    const phone = payload.phone === undefined ? currentUser.phone : normalizePhone(payload.phone);
    const emailChanged = email !== currentUser.email;
    const phoneChanged = phone !== currentUser.phone;

    if (emailChanged) {
      await this.ensureUniqueEmail(email, userId);
    }
    if (phoneChanged) {
      await this.ensureUniquePhone(phone, userId);
    }
    if (emailChanged || phoneChanged) {
      if (!currentUser.hasPassword) {
        throw new AppError("Vui lòng thiết lập mật khẩu trước khi đổi email hoặc số điện thoại.", 409, "PASSWORD_SETUP_REQUIRED");
      }
      await this.ensureCurrentPassword(currentUser, payload.current_password, userId);
    }

    const normalizedPayload = {};
    const fullName = payload.fullName === undefined ? currentUser.fullName : String(payload.fullName || "").trim();
    const avatarUrl = payload.avatarUrl === undefined ? currentUser.avatarUrl : normalizeNullableString(payload.avatarUrl);
    const address = payload.address === undefined ? currentUser.address : normalizeAddress(payload.address);

    if (emailChanged) normalizedPayload.email = email;
    if (fullName !== currentUser.fullName) normalizedPayload.fullName = fullName;
    if (phoneChanged) normalizedPayload.phone = phone;
    if (avatarUrl !== currentUser.avatarUrl) normalizedPayload.avatarUrl = avatarUrl;
    if (JSON.stringify(address || null) !== JSON.stringify(currentUser.address || null)) normalizedPayload.address = address;

    const user = await this.repository.updateProfile(userId, normalizedPayload);
    return user.toJSON();
  }

  async updateAvatar(userId, file) {
    if (!file) {
      throw new AppError("Avatar file is required.", 422, "AVATAR_FILE_REQUIRED");
    }
    const filePayload = await this.uploadService.createUploadedImagePayload(file);
    const user = await this.repository.updateAvatar(userId, filePayload.url);

    return {
      user: user.toJSON(),
      avatar: filePayload
    };
  }

  async changePassword(userId, payload = {}) {
    const user = await this.repository.findByIdWithAuth(userId);
    if (!user) {
      throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
    }
    await this.ensureCurrentPassword(user, payload.current_password, userId);
    if (payload.newPassword !== payload.confirmPassword) {
      throw new AppError("Xác nhận mật khẩu không khớp.", 422, "PASSWORD_CONFIRMATION_MISMATCH");
    }
    const updatedUser = await this.repository.updatePasswordHash(userId, await hashPassword(payload.newPassword));
    return { changed: true, user: updatedUser.toJSON() };
  }

  async setPassword(userId, payload = {}) {
    const user = await this.repository.findByIdWithAuth(userId);
    if (!user) {
      throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
    }
    if (user.hasPassword) {
      throw new AppError("Tài khoản đã có mật khẩu. Vui lòng dùng chức năng đổi mật khẩu.", 409, "PASSWORD_ALREADY_EXISTS");
    }
    if (payload.newPassword !== payload.confirmPassword) {
      throw new AppError("Xác nhận mật khẩu không khớp.", 422, "PASSWORD_CONFIRMATION_MISMATCH");
    }
    await this.repository.updatePasswordHash(userId, await hashPassword(payload.newPassword));
    return { changed: true };
  }

  async getSocialConnections(userId) {
    const user = await this.repository.findByIdWithAuth(userId);
    if (!user) {
      throw new AppError("User was not found.", 404, "USER_NOT_FOUND");
    }
    const rows = await this.repository.listSocialConnections(userId);
    const connections = new Map(["google", "facebook"].map((provider) => [provider, {
      provider,
      linked: false,
      email: null,
      displayName: null,
      avatarUrl: null,
      linkedAt: null
    }]));

    if (user.provider && connections.has(String(user.provider).toLowerCase())) {
      const provider = String(user.provider).toLowerCase();
      connections.set(provider, {
        ...connections.get(provider),
        linked: true,
        email: user.email,
        linkedAt: user.updatedAt || user.createdAt
      });
    }

    rows.forEach((row) => {
      const provider = String(row.provider || "").toLowerCase();
      if (!connections.has(provider)) {
        return;
      }
      connections.set(provider, {
        provider,
        linked: true,
        email: row.provider_email || null,
        displayName: row.display_name || null,
        avatarUrl: row.avatar_url || null,
        linkedAt: row.linked_at || null
      });
    });

    return {
      hasPassword: user.hasPassword,
      has_password: user.hasPassword,
      connections: Array.from(connections.values())
    };
  }

  async createSocialLinkIntent(provider) {
    const normalizedProvider = normalizeProvider(provider);
    return {
      provider: normalizedProvider,
      status: "not_integrated",
      authorizationUrl: null,
      message: `Chức năng liên kết ${providerLabel(normalizedProvider)} đang thử nghiệm. N&L Store chưa kết nối OAuth liên kết tài khoản thật.`
    };
  }

  async unlinkSocialConnection(userId, provider) {
    const normalizedProvider = normalizeProvider(provider);
    const user = await this.repository.findByIdWithAuth(userId);
    const social = await this.getSocialConnections(userId);
    const linkedCount = social.connections.filter((connection) => connection.linked).length;

    if (!user.hasPassword && linkedCount <= 1) {
      throw new AppError("Không thể hủy liên kết phương thức đăng nhập cuối cùng khi tài khoản chưa có mật khẩu.", 409, "LAST_LOGIN_METHOD_UNLINK_DENIED");
    }

    await this.repository.deleteSocialConnection(userId, normalizedProvider);
    return this.getSocialConnections(userId);
  }

  async getPaymentMethods(userId) {
    return (await this.repository.listPaymentMethods(userId)).map(formatPaymentMethod);
  }

  async createPaymentMethod(userId, payload = {}) {
    let method;
    try {
      const normalized = normalizePaymentPayload(payload);
      await this.ensureUniquePaymentMethod(userId, normalized);
      method = await this.repository.createPaymentMethod(userId, {
        ...normalized,
        verificationStatus: "unverified",
        isDefault: Boolean(payload.isDefault)
      });
    } catch (error) {
      throwProfileTableError(error);
    }

    return {
      paymentMethod: formatPaymentMethod(method),
      message: "Phương thức thanh toán đã lưu - chưa xác minh."
    };
  }

  async updatePaymentMethod(userId, id, payload = {}) {
    try {
      const current = await this.repository.findPaymentMethod(userId, id);
      if (!current) {
        throw new AppError("Không tìm thấy phương thức thanh toán.", 404, "PAYMENT_METHOD_NOT_FOUND");
      }
      const normalized = normalizePaymentPayload(payload);
      await this.ensureUniquePaymentMethod(userId, normalized, id);
      const method = await this.repository.updatePaymentMethod(userId, id, {
        ...normalized,
        verificationStatus: "unverified",
        isDefault: payload.isDefault === undefined ? Boolean(current.is_default) : Boolean(payload.isDefault)
      });

      return {
        paymentMethod: formatPaymentMethod(method),
        message: "Phương thức thanh toán đã lưu - chưa xác minh."
      };
    } catch (error) {
      throwProfileTableError(error);
    }
  }

  async setDefaultPaymentMethod(userId, id) {
    try {
      const current = await this.repository.findPaymentMethod(userId, id);
      if (!current) {
        throw new AppError("Không tìm thấy phương thức thanh toán.", 404, "PAYMENT_METHOD_NOT_FOUND");
      }
      return formatPaymentMethod(await this.repository.setDefaultPaymentMethod(userId, id));
    } catch (error) {
      throwProfileTableError(error);
    }
  }

  async deletePaymentMethod(userId, id) {
    let deleted = false;
    try {
      deleted = await this.repository.deletePaymentMethod(userId, id);
      if (!deleted) {
        throw new AppError("Không tìm thấy phương thức thanh toán.", 404, "PAYMENT_METHOD_NOT_FOUND");
      }
    } catch (error) {
      throwProfileTableError(error);
    }
    return { id, deleted: true };
  }

  async ensureUniquePaymentMethod(userId, payload, excludedId = null) {
    const duplicated = await this.repository.findPaymentMethodByFingerprint(userId, payload.type, payload.accountFingerprint, excludedId);
    if (duplicated) {
      throw new AppError("Phương thức thanh toán này đã tồn tại.", 409, "PAYMENT_METHOD_DUPLICATED");
    }
  }
  async normalizeUserPayload(payload, options = {}) {
    const role = payload.role || AUTH_ROLES.CUSTOMER;
    const permissions = normalizePermissions(payload.permissions, role);
    const passwordHash = payload.password
      ? await hashPassword(payload.password)
      : null;

    if (options.requirePassword && !passwordHash) {
      throw new AppError("Password is required.", 422, "PASSWORD_REQUIRED");
    }

    return {
      email: String(payload.email).trim().toLowerCase(),
      fullName: String(payload.fullName).trim(),
      phone: normalizeNullableString(payload.phone),
      avatarUrl: normalizeNullableString(payload.avatarUrl),
      passwordHash,
      role,
      permissions,
      status: payload.status || USER_STATUS.ACTIVE,
      address: normalizeAddress(payload.address)
    };
  }

  async ensureUniqueEmail(email, excludedId = null) {
    const duplicatedUser = await this.repository.findByEmail(email, excludedId);

    if (duplicatedUser) {
      throw new AppError("Email already exists.", 409, "USER_EMAIL_EXISTS");
    }
  }

  async ensureUniquePhone(phone, excludedId = null) {
    if (!phone) {
      return;
    }
    const duplicatedUser = await this.repository.findByPhone(phone, excludedId);

    if (duplicatedUser) {
      throw new AppError("Phone already exists.", 409, "USER_PHONE_EXISTS");
    }
  }

  async ensureCurrentPassword(user, current_password, jwtUserId = null) {
    if (!user.hasPassword) {
      throw new AppError("Tài khoản chưa có mật khẩu. Vui lòng đặt mật khẩu trước khi thay đổi thông tin đăng nhập.", 409, "PASSWORD_NOT_AVAILABLE");
    }
    const passwordMatched = Boolean(current_password && user.password_hash && await bcrypt.compare(current_password, user.password_hash));
    logger.info("Profile current password check.", {
      jwt_user_id: jwtUserId,
      db_user_id: user.id,
      hasPassword: user.hasPassword,
      passwordMatched
    });
    if (!passwordMatched) {
      throw new AppError("Mật khẩu hiện tại không đúng.", 401, "CURRENT_PASSWORD_INVALID");
    }
  }
}

function normalizeAdminPermissions(permissions) {
  const allowedPermissions = Object.values(AUTH_PERMISSIONS);

  if (permissions === null) {
    return [];
  }

  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions
    .filter((permission) => permission !== undefined && permission !== null)
    .map((permission) => String(permission).trim())
    .filter((permission) => permission && allowedPermissions.includes(permission));
}

function normalizePermissions(permissions, role) {
  const allowedPermissions = Object.values(AUTH_PERMISSIONS);

  if (!permissions) {
    return getPermissionsByRole(role);
  }

  const requestedPermissions = Array.isArray(permissions)
    ? permissions
    : String(permissions).split(",").map((permission) => permission.trim()).filter(Boolean);

  return requestedPermissions.filter((permission) => allowedPermissions.includes(permission));
}

function normalizeAddress(address) {
  if (!address) {
    return null;
  }

  if (typeof address === "string") {
    try {
      return JSON.parse(address);
    } catch {
      return null;
    }
  }

  return {
    line1: normalizeNullableString(address.line1),
    line2: normalizeNullableString(address.line2),
    ward: normalizeNullableString(address.ward),
    district: normalizeNullableString(address.district),
    city: normalizeNullableString(address.city),
    province: normalizeNullableString(address.province),
    provinceCode: normalizeNullableString(address.provinceCode),
    provinceName: normalizeNullableString(address.provinceName),
    wardCode: normalizeNullableString(address.wardCode),
    wardName: normalizeNullableString(address.wardName),
    country: normalizeNullableString(address.country) || "Vietnam",
    postalCode: normalizeNullableString(address.postalCode),
    detailAddress: normalizeNullableString(address.detailAddress),
    fullAddress: normalizeNullableString(address.fullAddress)
  };
}

function normalizeNullableString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  const normalized = normalizeNullableString(value);
  return normalized ? normalized.replace(/[\s.-]/g, "") : null;
}

function normalizeProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!["google", "facebook"].includes(normalized)) {
    throw new AppError("Provider is invalid.", 422, "INVALID_SOCIAL_PROVIDER");
  }
  return normalized;
}

function providerLabel(provider) {
  return provider === "google" ? "Google" : "Facebook";
}

function normalizePaymentType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (!["bank_account", "momo"].includes(normalized)) {
    throw new AppError("Payment method type is invalid.", 422, "INVALID_PAYMENT_METHOD_TYPE");
  }
  return normalized;
}

function normalizePaymentPayload(payload = {}) {
  const type = normalizePaymentType(payload.type);
  const rawIdentifier = type === "momo"
    ? normalizePhone(payload.phone || payload.accountIdentifier)
    : normalizeBankAccount(payload.accountNumber || payload.accountIdentifier);

  if (type === "momo" && !/^((0|\+84)(3|5|7|8|9)\d{8})$/.test(rawIdentifier || "")) {
    throw new AppError("Số điện thoại MoMo không hợp lệ.", 422, "INVALID_MOMO_PHONE");
  }

  if (type === "bank_account" && !/^\d{6,30}$/.test(rawIdentifier || "")) {
    throw new AppError("Số tài khoản ngân hàng không hợp lệ.", 422, "INVALID_BANK_ACCOUNT");
  }

  return {
    type,
    providerName: type === "momo" ? "MoMo" : normalizeNullableString(payload.providerName || payload.bankName),
    accountHolderName: normalizeNullableString(payload.accountHolderName),
    maskedAccountIdentifier: type === "momo" ? maskMomoPhone(rawIdentifier) : maskBankAccount(rawIdentifier),
    accountFingerprint: createPaymentFingerprint(type, rawIdentifier)
  };
}

function normalizeBankAccount(value) {
  return String(value || "").replace(/\D/g, "");
}

function maskMomoPhone(value) {
  const normalized = String(value || "");
  return `${normalized.slice(0, 3)}***${normalized.slice(-4)}`;
}

function maskBankAccount(value) {
  return `****${String(value || "").slice(-4)}`;
}

function createPaymentFingerprint(type, value) {
  return crypto.createHash("sha256").update(`${type}:${value}`).digest("hex");
}

function formatPaymentMethod(row = {}) {
  return {
    id: row.id,
    type: row.type,
    providerName: row.provider_name || row.providerName || null,
    accountHolderName: row.account_holder_name || row.accountHolderName || null,
    maskedAccountIdentifier: row.masked_account_identifier || row.maskedAccountIdentifier || null,
    verificationStatus: row.verification_status || row.verificationStatus || "unverified",
    isDefault: Boolean(row.is_default ?? row.isDefault),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}

function throwProfileTableError(error) {
  if (MISSING_OPTIONAL_PROFILE_TABLE_CODES.has(error?.code)) {
    throw new AppError("Chức năng hồ sơ chưa sẵn sàng. Vui lòng chạy migration user_social_connections và user_payment_methods.", 503, "PROFILE_OPTIONAL_TABLE_MISSING");
  }
  throw error;
}

export { USER_STATUS };




