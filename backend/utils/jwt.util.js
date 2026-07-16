/**
 * JWT utility.
 * It signs and verifies access and refresh tokens with separate secrets.
 */
import jwt from "jsonwebtoken";
import { appConfig } from "../config/app.config.js";

export function signAccessToken(payload) {
  return jwt.sign(payload, appConfig.jwtAccessSecret, {
    issuer: appConfig.jwtIssuer,
    audience: appConfig.jwtAudience,
    expiresIn: appConfig.jwtAccessExpiresIn
  });
}

export function signRefreshToken(payload, remember = false) {
  return jwt.sign(payload, appConfig.jwtRefreshSecret, {
    issuer: appConfig.jwtIssuer,
    audience: appConfig.jwtAudience,
    expiresIn: remember ? appConfig.jwtRememberRefreshExpiresIn : appConfig.jwtRefreshExpiresIn
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, appConfig.jwtAccessSecret, {
    issuer: appConfig.jwtIssuer,
    audience: appConfig.jwtAudience
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, appConfig.jwtRefreshSecret, {
    issuer: appConfig.jwtIssuer,
    audience: appConfig.jwtAudience
  });
}
