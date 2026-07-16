/**
 * Global security middleware.
 * Security concerns stay centralized so feature modules do not duplicate headers, CORS, or compression logic.
 */
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import { securityConfig } from "../config/security.config.js";
import { AppError } from "../utils/app-error.util.js";
import { originGuard } from "./origin-guard.middleware.js";
import { apiRateLimiter } from "./rate-limit.middleware.js";

export function applySecurityMiddleware(app) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet(securityConfig.helmet));
  app.use(compression());
  app.use(cors({
    ...securityConfig.cors,
    origin(origin, callback) {
      if (!origin || securityConfig.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new AppError("CORS origin is not allowed.", 403, "CORS_ORIGIN_FORBIDDEN"));
    }
  }));
  app.use(originGuard);
  app.use(apiRateLimiter);
}
