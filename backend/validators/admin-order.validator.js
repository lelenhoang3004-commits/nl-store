import { createValidationError, createValidationResult, isEmpty, mergeValidationResults, validateRequired } from "./base.validator.js";
import { validateId } from "./id.validator.js";
import { validatePagination } from "./pagination.validator.js";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipping", "completed", "cancelled", "refunded"];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "refunded", "failed"];
const SORT_FIELDS = ["createdAt", "updatedAt", "orderCode", "customerName", "grandTotal", "status", "paymentStatus"];

export function validateAdminOrderListRequest({ query }) {
  const errors = [];
  validateAllowed(errors, query.status, "status", ORDER_STATUSES);
  validateAllowed(errors, query.paymentStatus, "paymentStatus", PAYMENT_STATUSES);
  validateAllowed(errors, query.sortBy, "sortBy", SORT_FIELDS);
  validateAllowed(errors, query.sortDirection, "sortDirection", ["asc", "desc"]);
  validateOptionalDate(errors, query.dateFrom, "dateFrom");
  validateOptionalDate(errors, query.dateTo, "dateTo");

  if (!isEmpty(query.search) && String(query.search).length > 150) {
    errors.push(createValidationError("search", "search must not exceed 150 characters.", "query", "ADMIN_ORDER_SEARCH_TOO_LONG"));
  }
  if (!isEmpty(query.paymentMethod) && String(query.paymentMethod).length > 50) {
    errors.push(createValidationError("paymentMethod", "paymentMethod must not exceed 50 characters.", "query", "ADMIN_ORDER_PAYMENT_METHOD_TOO_LONG"));
  }
  if (!isEmpty(query.dateFrom) && !isEmpty(query.dateTo) && Date.parse(query.dateFrom) > Date.parse(query.dateTo)) {
    errors.push(createValidationError("dateTo", "dateTo must be on or after dateFrom.", "query", "INVALID_ADMIN_ORDER_DATE_RANGE"));
  }
  return mergeValidationResults([validatePagination(query), createValidationResult(errors)]);
}

export function validateAdminOrderIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateAdminOrderStatusRequest({ params, body }) {
  const errors = [];
  const requiredError = validateRequired(body.status, "status", "body");
  if (requiredError) errors.push(requiredError);
  validateAllowed(errors, body.status, "status", ORDER_STATUSES, "body");
  if (!isEmpty(body.note) && String(body.note).length > 500) {
    errors.push(createValidationError("note", "note must not exceed 500 characters.", "body", "ADMIN_ORDER_NOTE_TOO_LONG"));
  }
  return mergeValidationResults([validateAdminOrderIdRequest({ params }), createValidationResult(errors)]);
}

export function validateAdminOrderCancelRequest({ params, body }) {
  const errors = [];
  if (!isEmpty(body.reason) && String(body.reason).length > 500) {
    errors.push(createValidationError("reason", "reason must not exceed 500 characters.", "body", "ADMIN_ORDER_CANCEL_REASON_TOO_LONG"));
  }
  return mergeValidationResults([validateAdminOrderIdRequest({ params }), createValidationResult(errors)]);
}

function validateAllowed(errors, value, field, allowedValues, location = "query") {
  if (!isEmpty(value) && !allowedValues.includes(String(value))) {
    errors.push(createValidationError(field, `${field} is invalid.`, location, `INVALID_ADMIN_ORDER_${field.toUpperCase()}`));
  }
}

function validateOptionalDate(errors, value, field) {
  if (!isEmpty(value) && Number.isNaN(Date.parse(value))) {
    errors.push(createValidationError(field, `${field} must be a valid date.`, "query", "INVALID_ADMIN_ORDER_DATE"));
  }
}
