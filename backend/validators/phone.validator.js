/**
 * Phone validator.
 * It supports Vietnamese mobile numbers and normalized international phone numbers.
 */
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

const VIETNAM_PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
const INTERNATIONAL_PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export function validatePhone(value, options = {}) {
  const field = options.field || "phone";
  const location = options.location || "body";
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

  const phone = String(value).replace(/[\s.-]/g, "");
  const regex = options.country === "VN" ? VIETNAM_PHONE_REGEX : INTERNATIONAL_PHONE_REGEX;

  if (!regex.test(phone)) {
    errors.push(createValidationError(field, `${field} must be a valid phone number.`, location, "INVALID_PHONE"));
  }

  return createValidationResult(errors);
}
