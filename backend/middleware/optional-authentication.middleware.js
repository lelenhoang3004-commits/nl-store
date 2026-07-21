import { verifyAccessToken } from "../utils/jwt.util.js";
import { parseBearerToken } from "../utils/token.util.js";

export function optionalAuthenticate(request, response, next) {
  const token = parseBearerToken(request.headers.authorization || "");

  if (!token) {
    request.user = null;
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    request.user = {
      id: payload.sub,
      role: payload.role,
      permissions: payload.permissions || []
    };
  } catch {
    request.user = null;
  }

  return next();
}
