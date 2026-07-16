/**
 * Role middleware.
 * It checks whether an authenticated user owns one of the allowed roles.
 */
import { AppError } from "../utils/app-error.util.js";

export function authorizeRoles(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user) {
      return next(new AppError("Authentication is required.", 401, "AUTHENTICATION_REQUIRED"));
    }

    if (!allowedRoles.includes(request.user.role)) {
      return next(new AppError("You do not have permission to perform this action.", 403, "ROLE_FORBIDDEN"));
    }

    return next();
  };
}

