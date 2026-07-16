import { getCurrentUser } from "./user-session.js";
import { ROLES } from "./roles.js";

export function hasPermission(permission, user = getCurrentUser()) {
  if (!permission) {
    return true;
  }

  return user.permissions.includes(permission);
}

export function hasAnyPermission(permissions = [], user = getCurrentUser()) {
  if (!permissions.length) {
    return true;
  }

  return permissions.some((permission) => hasPermission(permission, user));
}

export function hasAllPermissions(permissions = [], user = getCurrentUser()) {
  if (!permissions.length) {
    return true;
  }

  return permissions.every((permission) => hasPermission(permission, user));
}

export function canAccessRoute(route, user = getCurrentUser()) {
  if (route.requiresAuth === false) {
    return true;
  }

  if (![ROLES.ADMIN, ROLES.STAFF].includes(user.role)) {
    return false;
  }

  return hasAllPermissions(route.permissions ?? [], user);
}

export function filterMenuByPermission(menuItems = [], user = getCurrentUser()) {
  return menuItems.filter((item) => hasAllPermissions(item.permissions ?? [], user));
}
