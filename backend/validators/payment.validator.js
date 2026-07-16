/**
 * Payment validators.
 * They validate payment methods, COD, transactions, histories, and status changes.
 */
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

const METHOD_TYPES = ["cod", "online", "bank_transfer"];
const PROVIDERS = ["cod", "manual", "bank", "momo", "vnpay", "paypal", "stripe"];
const TRANSACTION_STATUSES = ["pending", "paid", "success", "failed", "cancelled", "refunded"];
const PAYMENT_METHODS = ["cod", "bank_transfer", "vnpay", "momo"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const CODE_REGEX = /^[a-z0-9][a-z0-9_-]{1,63}$/;

export function validatePaymentMethodListRequest({ query }) {
  const errors = [];

  validateAllowed(errors, query.type, "type", METHOD_TYPES, "query", "INVALID_PAYMENT_METHOD_TYPE");
  validateAllowed(errors, query.provider, "provider", PROVIDERS, "query", "INVALID_PAYMENT_PROVIDER");

  if (!isEmpty(query.isActive) && !["true", "false", true, false].includes(query.isActive)) {
    errors.push(createValidationError("isActive", "isActive must be true or false.", "query", "INVALID_ACTIVE_FILTER"));
  }

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validatePaymentMethodIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreatePaymentMethodRequest({ body }) {
  return validatePaymentMethodPayload(body);
}

export function validateUpdatePaymentMethodRequest({ params, body }) {
  return mergeValidationResults([
    validatePaymentMethodIdRequest({ params }),
    validatePaymentMethodPayload(body)
  ]);
}

export function validatePaymentTransactionListRequest({ query }) {
  const errors = [];

  ["orderId", "paymentMethodId"].forEach((field) => {
    if (!isEmpty(query[field])) {
      errors.push(...validateId(query[field], { field, location: "query" }).errors);
    }
  });

  validateAllowed(errors, query.provider, "provider", PROVIDERS, "query", "INVALID_PAYMENT_PROVIDER");
  validateAllowed(errors, query.method, "method", PAYMENT_METHODS, "query", "INVALID_PAYMENT_METHOD");
  validateAllowed(errors, query.status, "status", TRANSACTION_STATUSES, "query", "INVALID_PAYMENT_TRANSACTION_STATUS");

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validatePaymentTransactionIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validatePaymentOrderIdRequest({ params }) {
  return validateId(params.orderId, { required: true, field: "orderId", location: "params" });
}

export function validateCreatePaymentRequest({ body }) {
  const errors = [];
  const orderId = body.order_id ?? body.orderId;
  const paymentMethod = body.payment_method ?? body.paymentMethod;

  errors.push(...validateId(orderId, { required: true, field: "order_id", location: "body" }).errors);
  pushIfError(errors, validateRequired(paymentMethod, "payment_method", "body"));
  validateAllowed(errors, paymentMethod, "payment_method", PAYMENT_METHODS, "body", "INVALID_PAYMENT_METHOD");

  if (!isEmpty(body.amount)) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(createValidationError("amount", "amount must be greater than zero.", "body", "INVALID_PAYMENT_AMOUNT"));
    }
  }

  return createValidationResult(errors);
}

export function validateUpdatePaymentStatusRequest({ params, body }) {
  const errors = [];
  pushIfError(errors, validateRequired(body.status, "status", "body"));
  validateAllowed(errors, body.status, "status", PAYMENT_STATUSES, "body", "INVALID_PAYMENT_TRANSACTION_STATUS");

  return mergeValidationResults([
    validatePaymentTransactionIdRequest({ params }),
    createValidationResult(errors)
  ]);
}

export function validateCreatePaymentTransactionRequest({ body }) {
  const errors = [];

  errors.push(...validateId(body.orderId, { required: true, field: "orderId", location: "body" }).errors);
  errors.push(...validatePrice(body.amount, { required: true, field: "amount", location: "body" }).errors);

  if (!isEmpty(body.paymentMethodId)) {
    errors.push(...validateId(body.paymentMethodId, { field: "paymentMethodId", location: "body" }).errors);
  }

  validateAllowed(errors, body.provider, "provider", PROVIDERS, "body", "INVALID_PAYMENT_PROVIDER");
  validateAllowed(errors, body.method, "method", METHOD_TYPES, "body", "INVALID_PAYMENT_METHOD");
  validateAllowed(errors, body.status, "status", TRANSACTION_STATUSES, "body", "INVALID_PAYMENT_TRANSACTION_STATUS");
  validateOptionalDate(errors, body.paidAt, "paidAt", "body");

  if (!isEmpty(body.transactionCode) && String(body.transactionCode).length > 120) {
    errors.push(createValidationError("transactionCode", "transactionCode must not exceed 120 characters.", "body", "PAYMENT_TRANSACTION_CODE_TOO_LONG"));
  }

  if (!isEmpty(body.currency) && String(body.currency).length !== 3) {
    errors.push(createValidationError("currency", "currency must be a 3-letter ISO code.", "body", "INVALID_PAYMENT_CURRENCY"));
  }

  if (!isEmpty(body.metadata) && typeof body.metadata !== "object") {
    errors.push(createValidationError("metadata", "metadata must be an object.", "body", "INVALID_PAYMENT_METADATA"));
  }

  return createValidationResult(errors);
}

export function validateUpdatePaymentTransactionStatusRequest({ params, body }) {
  const errors = [];

  pushIfError(errors, validateRequired(body.status, "status", "body"));
  validateAllowed(errors, body.status, "status", TRANSACTION_STATUSES, "body", "INVALID_PAYMENT_TRANSACTION_STATUS");
  validateOptionalDate(errors, body.paidAt, "paidAt", "body");

  if (!isEmpty(body.note) && String(body.note).length > 500) {
    errors.push(createValidationError("note", "note must not exceed 500 characters.", "body", "PAYMENT_HISTORY_NOTE_TOO_LONG"));
  }

  return mergeValidationResults([
    validatePaymentTransactionIdRequest({ params }),
    createValidationResult(errors)
  ]);
}

function validatePaymentMethodPayload(body = {}) {
  const errors = [];

  pushIfError(errors, validateRequired(body.code, "code", "body"));
  pushIfError(errors, validateRequired(body.name, "name", "body"));

  if (!isEmpty(body.code) && !CODE_REGEX.test(body.code)) {
    errors.push(createValidationError("code", "code must contain lowercase letters, numbers, underscores, or hyphens.", "body", "INVALID_PAYMENT_METHOD_CODE"));
  }

  if (!isEmpty(body.name) && String(body.name).length > 120) {
    errors.push(createValidationError("name", "name must not exceed 120 characters.", "body", "PAYMENT_METHOD_NAME_TOO_LONG"));
  }

  validateAllowed(errors, body.type, "type", METHOD_TYPES, "body", "INVALID_PAYMENT_METHOD_TYPE");
  validateAllowed(errors, body.provider, "provider", PROVIDERS, "body", "INVALID_PAYMENT_PROVIDER");

  if (!isEmpty(body.description) && String(body.description).length > 500) {
    errors.push(createValidationError("description", "description must not exceed 500 characters.", "body", "PAYMENT_METHOD_DESCRIPTION_TOO_LONG"));
  }

  if (!isEmpty(body.config) && typeof body.config !== "object") {
    errors.push(createValidationError("config", "config must be an object.", "body", "INVALID_PAYMENT_METHOD_CONFIG"));
  }

  return createValidationResult(errors);
}

function validateAllowed(errors, value, field, allowedValues, location, code) {
  if (!isEmpty(value) && !allowedValues.includes(value)) {
    errors.push(createValidationError(field, `${field} is invalid.`, location, code));
  }
}

function validateOptionalDate(errors, value, field, location) {
  if (!isEmpty(value) && Number.isNaN(Date.parse(value))) {
    errors.push(createValidationError(field, `${field} must be a valid date.`, location, "INVALID_PAYMENT_DATE"));
  }
}

function pushIfError(errors, error) {
  if (error) {
    errors.push(error);
  }
}
