/**
 * Rate limit middleware.
 * It protects the API from abusive traffic and keeps the response format consistent.
 */
import rateLimit from "express-rate-limit";
import { appConfig } from "../config/app.config.js";
import { ApiResponse } from "../utils/api-response.util.js";

export const apiRateLimiter = rateLimit({
  windowMs: appConfig.rateLimitWindowMs,
  max: appConfig.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler(request, response) {
    return response
      .status(429)
      .json(ApiResponse.error("Too many requests. Please try again later.", "RATE_LIMIT_EXCEEDED", null, 429));
  }
});

export const authRateLimiter = rateLimit({
  windowMs: appConfig.authRateLimitWindowMs,
  max: appConfig.authRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler(request, response) {
    return response
      .status(429)
      .json(ApiResponse.error("Too many authentication attempts. Please try again later.", "AUTH_RATE_LIMIT_EXCEEDED", null, 429));
  }
});

export const uploadRateLimiter = rateLimit({
  windowMs: appConfig.uploadRateLimitWindowMs,
  max: appConfig.uploadRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler(request, response) {
    return response
      .status(429)
      .json(ApiResponse.error("Too many upload requests. Please try again later.", "UPLOAD_RATE_LIMIT_EXCEEDED", null, 429));
  }
});
