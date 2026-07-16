import { createValidationError, createValidationResult, isEmpty } from "./base.validator.js";

const ALLOWED_DAYS = [7, 14, 30];

export function validateAdminDashboardOverviewRequest({ query }) {
  return mergeErrors(
    validateRevenueQuery(query),
    validateOptionalLimit(query.topLimit, "topLimit"),
    validateOptionalLimit(query.recentLimit, "recentLimit")
  );
}

export function validateAdminDashboardRevenueRequest({ query }) {
  return createValidationResult(validateRevenueQuery(query));
}

export function validateAdminDashboardLimitRequest({ query }) {
  return createValidationResult(validateOptionalLimit(query.limit, "limit"));
}

function validateRevenueQuery(query) {
  const errors = [];
  if (!isEmpty(query.days) && !ALLOWED_DAYS.includes(Number(query.days))) {
    errors.push(createValidationError("days", "days must be one of 7, 14 or 30.", "query", "INVALID_DASHBOARD_DAYS"));
  }
  validateDate(errors, query.dateFrom, "dateFrom");
  validateDate(errors, query.dateTo, "dateTo");
  if (!isEmpty(query.dateFrom) && !isEmpty(query.dateTo) && Date.parse(query.dateFrom) > Date.parse(query.dateTo)) {
    errors.push(createValidationError("dateTo", "dateTo must be on or after dateFrom.", "query", "INVALID_DASHBOARD_DATE_RANGE"));
  }
  return errors;
}

function validateOptionalLimit(value, field) {
  if (isEmpty(value)) return [];
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= 20
    ? []
    : [createValidationError(field, `${field} must be an integer from 1 to 20.`, "query", "INVALID_DASHBOARD_LIMIT")];
}

function validateDate(errors, value, field) {
  if (!isEmpty(value) && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    errors.push(createValidationError(field, `${field} must use YYYY-MM-DD format.`, "query", "INVALID_DASHBOARD_DATE"));
  } else if (!isEmpty(value)) {
    const date = new Date(`${value}T00:00:00`);
    const normalized = Number.isNaN(date.getTime())
      ? ""
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (normalized !== value) {
      errors.push(createValidationError(field, `${field} must be a valid date.`, "query", "INVALID_DASHBOARD_DATE"));
    }
  }
}

function mergeErrors(...groups) {
  return createValidationResult(groups.flat());
}
