/**
 * Security configuration.
 * Centralizing browser-facing security policy keeps Helmet, CORS, CSRF checks, uploads, and cookies consistent.
 */
import { appConfig } from "./app.config.js";

export const securityConfig = Object.freeze({
  allowedOrigins: appConfig.clientOrigins,
  cors: {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", appConfig.csrfHeaderName, "X-CSRF-Token"]
  },
  helmet: {
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", ...appConfig.clientOrigins]
      }
    }
  },
  cookie: {
    httpOnly: true,
    secure: appConfig.isProduction,
    sameSite: appConfig.isProduction ? "none" : "lax",
    signed: true
  },
  csrf: {
    enabled: appConfig.csrfEnabled,
    cookieName: appConfig.csrfCookieName,
    headerName: appConfig.csrfHeaderName,
    protectedMethods: ["POST", "PUT", "PATCH", "DELETE"]
  }
});
