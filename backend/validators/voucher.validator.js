import {
  createValidationError,
  createValidationResult,
  isEmpty,
  mergeValidationResults,
  validateRequired
} from "./base.validator.js";
import { validateId } from "./id.validator.js";
import { validatePagination } from "./pagination.validator.js";

const DISCOUNT_TYPES = ["percentage", "fixed_amount", "fixed"];
const VOUCHER_STATUSES = ["active", "inactive"];
const CODE_REGEX = /^[A-Z0-9_-]{3,40}$/;

export function validateVoucherListRequest({ query }) {
  const errors = [];
  validateAllowed(errors, query.status, "status", VOUCHER_STATUSES, "query", "INVALID_VOUCHER_STATUS");
  return mergeValidationResults([validatePagination(query), createValidationResult(errors)]);
}

export function validateVoucherIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateVoucherRequest({ body }) {
  return validateVoucherPayload(body, { requireRequiredFields: true, creating: true });
}

export function validateUpdateVoucherRequest({ params, body }) {
  return mergeValidationResults([validateVoucherIdRequest({ params }), validateVoucherPayload(body, { requireRequiredFields: true, creating: false })]);
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
  validateCode(errors, body.code);
  validateMoney(errors, body.orderTotal, "orderTotal", true);
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
    pushIfError(errors, validateRequired(body.quantity ?? body.usageLimit ?? body.usage_limit, "quantity", "body"));
  }

  validateCode(errors, body.code);
  if (!isEmpty(body.name) && String(body.name).trim().length > 160) errors.push(createValidationError("name", "name must not exceed 160 characters.", "body", "VOUCHER_NAME_TOO_LONG"));
  if (!isEmpty(body.description) && String(body.description).length > 1000) errors.push(createValidationError("description", "description must not exceed 1000 characters.", "body", "VOUCHER_DESCRIPTION_TOO_LONG"));

  validateAllowed(errors, discountType, "discountType", ["percentage", "fixed_amount"], "body", "INVALID_DISCOUNT_TYPE");
  validateMoney(errors, body.discountValue ?? body.discount_value, "discountValue", true);
  validateMoney(errors, body.minOrderAmount ?? body.min_order_amount, "minOrderAmount", false);
  if (discountType === "percentage") validateMoney(errors, body.maxDiscountAmount ?? body.max_discount_amount, "maxDiscountAmount", false);
  validateInteger(errors, body.quantity ?? body.usageLimit ?? body.usage_limit, "quantity", 1, true);
  if (!options.creating) validateInteger(errors, body.usedQuantity ?? body.used_quantity ?? body.usedCount ?? body.used_count, "usedQuantity", 0, false);
  validateDate(errors, body.startsAt ?? body.starts_at ?? body.startDate ?? body.start_date, "startsAt");
  validateDate(errors, body.expiresAt ?? body.expires_at ?? body.endDate ?? body.end_date, "expiresAt");
  validateAllowed(errors, body.status, "status", VOUCHER_STATUSES, "body", "INVALID_VOUCHER_STATUS");
  validateConditions(errors, body.conditions);

  const discountValue = Number(body.discountValue ?? body.discount_value ?? 0);
  if (discountType === "percentage" && (discountValue < 1 || discountValue > 100)) errors.push(createValidationError("discountValue", "percentage discountValue must be between 1 and 100.", "body", "VOUCHER_PERCENT_INVALID"));
  if (discountType === "fixed_amount" && discountValue <= 0) errors.push(createValidationError("discountValue", "fixed_amount discountValue must be greater than 0.", "body", "INVALID_DISCOUNT_VALUE"));
  const startsAt = body.startsAt ?? body.starts_at ?? body.startDate ?? body.start_date;
  const expiresAt = body.expiresAt ?? body.expires_at ?? body.endDate ?? body.end_date;
  if (!isEmpty(startsAt) && !isEmpty(expiresAt) && new Date(startsAt) >= new Date(expiresAt)) errors.push(createValidationError("expiresAt", "expiresAt must be after startsAt.", "body", "VOUCHER_DATE_RANGE_INVALID"));

  return createValidationResult(errors);
}

function normalizeDiscountType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "fixed" ? "fixed_amount" : normalized;
}
function validateCode(errors, value) { if (!isEmpty(value) && (!CODE_REGEX.test(String(value).trim().toUpperCase()) || /\s/.test(String(value)))) errors.push(createValidationError("code", "code must be 3-40 uppercase letters, numbers, underscores, or hyphens without spaces.", "body", "INVALID_VOUCHER_CODE")); }
function validateMoney(errors, value, field, required) { if (isEmpty(value)) { if (required) errors.push(createValidationError(field, `${field} is required.`, "body", "REQUIRED")); return; } const n = Number(value); if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) errors.push(createValidationError(field, `${field} must be a non-negative integer VND amount.`, "body", "INVALID_VOUCHER_MONEY")); }
function validateInteger(errors, value, field, min, required) { if (isEmpty(value)) { if (required) errors.push(createValidationError(field, `${field} is required.`, "body", "REQUIRED")); return; } const n = Number(value); if (!Number.isInteger(n) || n < min) errors.push(createValidationError(field, `${field} must be an integer greater than or equal to ${min}.`, "body", "INVALID_VOUCHER_INTEGER")); }
function validateDate(errors, value, field) { if (!isEmpty(value) && Number.isNaN(Date.parse(value))) errors.push(createValidationError(field, `${field} must be a valid date.`, "body", "INVALID_VOUCHER_DATE")); }
function validateConditions(errors, value) { if (isEmpty(value)) return; if (typeof value === "string") { try { JSON.parse(value); } catch { errors.push(createValidationError("conditions", "conditions must be valid JSON or null.", "body", "INVALID_VOUCHER_CONDITIONS")); } } }
function validateAllowed(errors, value, field, allowedValues, location, code) { if (!isEmpty(value) && !allowedValues.includes(normalizeDiscountType(value))) errors.push(createValidationError(field, `${field} is invalid.`, location, code)); }
function pushIfError(errors, error) { if (error) errors.push(error); }
