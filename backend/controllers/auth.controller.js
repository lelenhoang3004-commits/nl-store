import crypto from "node:crypto";
import { appConfig } from "../config/app.config.js";
import { BaseController } from "./base.controller.js";
import { AuthService } from "../services/auth.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";
import { clearRefreshCookie, createRefreshCookieOptions } from "../utils/token.util.js";
import { logger } from "../utils/logger.util.js";

const OAUTH_STATE_COOKIE = "fashion_oauth_state";

export class AuthController extends BaseController {
  constructor(service = new AuthService()) { super(); this.service = service; }

  login = asyncHandler(async (req, res) => {
    const result = await this.service.login(req.body); this.setRefreshCookie(res, result, Boolean(req.body.remember));
    return this.sendSuccess(res, publicTokenResult(result), "Đăng nhập thành công.");
  });
  register = asyncHandler(async (req, res) => this.sendSuccess(res, await this.service.register(req.body), "Đăng ký thành công.", 201));
  sendPhoneOtp = asyncHandler(async (req, res) => this.sendSuccess(res, await this.service.sendPhoneOtp(req.body.phone), "Mã OTP đã được tạo."));
  verifyPhoneOtp = asyncHandler(async (req, res) => {
    const result = await this.service.verifyPhoneOtp(req.body); this.setRefreshCookie(res, result, true);
    return this.sendSuccess(res, publicTokenResult(result), "Xác thực và đăng nhập thành công.");
  });
  oauthStart = provider => asyncHandler(async (req, res) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    const state = crypto.randomBytes(24).toString("hex");
    const authorizationUrl = this.service.getOAuthAuthorization(provider, state);
    res.cookie(OAUTH_STATE_COOKIE, state, { httpOnly: true, signed: true, secure: appConfig.isProduction, sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/api/v1/auth" });
    return res.redirect(authorizationUrl);
  });
  oauthCallback = provider => asyncHandler(async (req, res) => {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    const state = req.signedCookies?.[OAUTH_STATE_COOKIE];
    if (!state || state !== req.query.state) {
      return redirectOAuthError(res, "Phiên đăng nhập OAuth không hợp lệ.", provider);
    }

    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/v1/auth" });

    try {
      const result = await this.service.handleOAuthCallback(provider, req.query.code);
      this.setRefreshCookie(res, result, true);

      const redirectUrl = createOAuthSuccessRedirectUrl(appConfig.customerAuthCallbackUrl, {
        token: result.accessToken,
        user: Buffer.from(JSON.stringify(result.user)).toString("base64url"),
        provider
      });

      if (provider === "google") {
        logger.info("[Google OAuth] callback success");
        logger.info("[Google OAuth] user id/email", {
          userId: result.user?.id,
          email: result.user?.email
        });
        logger.info("[Google OAuth] redirect url", {
          redirectUrl: redactOAuthToken(redirectUrl)
        });
      }

      return res.redirect(redirectUrl);
    } catch (error) {
      if (provider === "google") {
        logger.error("[Google OAuth] callback failed", {
          message: error?.message,
          code: error?.code
        });
      }
      return redirectOAuthError(res, error.message || "Đăng nhập OAuth thất bại.", provider);
    }
  });
  refresh = asyncHandler(async (req, res) => {
    const result = await this.service.refresh(req.signedCookies?.[appConfig.refreshCookieName]); this.setRefreshCookie(res, result, result.remember);
    return this.sendSuccess(res, publicTokenResult(result), "Token refreshed successfully.");
  });
  logout = asyncHandler(async (req, res) => { await this.service.logout(req.signedCookies?.[appConfig.refreshCookieName]); clearRefreshCookie(res); return this.sendSuccess(res, null, "Logout successful."); });
  me = asyncHandler(async (req, res) => this.sendSuccess(res, { user: req.user }, "Current session retrieved successfully."));
  setRefreshCookie(res, result, remember) { res.cookie(appConfig.refreshCookieName, result.refreshToken, createRefreshCookieOptions(remember)); }
}
function publicTokenResult(r) { return { user: r.user, accessToken: r.accessToken, tokenType: r.tokenType, expiresIn: r.expiresIn }; }
function createOAuthSuccessRedirectUrl(callbackUrl, params) {
  const url = new URL(callbackUrl);
  const rawHash = url.hash.replace(/^#/, "");
  const separatorIndex = rawHash.indexOf("?");
  const route = (separatorIndex >= 0 ? rawHash.slice(0, separatorIndex) : rawHash) || "auth-callback";
  const hashParams = new URLSearchParams(separatorIndex >= 0 ? rawHash.slice(separatorIndex + 1) : "");

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      hashParams.set(key, String(value));
    }
  });

  url.hash = [route, hashParams.toString()].filter(Boolean).join("?");
  return url.toString();
}

function redirectOAuthError(res, message, provider = "google") {
  const url = new URL(appConfig.customerAuthCallbackUrl);
  const params = new URLSearchParams({ error: message, provider });
  url.hash = `login?${params.toString()}`;
  return res.redirect(url.toString());
}

function redactOAuthToken(redirectUrl) {
  return redirectUrl.replace(/([?&]token=)[^&]+/i, "$1[REDACTED]");
}
