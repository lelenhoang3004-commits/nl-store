/**
 * User model.
 * It maps user database rows to API-safe objects and never exposes password or token hashes.
 */
import { BaseModel } from "./base.model.js";
import { getPermissionsByRole } from "../config/auth.config.js";

export class User extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.email = attributes.email;
    this.fullName = attributes.fullName || attributes.full_name || "";
    this.phone = attributes.phone || null;
    this.avatarUrl = attributes.avatarUrl || attributes.avatar_url || null;
    this.role = attributes.role;
    this.permissions = normalizePermissions(attributes.permissions, attributes.role);
    this.status = attributes.status;
    this.provider = attributes.provider || null;
    this.providerId = attributes.providerId || attributes.provider_id || null;
    this.passwordHash = attributes.passwordHash || attributes.password_hash || null;
    this.hasPassword = Boolean(attributes.hasPassword || attributes.has_password || attributes.password_hash);
    this.address = normalizeAddress(attributes.address || attributes.address_json);
    this.lastLoginAt = attributes.lastLoginAt || attributes.last_login_at || null;
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      phone: this.phone,
      avatarUrl: this.avatarUrl,
      role: this.role,
      permissions: this.permissions,
      status: this.status,
      hasPassword: this.hasPassword,
      address: this.address,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

function normalizePermissions(permissions, role) {
  if (Array.isArray(permissions)) {
    return permissions;
  }

  if (typeof permissions === "string" && permissions.trim() !== "") {
    try {
      const parsedPermissions = JSON.parse(permissions);
      return Array.isArray(parsedPermissions) ? parsedPermissions : getPermissionsByRole(role);
    } catch {
      return permissions.split(",").map((permission) => permission.trim()).filter(Boolean);
    }
  }

  return getPermissionsByRole(role);
}

function normalizeAddress(address) {
  if (!address) {
    return null;
  }

  if (typeof address === "object") {
    return address;
  }

  try {
    return JSON.parse(address);
  } catch {
    return null;
  }
}
