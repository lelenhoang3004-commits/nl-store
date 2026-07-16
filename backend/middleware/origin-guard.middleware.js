/**
 * Origin guard middleware.
 * It rejects unsafe browser requests from untrusted origins before they reach feature routes.
 */
import { securityConfig } from "../config/security.config.js";
import { AppError } from "../utils/app-error.util.js";

export function originGuard(request, response, next) {
  if (!securityConfig.csrf.protectedMethods.includes(request.method)) {
    return next();
  }

  const origin = request.headers.origin;

  if (!origin) {
    return next();
  }

  if (!securityConfig.allowedOrigins.includes(origin)) {
    return next(new AppError("Request origin is not allowed.", 403, "ORIGIN_FORBIDDEN"));
  }

  return next();
}
