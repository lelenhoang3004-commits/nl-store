/**
 * Price validator.
 * It validates numeric currency values before services or repositories receive them.
 */
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

const DEFAULT_MAX_PRICE = 999999999;

export function validatePrice(value, options = {}) {
  const field = options.field || "price";
  const location = options.location || "body";
  const min = options.min ?? 0;
  const max = options.max ?? DEFAULT_MAX_PRICE;
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

  const price = Number(value);

  if (!Number.isFinite(price)) {
    errors.push(createValidationError(field, `${field} must be a valid number.`, location, "INVALID_PRICE"));
    return createValidationResult(errors);
  }

  if (price < min) {
    errors.push(createValidationError(field, `${field} must be greater than or equal to ${min}.`, location, "PRICE_TOO_LOW"));
  }

  if (price > max) {
    errors.push(createValidationError(field, `${field} must be less than or equal to ${max}.`, location, "PRICE_TOO_HIGH"));
  }

  return createValidationResult(errors);
}
