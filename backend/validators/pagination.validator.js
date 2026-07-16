/**
 * Pagination validator.
 * It validates list query parameters before query-options parsing is used.
 */
import { createValidationError, createValidationResult, isEmpty } from "./base.validator.js";

const DEFAULT_MAX_LIMIT = 100;

export function validatePagination(query = {}, options = {}) {
  const location = options.location || "query";
  const maxLimit = options.maxLimit || DEFAULT_MAX_LIMIT;
  const errors = [];

  validatePositiveInteger(query.page, "page", location, errors);
  validatePositiveInteger(query.limit, "limit", location, errors);

  if (!isEmpty(query.limit) && Number(query.limit) > maxLimit) {
    errors.push(createValidationError("limit", `limit must not exceed ${maxLimit}.`, location, "LIMIT_TOO_HIGH"));
  }

  return createValidationResult(errors);
}

function validatePositiveInteger(value, field, location, errors) {
  if (isEmpty(value)) {
    return;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    errors.push(createValidationError(field, `${field} must be a positive integer.`, location, "INVALID_PAGINATION_VALUE"));
  }
}
