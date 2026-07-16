/**
 * Validation middleware factory.
 * Feature modules can pass validator functions later without coupling validation to controllers.
 */
import { AppError } from "../utils/app-error.util.js";

export function validateRequest(schemaValidator) {
  return (request, response, next) => {
    const result = schemaValidator({
      body: request.body,
      params: request.params,
      query: request.query
    });

    if (!result.isValid) {
      return next(new AppError("Validation failed.", 422, "VALIDATION_ERROR", result.errors));
    }

    return next();
  };
}
