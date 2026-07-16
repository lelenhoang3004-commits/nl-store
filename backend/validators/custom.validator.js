/**
 * Custom validator helpers.
 * They allow modules to define business-specific rules while keeping a common result shape.
 */
import { createValidationError, createValidationResult, mergeValidationResults } from "./base.validator.js";

export function createCustomValidator({ field, location = "body", code = "CUSTOM_VALIDATION_ERROR", message, validate }) {
  return (value, context = {}) => {
    const isValid = validate(value, context);

    return isValid
      ? createValidationResult()
      : createValidationResult([createValidationError(field, message, location, code)]);
  };
}

export function composeValidators(validators = []) {
  return (payload) => {
    const results = validators.map((validator) => validator(payload));
    return mergeValidationResults(results);
  };
}

export function validateAllowedValue(value, allowedValues = [], options = {}) {
  const field = options.field || "status";
  const location = options.location || "body";

  if (allowedValues.includes(value)) {
    return createValidationResult();
  }

  return createValidationResult([
    createValidationError(field, `${field} must be one of: ${allowedValues.join(", ")}.`, location, "VALUE_NOT_ALLOWED")
  ]);
}
