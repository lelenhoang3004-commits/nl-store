import crypto from "node:crypto";
import { appConfig } from "../config/app.config.js";
import { AUTH_ROLES } from "../config/auth.config.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { UserService } from "./user.service.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { comparePassword, hashPassword } from "../utils/password.util.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.util.js";
import { parseDurationToMs } from "../utils/duration.util.js";
import { logger } from "../utils/logger.util.js";

export class AuthService extends BaseService {
  constructor(repository = new AuthRepository(), userService = new UserService()) {
    super(repository);
    this.userService = userService;
  }

  async register(payload) {
    const normalizedEmail = String(payload.email).trim().toLowerCase();
    if (await this.repository.findByEmail(normalizedEmail)) {
      throw new AppError("Email đã tồn tại.", 409, "USER_EMAIL_EXISTS");
    }
    const user = await this.userService.createUser({
      email: normalizedEmail, fullName: String(payload.fullName).trim(), phone: normalizePhone(payload.phone),
      address: { line1: String(payload.address || "").trim(), country: "Vietnam" }, password: payload.password,
      role: AUTH_ROLES.CUSTOMER, permissions: [], status: "active"
    });
    return { user };
  }

  async login({ email, identifier, password, remember = false }) {
    const user = await this.repository.findByLogin(email ?? identifier);
    if (!user || !user.isActive() || !user.passwordHash) {
      throw new AppError("Email/số điện thoại hoặc mật khẩu không đúng.", 401, "INVALID_CREDENTIALS");
    }
    if (!await comparePassword(password, user.passwordHash)) {
      throw new AppError("Email/số điện thoại hoặc mật khẩu không đúng.", 401, "INVALID_CREDENTIALS");
    }
    return this.issueTokenPair(user, remember);
  }

  getOAuthAuthorization(provider, state) {
    const config = oauthConfig(provider);
    if (!config.clientId || !config.clientSecret) {
      throw new AppError(`Chức năng đăng nhập ${config.label} chưa được cấu hình.`, 503, "OAUTH_NOT_CONFIGURED");
    }
    const params = new URLSearchParams(config.authorizationParams(state));
    return `${config.authorizationUrl}?${params}`;
  }

  async handleOAuthCallback(provider, code) {
    if (!code) throw new AppError("OAuth không trả về mã xác thực.", 400, "OAUTH_CODE_MISSING");
    const config = oauthConfig(provider);
    if (!config.clientId || !config.clientSecret) {
      throw new AppError(`Chức năng đăng nhập ${config.label} chưa được cấu hình.`, 503, "OAUTH_NOT_CONFIGURED");
    }
    const tokenResponse = await fetch(typeof config.tokenUrl === "function" ? config.tokenUrl(code) : config.tokenUrl, config.tokenRequest(code));
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new AppError(`Đăng nhập ${config.label} thất bại.`, 401, "OAUTH_TOKEN_EXCHANGE_FAILED", tokenData?.error);
    }
    const profileResponse = await fetch(config.profileUrl(tokenData.access_token));
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.id) {
      throw new AppError(`Không thể lấy thông tin tài khoản ${config.label}.`, 401, "OAUTH_PROFILE_FAILED");
    }
    const identity = config.mapProfile(profile);
    let user = await this.repository.findByProvider(provider, identity.providerId, identity.email);
    if (user) {
      user = await this.repository.linkOAuthProvider(user.id, { provider, providerId: identity.providerId, email: identity.email, avatarUrl: identity.avatarUrl });
    } else {
      user = await this.repository.createOAuthUser({ ...identity, provider });
    }
    if (!user.isActive()) throw new AppError("Tài khoản đã bị khóa.", 403, "ACCOUNT_INACTIVE");
    return this.issueTokenPair(user, true);
  }

  async sendPhoneOtp(rawPhone) {
    const phone = normalizePhone(rawPhone);
    const latest = await this.repository.getLatestOtp(phone);
    if (latest) {
      const elapsed = Number(latest.seconds_since_created || 0);
      if (elapsed < appConfig.otpResendCooldownSeconds) {
        throw new AppError(`Vui lòng chờ ${appConfig.otpResendCooldownSeconds - elapsed} giây trước khi gửi lại.`, 429, "OTP_RESEND_COOLDOWN");
      }
    }
    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + appConfig.otpExpiresInSeconds * 1000);
    await this.repository.saveOtp(phone, otpHash, expiresAt);
    if (!appConfig.isProduction) logger.info("Development phone OTP generated.", { phone, otp });
    const user = await this.repository.findByPhone(phone);
    return { phone, expiresIn: appConfig.otpExpiresInSeconds, resendAfter: appConfig.otpResendCooldownSeconds, requiresPassword: !user?.passwordHash };
  }

  async verifyPhoneOtp({ phone: rawPhone, otp, password }) {
    const phone = normalizePhone(rawPhone);
    const record = await this.repository.getLatestOtp(phone);
    if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= Date.now()) {
      throw new AppError("Mã OTP không tồn tại hoặc đã hết hạn.", 422, "OTP_EXPIRED");
    }
    if (Number(record.attempts || 0) >= 5) {
      throw new AppError("Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới.", 429, "OTP_TOO_MANY_ATTEMPTS");
    }
    if (!await comparePassword(String(otp), record.otp_hash)) {
      await this.repository.incrementOtpAttempts(record.id);
      throw new AppError("Mã OTP không đúng.", 422, "OTP_INVALID");
    }
    await this.repository.consumeOtp(record.id);
    const passwordHash = password ? await hashPassword(password) : null;
    let user = await this.repository.findByPhone(phone);
    user = user
      ? await this.repository.verifyPhoneAndSetPassword(user.id, passwordHash)
      : await this.repository.createPhoneUser(phone, passwordHash);
    return this.issueTokenPair(user, true);
  }

  async refresh(refreshToken) {
    if (!refreshToken) throw new AppError("Refresh token is required.", 401, "REFRESH_TOKEN_REQUIRED");
    let payload;
    try { payload = verifyRefreshToken(refreshToken); }
    catch { throw new AppError("Refresh token is invalid or expired.", 401, "INVALID_REFRESH_TOKEN"); }
    const user = await this.repository.findById(payload.sub);
    if (!user || !user.isActive() || !user.refreshTokenHash || !await comparePassword(refreshToken, user.refreshTokenHash)) {
      throw new AppError("Refresh token is invalid.", 401, "INVALID_REFRESH_TOKEN");
    }
    return this.issueTokenPair(user, Boolean(payload.remember));
  }

  async logout(refreshToken = null) {
    if (!refreshToken) return;
    try { const payload = verifyRefreshToken(refreshToken); await this.repository.revokeRefreshToken(payload.sub); }
    catch (error) { logger.warn("Logout received an invalid refresh token.", { code: error.code || error.name }); }
  }

  async issueTokenPair(user, remember = false) {
    const accessToken = signAccessToken({ sub: String(user.id), role: user.role, permissions: user.permissions });
    const refreshToken = signRefreshToken({ sub: String(user.id), remember }, remember);
    await this.repository.saveRefreshToken(user.id, await hashPassword(refreshToken), this.createRefreshExpiresAt(remember));
    return { user: user.toSafeJSON(), accessToken, refreshToken, tokenType: "Bearer", expiresIn: appConfig.jwtAccessExpiresIn, remember };
  }

  createRefreshExpiresAt(remember = false) {
    return new Date(Date.now() + parseDurationToMs(
      remember ? appConfig.jwtRememberRefreshExpiresIn : appConfig.jwtRefreshExpiresIn,
      remember ? 2592000000 : 604800000
    ));
  }
}

