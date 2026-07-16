/**
 * Authorization middleware.
 * It provides a single guard for routes that need role and permission checks together.
 */
import { AppError } from "../utils/app-error.util.js";

export function authorize({ roles = [], permissions = [], permissionMode = "all" } = {}) {
  return (request, response, next) => {
    if (!request.user) {
      return next(new AppError("Authentication is required.", 401, "AUTHENTICATION_REQUIRED"));
    }

    if (roles.length > 0 && !roles.includes(request.user.role)) {
      return next(new AppError("You do not have permission to perform this action.", 403, "ROLE_FORBIDDEN"));
    }

    const userPermissions = request.user.permissions || [];
    const hasPermissions = permissionMode === "any"
      ? permissions.some((permission) => userPermissions.includes(permission))
      : permissions.every((permission) => userPermissions.includes(permission));

    if (permissions.length > 0 && !hasPermissions) {
      return next(new AppError("You do not have permission to perform this action.", 403, "PERMISSION_FORBIDDEN"));
    }

    return next();
  };
}

