/**
 * JWT configuration.
 * Token secrets and expiration values are kept in one place for authentication services.
 */
import { appConfig } from "./app.config.js";

export const jwtConfig = Object.freeze({
  accessSecret: appConfig.jwtAccessSecret,
  refreshSecret: appConfig.jwtRefreshSecret,
  accessExpiresIn: appConfig.jwtAccessExpiresIn,
  refreshExpiresIn: appConfig.jwtRefreshExpiresIn,
  rememberRefreshExpiresIn: appConfig.jwtRememberRefreshExpiresIn,
  issuer: appConfig.jwtIssuer,
  audience: appConfig.jwtAudience
});
