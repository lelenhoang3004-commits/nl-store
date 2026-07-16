/**
 * Optional CSRF protection middleware.
 * It uses a signed double-submit token and can be enabled with CSRF_ENABLED=true.
 */
import crypto from "node:crypto";
import { securityConfig } from "../config/security.config.js";
import { AppError } from "../utils/app-error.util.js";

export function issueCsrfToken(request, response) {
  const token = crypto.randomBytes(32).toString("hex");

  response.cookie(securityConfig.csrf.cookieName, token, {
    httpOnly: false,
    secure: securityConfig.cookie.secure,
    sameSite: securityConfig.cookie.sameSite,
    signed: true,
    path: "/"
  });

  return token;
}

export function csrfProtection(request, response, next) {
  if (!securityConfig.csrf.enabled) {
    return next();
  }

  if (!securityConfig.csrf.protectedMethods.includes(request.method)) {
    return next();
  }

  const cookieToken = request.signedCookies?.[securityConfig.csrf.cookieName];
  const headerToken = request.headers[securityConfig.csrf.headerName];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError("CSRF token is missing or invalid.", 403, "CSRF_TOKEN_INVALID"));
  }

  return next();
}
