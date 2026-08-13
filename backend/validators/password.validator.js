/**
 * Password validator.
 * It enforces a production-friendly password policy that can be reused by auth modules later.
 */
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

const DEFAULT_MIN_LENGTH = 8;
const DEFAULT_MAX_LENGTH = 72;
export const STRONG_PASSWORD_MESSAGE = "Mật khẩu chưa hợp lệ. Vui lòng kiểm tra lại các yêu cầu về mật khẩu.";
export const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\dA-Za-z]).{8,}$/;

export function validatePassword(value, options = {}) {
  const field = options.field || "password";
  const location = options.location || "body";
  const minLength = options.minLength || DEFAULT_MIN_LENGTH;
  const maxLength = options.maxLength || DEFAULT_MAX_LENGTH;
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

  const password = String(value);

  if (options.strong !== false && minLength === DEFAULT_MIN_LENGTH && !STRONG_PASSWORD_PATTERN.test(password)) {
    errors.push(createValidationError(field, STRONG_PASSWORD_MESSAGE, location, "PASSWORD_POLICY_INVALID"));
    return createValidationResult(errors);
  }

  if (password.length < minLength) {
    errors.push(createValidationError(field, `Mật khẩu phải có ít nhất ${minLength} ký tự.`, location, "PASSWORD_TOO_SHORT"));
  }

  if (password.length > maxLength) {
    errors.push(createValidationError(field, `Mật khẩu không được vượt quá ${maxLength} ký tự.`, location, "PASSWORD_TOO_LONG"));
  }

  if (options.strong !== false && !/[A-Z]/.test(password)) {
    errors.push(createValidationError(field, STRONG_PASSWORD_MESSAGE, location, "PASSWORD_MISSING_UPPERCASE"));
  }

  if (options.strong !== false && !/[a-z]/.test(password)) {
    errors.push(createValidationError(field, STRONG_PASSWORD_MESSAGE, location, "PASSWORD_MISSING_LOWERCASE"));
  }

  if (options.strong !== false && !/\d/.test(password)) {
    errors.push(createValidationError(field, STRONG_PASSWORD_MESSAGE, location, "PASSWORD_MISSING_NUMBER"));
  }

  if (options.strong !== false && !/[^\dA-Za-z]/.test(password)) {
    errors.push(createValidationError(field, STRONG_PASSWORD_MESSAGE, location, "PASSWORD_MISSING_SPECIAL"));
  }

  return createValidationResult(errors);
}
