/**
 * Token utility.
 * It handles bearer parsing and secure refresh-token cookie options.
 */
import { appConfig } from "../config/app.config.js";
import { parseDurationToMs } from "./duration.util.js";

export function parseBearerToken(authorizationHeader = "") {
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function createRefreshCookieOptions(remember = false) {
  const maxAge = parseDurationToMs(
    remember ? appConfig.jwtRememberRefreshExpiresIn : appConfig.jwtRefreshExpiresIn,
    remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
  );

  return {
    httpOnly: true,
    secure: appConfig.isProduction,
    sameSite: appConfig.isProduction ? "none" : "lax",
    signed: true,
    path: appConfig.refreshCookiePath,
    maxAge
  };
}

export function clearRefreshCookie(response) {
  response.clearCookie(appConfig.refreshCookieName, {
    httpOnly: true,
    secure: appConfig.isProduction,
    sameSite: appConfig.isProduction ? "none" : "lax",
    signed: true,
    path: appConfig.refreshCookiePath
  });
}
