import {
  createValidationError,
  createValidationResult,
  isEmpty,
  mergeValidationResults,
  validateRequired
} from "./base.validator.js";
import { validateId } from "./id.validator.js";
import { validatePagination } from "./pagination.validator.js";
import { validatePrice } from "./price.validator.js";

const DISCOUNT_TYPES = ["percentage", "fixed"];
const VOUCHER_STATUSES = ["active", "inactive", "expired"];
const CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export function validateVoucherListRequest({ query }) {
  const errors = [];
  validateAllowed(errors, query.status, "status", VOUCHER_STATUSES, "query", "INVALID_VOUCHER_STATUS");
  return mergeValidationResults([validatePagination(query), createValidationResult(errors)]);
}

export function validateVoucherIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateVoucherRequest({ body }) {
  return validateVoucherPayload(body, { requireRequiredFields: true });
}

export function validateUpdateVoucherRequest({ params, body }) {
  return mergeValidationResults([validateVoucherIdRequest({ params }), validateVoucherPayload(body, { requireRequiredFields: true })]);
}

export function validateVoucherStatusRequest({ params, body }) {
  const errors = [...validateVoucherIdRequest({ params }).errors];
  pushIfError(errors, validateRequired(body.status, "status", "body"));
  validateAllowed(errors, body.status, "status", VOUCHER_STATUSES, "body", "INVALID_VOUCHER_STATUS");
  return createValidationResult(errors);
}

export function validateVoucherApplyRequest({ body }) {
  const errors = [];
  pushIfError(errors, validateRequired(body.code, "code", "body"));
  if (!isEmpty(body.code) && !CODE_REGEX.test(String(body.code).toUpperCase())) {
    errors.push(createValidationError("code", "code must be 3-40 uppercase letters, numbers, underscores, or hyphens.", "body", "INVALID_VOUCHER_CODE"));
  }
  errors.push(...validatePrice(body.orderTotal, { required: true, field: "orderTotal", location: "body" }).errors);
  return createValidationResult(errors);
}

function validateVoucherPayload(body = {}, options = {}) {
  const errors = [];
  const discountType = normalizeDiscountType(body.discountType ?? body.discount_type);

  if (options.requireRequiredFields) {
    pushIfError(errors, validateRequired(body.code, "code", "body"));
    pushIfError(errors, validateRequired(body.name, "name", "body"));
    pushIfError(errors, validateRequired(discountType, "discountType", "body"));
    pushIfError(errors, validateRequired(body.discountValue ?? body.discount_value, "discountValue", "body"));
  }

  if (!isEmpty(body.code) && !CODE_REGEX.test(String(body.code).toUpperCase())) {
    errors.push(createValidationError("code", "code must be 3-40 uppercase letters, numbers, underscores, or hyphens.", "body", "INVALID_VOUCHER_CODE"));
  }
  if (!isEmpty(body.name) && String(body.name).length > 160) errors.push(createValidationError("name", "name must not exceed 160 characters.", "body", "VOUCHER_NAME_TOO_LONG"));
  if (!isEmpty(body.description) && String(body.description).length > 1000) errors.push(createValidationError("description", "description must not exceed 1000 characters.", "body", "VOUCHER_DESCRIPTION_TOO_LONG"));

  validateAllowed(errors, discountType, "discountType", DISCOUNT_TYPES, "body", "INVALID_DISCOUNT_TYPE");
  validateMoney(errors, body.discountValue ?? body.discount_value, "discountValue", true);
  validateMoney(errors, body.maxDiscountAmount ?? body.max_discount_amount, "maxDiscountAmount", false);
  validateMoney(errors, body.minOrderAmount ?? body.min_order_amount, "minOrderAmount", false);
  validateInteger(errors, body.quantity ?? body.usageLimit ?? body.usage_limit, "quantity", 1, false);
  validateInteger(errors, body.usedQuantity ?? body.used_quantity ?? body.usedCount ?? body.used_count, "usedQuantity", 0, false);
  validateDate(errors, body.startsAt ?? body.starts_at ?? body.startDate ?? body.start_date, "startsAt");
  validateDate(errors, body.expiresAt ?? body.expires_at ?? body.endDate ?? body.end_date, "expiresAt");
  validateAllowed(errors, body.status, "status", VOUCHER_STATUSES, "body", "INVALID_VOUCHER_STATUS");

  const discountValue = Number(body.discountValue ?? body.discount_value ?? 0);
  if (discountType === "percentage" && discountValue > 100) errors.push(createValidationError("discountValue", "percentage discountValue must not exceed 100.", "body", "VOUCHER_PERCENT_TOO_HIGH"));
  const startsAt = body.startsAt ?? body.starts_at ?? body.startDate ?? body.start_date;
  const expiresAt = body.expiresAt ?? body.expires_at ?? body.endDate ?? body.end_date;
  if (!isEmpty(startsAt) && !isEmpty(expiresAt) && new Date(startsAt) > new Date(expiresAt)) errors.push(createValidationError("expiresAt", "expiresAt must be after startsAt.", "body", "VOUCHER_DATE_RANGE_INVALID"));

  return createValidationResult(errors);
}

function normalizeDiscountType(value) { return String(value || "").trim().toLowerCase() === "percent" ? "percentage" : String(value || "").trim().toLowerCase(); }
function validateMoney(errors, value, field, required) { if (required || !isEmpty(value)) errors.push(...validatePrice(value, { required, field, location: "body" }).errors); }
function validateInteger(errors, value, field, min, required) { if (isEmpty(value)) { if (required) errors.push(createValidationError(field, `${field} is required.`, "body", "REQUIRED")); return; } const n = Number(value); if (!Number.isInteger(n) || n < min) errors.push(createValidationError(field, `${field} must be an integer greater than or equal to ${min}.`, "body", "INVALID_VOUCHER_INTEGER")); }
function validateDate(errors, value, field) { if (!isEmpty(value) && Number.isNaN(Date.parse(value))) errors.push(createValidationError(field, `${field} must be a valid date.`, "body", "INVALID_VOUCHER_DATE")); }
function validateAllowed(errors, value, field, allowedValues, location, code) { if (!isEmpty(value) && !allowedValues.includes(value)) errors.push(createValidationError(field, `${field} is invalid.`, location, code)); }
function pushIfError(errors, error) { if (error) errors.push(error); }
