/**
 * Base validator helpers.
 * Validators return a predictable result object consumed by validateRequest middleware.
 */
export const VALIDATION_LOCATIONS = Object.freeze({
  BODY: "body",
  PARAMS: "params",
  QUERY: "query",
  FILE: "file"
});

export function createValidationResult(errors = []) {
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createValidationError(field, message, location = VALIDATION_LOCATIONS.BODY, code = "INVALID_VALUE") {
  return {
    field,
    message,
    location,
    code
  };
}

export function required(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return `${fieldName} is required.`;
  }

  return null;
}

export function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function validateRequired(value, fieldName, location = VALIDATION_LOCATIONS.BODY) {
  return isEmpty(value)
    ? createValidationError(fieldName, `${fieldName} is required.`, location, "REQUIRED")
    : null;
}

export function runValidationRules(rules = []) {
  const errors = rules
    .map((rule) => rule())
    .filter(Boolean);

  return createValidationResult(errors);
}

export function mergeValidationResults(results = []) {
  const errors = results.flatMap((result) => result.errors || []);
  return createValidationResult(errors);
}
