/**
 * Centralized error handler.
 * Controllers and services throw AppError; unexpected errors are normalized here.
 */
import { appConfig } from "../config/app.config.js";
import { ApiResponse } from "../utils/api-response.util.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";

export function errorHandler(error, request, response, next) {
  const normalizedError = error instanceof AppError
    ? error
    : new AppError("Internal server error.", 500, "INTERNAL_SERVER_ERROR");
  const details = normalizedError.statusCode < 500 || appConfig.env === "development"
    ? normalizedError.details
    : null;

  logger.error(normalizedError.message, {
    code: normalizedError.code,
    statusCode: normalizedError.statusCode,
    path: request.originalUrl,
    method: request.method,
    stack: appConfig.env === "development" ? error.stack : undefined
  });

  return response
    .status(normalizedError.statusCode)
    .json(ApiResponse.error(
      normalizedError.message,
      normalizedError.code,
      details,
      normalizedError.statusCode
    ));
}
