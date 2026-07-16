/**
 * Authentication middleware.
 * It verifies Bearer access tokens and attaches the authenticated principal to request.user.
 */
import { AppError } from "../utils/app-error.util.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
import { parseBearerToken } from "../utils/token.util.js";

export function authenticate(request, response, next) {
  const token = parseBearerToken(request.headers.authorization || "");

  if (!token) {
    return next(new AppError("Access token is required.", 401, "ACCESS_TOKEN_REQUIRED"));
  }

  try {
    const payload = verifyAccessToken(token);

    request.user = {
      id: payload.sub,
      role: payload.role,
      permissions: payload.permissions || []
    };

    return next();
  } catch {
    return next(new AppError("Access token is invalid or expired.", 401, "INVALID_ACCESS_TOKEN"));
  }
}
