/**
 * Email validator.
 * It validates common email input without coupling validation rules to any module.
 */
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value, options = {}) {
  const field = options.field || "email";
  const location = options.location || "body";
  const errors = [];

  if (options.required) {
    const requiredError = validateRequired(value, field, location);

    if (requiredError) {
      errors.push(requiredError);
      return createValidationResult(errors);
    }
  }

  if (!isEmpty(value) && !EMAIL_REGEX.test(String(value).trim())) {
    errors.push(createValidationError(field, `${field} must be a valid email address.`, location, "INVALID_EMAIL"));
  }

  return createValidationResult(errors);
}
