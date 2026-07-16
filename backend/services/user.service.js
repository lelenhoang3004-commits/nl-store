/**
 * User service.
 * It owns user business rules, password hashing, role/permission normalization, profile, avatar, and address updates.
 */
import { AUTH_PERMISSIONS, AUTH_ROLES, getPermissionsByRole } from "../config/auth.config.js";
import { UserRepository } from "../repositories/user.repository.js";
import { BaseService } from "./base.service.js";
import { UploadService } from "./upload.service.js";
import { AppError } from "../utils/app-error.util.js";
import { hashPassword } from "../utils/password.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";

const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  LOCKED: "locked"
});

const USER_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "fullName", "email", "role", "status", "lastLoginAt"],
  allowedFilterFields: ["role", "status"]
});

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
    return this.getUserById(userId);
  }

  async updateProfile(userId, payload) {
    const currentUser = await this.getUserById(userId);
    const normalizedPayload = {
      fullName: payload.fullName ? String(payload.fullName).trim() : currentUser.fullName,
      phone: payload.phone === undefined ? currentUser.phone : normalizeNullableString(payload.phone),
      avatarUrl: payload.avatarUrl === undefined ? currentUser.avatarUrl : normalizeNullableString(payload.avatarUrl),
      address: payload.address === undefined ? currentUser.address : normalizeAddress(payload.address)
    };

    const user = await this.repository.updateProfile(userId, normalizedPayload);
    return user.toJSON();
  }

  async updateAvatar(userId, file) {
    const filePayload = this.uploadService.createUploadedFilePayload(file, "images");
    const user = await this.repository.updateAvatar(userId, filePayload.url);

    return {
      user: user.toJSON(),
      avatar: filePayload
    };
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
    country: normalizeNullableString(address.country) || "Vietnam",
    postalCode: normalizeNullableString(address.postalCode)
  };
}

function normalizeNullableString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

export { USER_STATUS };
