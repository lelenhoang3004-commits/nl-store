/**
 * Express application factory.
 * This file wires global middleware, route registry, static assets, and error handlers.
 * Business feature modules stay mounted through the route registry.
 */
import express from "express";
import cookieParser from "cookie-parser";
import { appConfig } from "./config/app.config.js";
import { applySecurityMiddleware } from "./middleware/security.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { csrfProtection } from "./middleware/csrf.middleware.js";
import { notFoundHandler } from "./middleware/not-found.middleware.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import { sanitizeRequest } from "./middleware/sanitize-request.middleware.js";
import { checkDatabaseHealth } from "./utils/database.util.js";
import routes from "./routes/index.js";

const app = express();

applySecurityMiddleware(app);

app.use(express.json({ limit: appConfig.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: appConfig.requestBodyLimit }));
app.use(cookieParser(appConfig.cookieSecret));
app.use(sanitizeRequest);
app.use(csrfProtection);
app.use(requestLogger);
app.use("/public", express.static(appConfig.publicPath, {
  fallthrough: false,
  immutable: appConfig.isProduction,
  maxAge: appConfig.isProduction ? "1d" : 0
}));
app.use("/uploads", express.static(appConfig.uploadPath, {
  fallthrough: false,
  maxAge: appConfig.isProduction ? "1h" : 0,
  setHeaders(response) {
    // The storefront/admin are commonly served by Live Server on another
    // origin, so uploaded product images must be embeddable cross-origin.
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
}));
app.get("/health", async (request, response) => {
  const database = await checkDatabaseHealth();
  const statusCode = database.healthy ? 200 : 503;

  response.status(statusCode).json({
    success: database.healthy,
    message: database.healthy ? "Backend service is healthy." : "Backend service is degraded.",
    data: {
      status: database.healthy ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: appConfig.env,
      database
    }
  });
});
app.use(appConfig.apiPrefix, routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
