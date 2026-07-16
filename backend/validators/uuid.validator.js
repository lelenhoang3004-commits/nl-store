/**
 * UUID validator.
 * It validates UUID route params or request fields using the existing uuid dependency.
 */
import { validate as validateUuidValue } from "uuid";
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

export function validateUuid(value, options = {}) {
  const field = options.field || "id";
  const location = options.location || "params";
  const errors = [];

  if (options.required) {
    const requiredError = validateRequired(value, field, location);

    if (requiredError) {
      errors.push(requiredError);
      return createValidationResult(errors);
    }
  }

  if (!isEmpty(value) && !validateUuidValue(String(value))) {
    errors.push(createValidationError(field, `${field} must be a valid UUID.`, location, "INVALID_UUID"));
  }

  return createValidationResult(errors);
}
