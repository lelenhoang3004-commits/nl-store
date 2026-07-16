/**
 * Dashboard validators.
 * They validate query parameters for charts and ranking endpoints.
 */
import { createValidationError, createValidationResult, isEmpty } from "./base.validator.js";

export function validateDashboardMonthsRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.months)) {
    const months = Number(query.months);

    if (!Number.isInteger(months) || months < 1 || months > 24) {
      errors.push(createValidationError("months", "months must be an integer from 1 to 24.", "query", "INVALID_DASHBOARD_MONTHS"));
    }
  }

  return createValidationResult(errors);
}

export function validateDashboardLimitRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.limit)) {
    const limit = Number(query.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      errors.push(createValidationError("limit", "limit must be an integer from 1 to 50.", "query", "INVALID_DASHBOARD_LIMIT"));
    }
  }

  return createValidationResult(errors);
}
