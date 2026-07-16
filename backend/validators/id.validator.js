/**
 * ID validator.
 * It validates numeric database identifiers without assuming a specific table.
 */
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

export function validateId(value, options = {}) {
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

  if (isEmpty(value)) {
    return createValidationResult(errors);
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    errors.push(createValidationError(field, `${field} must be a positive integer.`, location, "INVALID_ID"));
  }

  return createValidationResult(errors);
}
