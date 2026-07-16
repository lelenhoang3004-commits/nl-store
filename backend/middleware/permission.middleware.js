/**
 * Permission middleware.
 * It checks whether an authenticated user owns all required permissions.
 */
import { AppError } from "../utils/app-error.util.js";

export function authorizePermissions(...requiredPermissions) {
  return (request, response, next) => {
    if (!request.user) {
      return next(new AppError("Authentication is required.", 401, "AUTHENTICATION_REQUIRED"));
    }

    const userPermissions = request.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((permission) => userPermissions.includes(permission));

    if (!hasAllPermissions) {
      return next(new AppError("You do not have permission to perform this action.", 403, "PERMISSION_FORBIDDEN"));
    }

    return next();
  };
}