function normalizePhone(value) {
  const phone = String(value || "").trim().replace(/[\s.-]/g, "").replace(/^\+84/, "0");
  if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) throw new AppError("Số điện thoại không hợp lệ.", 422, "INVALID_PHONE");
  return phone;
}

function oauthConfig(provider) {
  if (provider === "google") return {
    label: "Google", clientId: appConfig.googleClientId, clientSecret: appConfig.googleClientSecret,
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    authorizationParams: state => ({ client_id: appConfig.googleClientId, redirect_uri: appConfig.googleCallbackUrl, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }),
    tokenUrl: "https://oauth2.googleapis.com/token",
    tokenRequest: code => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: appConfig.googleClientId, client_secret: appConfig.googleClientSecret, redirect_uri: appConfig.googleCallbackUrl, grant_type: "authorization_code" }) }),
    profileUrl: token => `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${encodeURIComponent(token)}`,
    mapProfile: p => ({ providerId: String(p.id), email: p.email || null, fullName: p.name || "Khách hàng Google", avatarUrl: p.picture || null })
  };
  if (provider === "facebook") return {
    label: "Facebook", clientId: appConfig.facebookAppId, clientSecret: appConfig.facebookAppSecret,
    authorizationUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    authorizationParams: state => ({ client_id: appConfig.facebookAppId, redirect_uri: appConfig.facebookCallbackUrl, response_type: "code", scope: "email,public_profile", state }),
    tokenUrl: code => `https://graph.facebook.com/v20.0/oauth/access_token?${new URLSearchParams({ client_id: appConfig.facebookAppId, client_secret: appConfig.facebookAppSecret, redirect_uri: appConfig.facebookCallbackUrl, code })}`,
    tokenRequest: code => ({ method: "GET", headers: { Accept: "application/json" }, redirect: "follow", ...(code ? { } : {}) , body: undefined, signal: undefined }),
    profileUrl: token => `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(token)}`,
    mapProfile: p => ({ providerId: String(p.id), email: p.email || `facebook_${p.id}@facebook.local`, fullName: p.name || "Khách hàng Facebook", avatarUrl: p.picture?.data?.url || null })
  };
  throw new AppError("OAuth provider không hợp lệ.", 400, "INVALID_OAUTH_PROVIDER");
}



