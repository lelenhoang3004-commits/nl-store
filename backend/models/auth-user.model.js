/**
 * Auth user model.
 * It exposes only authentication-safe fields and keeps password/token hashes private.
 */
import { getPermissionsByRole } from "../config/auth.config.js";

export class AuthUser {
  constructor(rawUser = {}) {
    this.id = rawUser.id;
    this.email = rawUser.email;
    this.phone = rawUser.phone || null;
    this.name = rawUser.name || rawUser.fullName || rawUser.full_name || "";
    this.avatarUrl = rawUser.avatarUrl || rawUser.avatar_url || null;
    this.role = rawUser.role;
    this.status = rawUser.status;
    this.passwordHash = rawUser.passwordHash || rawUser.password_hash;
    this.refreshTokenHash = rawUser.refreshTokenHash || rawUser.refresh_token_hash || null;
    this.permissions = normalizePermissions(rawUser.permissions, rawUser.role);
  }

  isActive() {
    return this.status === "active" || this.status === "ACTIVE";
  }

  toSafeJSON() {
    return {
      id: this.id,
      email: this.email,
      phone: this.phone,
      name: this.name,
      avatarUrl: this.avatarUrl,
      role: this.role,
      permissions: this.permissions,
      status: this.status
    };
  }
}

function normalizePermissions(permissions, role) {
  const rolePermissions = getPermissionsByRole(role);

  if (Array.isArray(permissions)) {
    return role === "ADMIN" ? [...new Set([...rolePermissions, ...permissions])] : permissions;
  }

  if (typeof permissions === "string" && permissions.trim() !== "") {
    try {
      const parsedPermissions = JSON.parse(permissions);
      return Array.isArray(parsedPermissions)
        ? (role === "ADMIN" ? [...new Set([...rolePermissions, ...parsedPermissions])] : parsedPermissions)
        : rolePermissions;
    } catch {
      return permissions.split(",").map((permission) => permission.trim()).filter(Boolean);
    }
  }

  return rolePermissions;
}


