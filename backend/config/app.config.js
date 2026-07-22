/**
 * Application configuration.
 * Environment values are normalized here so the rest of the codebase avoids direct process.env usage.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");

// Always load the project environment regardless of the process working directory.
// A backend/.env file, when present, can override project-level values for backend-only deployments.
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, ".env"), override: true });

export const appConfig = Object.freeze({
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 5000),
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  clientOrigin: resolvePrimaryClientOrigin(),
  clientOrigins: resolveClientOrigins(),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "1mb",
  csrfEnabled: process.env.CSRF_ENABLED
    ? process.env.CSRF_ENABLED === "true"
    : process.env.NODE_ENV === "production",
  csrfCookieName: process.env.CSRF_COOKIE_NAME || "fashion_csrf_token",
  csrfHeaderName: process.env.CSRF_HEADER_NAME || "x-csrf-token",
  cookieSecret: process.env.COOKIE_SECRET || "change-this-cookie-secret",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "change-this-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "change-this-refresh-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  jwtRememberRefreshExpiresIn: process.env.JWT_REMEMBER_REFRESH_EXPIRES_IN || "30d",
  jwtIssuer: process.env.JWT_ISSUER || "fashion-store-api",
  jwtAudience: process.env.JWT_AUDIENCE || "fashion-store-admin",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "fashion_refresh_token",
  refreshCookiePath: process.env.REFRESH_COOKIE_PATH || "/api/v1/auth",
  uploadMaxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE || 5 * 1024 * 1024),
  uploadImageMaxFileSize: Number(process.env.UPLOAD_IMAGE_MAX_FILE_SIZE || 5 * 1024 * 1024),
  uploadAllowedImageTypes: (process.env.UPLOAD_ALLOWED_IMAGE_TYPES || "image/jpeg,image/png,image/webp")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean),
  uploadAllowedFileTypes: (process.env.UPLOAD_ALLOWED_FILE_TYPES || "application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean),
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2BucketName: process.env.R2_BUCKET_NAME || "",
  r2Endpoint: process.env.R2_ENDPOINT || "",
  r2PublicUrl: process.env.R2_PUBLIC_URL || "",
  r2Region: process.env.R2_REGION || "auto",
  r2Folder: process.env.R2_FOLDER || "products",
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  logToFile: process.env.LOG_TO_FILE !== "false",
  logToConsole: process.env.LOG_TO_CONSOLE !== "false",
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS || 14),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  authRateLimitMaxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: resolveOAuthCallbackUrl(
    process.env.GOOGLE_CALLBACK_URL,
    "/api/v1/auth/google/callback"
  ),
  facebookAppId: process.env.FACEBOOK_APP_ID || "",
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || "",
  facebookCallbackUrl: resolveOAuthCallbackUrl(
    process.env.FACEBOOK_CALLBACK_URL,
    "/api/v1/auth/facebook/callback"
  ),
  customerAuthCallbackUrl: resolveCustomerAuthCallbackUrl(),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: Number(process.env.SMTP_PORT || 587) === 587 ? false : (process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Number(process.env.SMTP_PORT || 587) === 465),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFromName: process.env.SMTP_FROM_NAME || "N&L Store",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || "no-reply@nl-store.com",
  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoApiUrl: process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email",
  brevoFromName: process.env.BREVO_FROM_NAME || process.env.SMTP_FROM_NAME || "N&L Store",
  brevoFromEmail: process.env.BREVO_FROM_EMAIL || "",
  brevoEmailTimeoutMs: Number(process.env.BREVO_EMAIL_TIMEOUT_MS || 15000),
  passwordResetExpiresInSeconds: Number(process.env.PASSWORD_RESET_EXPIRES_IN_SECONDS || 600),
  passwordResetResendCooldownSeconds: Number(process.env.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS || 60),
  passwordResetMaxAttempts: Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS || 5),
  otpExpiresInSeconds: Number(process.env.OTP_EXPIRES_IN_SECONDS || 300),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
  uploadRateLimitWindowMs: Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  uploadRateLimitMaxRequests: Number(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS || 60),
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000),
  publicPath: path.join(backendRoot, "public"),
  uploadPath: path.join(backendRoot, "uploads"),
  uploadImagePath: path.join(backendRoot, "uploads", "images"),
  uploadFilePath: path.join(backendRoot, "uploads", "files"),
  uploadTempPath: path.join(backendRoot, "uploads", "temp"),
  logsPath: path.join(backendRoot, "logs")
});

if (appConfig.isProduction && hasUnsafeAuthSecret(appConfig)) {
  throw new Error("Production authentication secrets must be changed before starting the backend.");
}

function hasUnsafeAuthSecret(config) {
  return [
    config.cookieSecret,
    config.jwtAccessSecret,
    config.jwtRefreshSecret
  ].some((secret) => !secret || secret.startsWith("change-this"));
}
function resolvePrimaryClientOrigin() {
  if (process.env.NODE_ENV === "production") {
    return productionFrontendOrigin();
  }
  return process.env.CLIENT_ORIGIN || "http://127.0.0.1:5500";
}

function resolveClientOrigins() {
  const configured = String(
    process.env.CLIENT_ORIGINS
      || process.env.CLIENT_ORIGIN
      || "http://127.0.0.1:5500,http://localhost:5500"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    configured.push(productionFrontendOrigin());
  }

  return [...new Set(configured)];
}

function resolveCustomerAuthCallbackUrl() {
  if (process.env.NODE_ENV === "production") {
    return productionFrontendOrigin() + "/customer/index.html#auth-callback";
  }

  return process.env.CUSTOMER_AUTH_CALLBACK_URL
    || "http://127.0.0.1:5500/frontend/customer/index.html#auth-callback";
}

function productionFrontendOrigin() {
  return String(
    process.env.PUBLIC_FRONTEND_ORIGIN || "https://nl-store.pages.dev"
  ).replace(/\/$/, "");
}

function resolveOAuthCallbackUrl(configuredUrl, callbackPath) {
  const localFallback = "http://localhost:5000" + callbackPath;
  const value = String(configuredUrl || localFallback).trim();

  if (process.env.NODE_ENV !== "production" || !isLocalUrl(value)) {
    return value;
  }

  const productionOrigin = String(
    process.env.PUBLIC_BACKEND_ORIGIN
      || process.env.RENDER_EXTERNAL_URL
      || "https://nl-store.onrender.com"
  ).replace(/\/$/, "");

  return productionOrigin + callbackPath;
}

function isLocalUrl(value) {
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(value).hostname);
  } catch {
    return true;
  }
}

