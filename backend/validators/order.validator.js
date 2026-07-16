/**
 * Order validators.
 * They validate order, order detail, status, payment, and transaction requests before controllers run.
 */
import {
  createValidationError,
  createValidationResult,
  isEmpty,
  mergeValidationResults,
  validateRequired
} from "./base.validator.js";
import { validateEmail } from "./email.validator.js";
import { validateId } from "./id.validator.js";
import { validatePagination } from "./pagination.validator.js";
import { validatePhone } from "./phone.validator.js";
import { validatePrice } from "./price.validator.js";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];
const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "failed", "refunded"];
const TRANSACTION_STATUSES = ["pending", "success", "failed", "refunded"];
const PAYMENT_METHODS = ["cod", "bank_transfer", "credit_card", "momo", "vnpay", "paypal"];
const TRANSACTION_PROVIDERS = ["manual", "bank", "momo", "vnpay", "paypal", "stripe"];

export function validateOrderListRequest({ query }) {
  const errors = [];

  validateOptionalAllowed(errors, query.status, "status", ORDER_STATUSES, "query", "INVALID_ORDER_STATUS");
  validateOptionalAllowed(errors, query.paymentStatus, "paymentStatus", PAYMENT_STATUSES, "query", "INVALID_PAYMENT_STATUS");
  validateOptionalAllowed(errors, query.paymentMethod, "paymentMethod", PAYMENT_METHODS, "query", "INVALID_PAYMENT_METHOD");

  if (!isEmpty(query.customerId)) {
    errors.push(...validateId(query.customerId, { field: "customerId", location: "query" }).errors);
  }

  validateOptionalDate(errors, query.dateFrom, "dateFrom", "query");
  validateOptionalDate(errors, query.dateTo, "dateTo", "query");

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validateOrderIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateOrderRequest({ body }) {
  const errors = [];

  pushIfError(errors, validateRequired(body.customerName, "customerName", "body"));
  errors.push(...validateEmail(body.customerEmail, { required: true, field: "customerEmail" }).errors);
  errors.push(...validatePhone(body.customerPhone, { required: true, field: "customerPhone", country: "VN" }).errors);

  if (!isEmpty(body.customerId)) {
    errors.push(...validateId(body.customerId, { field: "customerId", location: "body" }).errors);
  }

  validateShippingAddress(errors, body.shippingAddress);
  validateOrderItems(errors, body.items);
  validateOptionalAllowed(errors, body.status, "status", ORDER_STATUSES, "body", "INVALID_ORDER_STATUS");
  validateOptionalAllowed(errors, body.paymentStatus, "paymentStatus", PAYMENT_STATUSES, "body", "INVALID_PAYMENT_STATUS");
  validateOptionalAllowed(errors, body.paymentMethod, "paymentMethod", PAYMENT_METHODS, "body", "INVALID_PAYMENT_METHOD");
  validateMoneyField(errors, body.discountTotal, "discountTotal");
  validateMoneyField(errors, body.shippingFee, "shippingFee");
  validateMoneyField(errors, body.taxTotal, "taxTotal");
  validateMoneyField(errors, body.paidAmount, "paidAmount");

  if (!isEmpty(body.note) && String(body.note).length > 1000) {
    errors.push(createValidationError("note", "note must not exceed 1000 characters.", "body", "ORDER_NOTE_TOO_LONG"));
  }

  return createValidationResult(errors);
}

export function validateUpdateOrderStatusRequest({ params, body }) {
  const errors = [];

  validateOptionalAllowed(errors, body.status, "status", ORDER_STATUSES, "body", "INVALID_ORDER_STATUS");
  pushIfError(errors, validateRequired(body.status, "status", "body"));

  if (!isEmpty(body.note) && String(body.note).length > 500) {
    errors.push(createValidationError("note", "note must not exceed 500 characters.", "body", "ORDER_STATUS_NOTE_TOO_LONG"));
  }

  return mergeValidationResults([
    validateOrderIdRequest({ params }),
    createValidationResult(errors)
  ]);
}

export function validateCreateTransactionRequest({ params, body }) {
  const errors = [];

  pushIfError(errors, validateRequired(body.provider, "provider", "body"));
  pushIfError(errors, validateRequired(body.method, "method", "body"));
  errors.push(...validatePrice(body.amount, { required: true, field: "amount", location: "body" }).errors);
  validateOptionalAllowed(errors, body.provider, "provider", TRANSACTION_PROVIDERS, "body", "INVALID_TRANSACTION_PROVIDER");
  validateOptionalAllowed(errors, body.method, "method", PAYMENT_METHODS, "body", "INVALID_PAYMENT_METHOD");
  validateOptionalAllowed(errors, body.status, "status", TRANSACTION_STATUSES, "body", "INVALID_TRANSACTION_STATUS");
  validateOptionalDate(errors, body.paidAt, "paidAt", "body");

  if (!isEmpty(body.transactionCode) && String(body.transactionCode).length > 120) {
    errors.push(createValidationError("transactionCode", "transactionCode must not exceed 120 characters.", "body", "TRANSACTION_CODE_TOO_LONG"));
  }

  if (!isEmpty(body.metadata) && typeof body.metadata !== "object") {
    errors.push(createValidationError("metadata", "metadata must be an object.", "body", "INVALID_TRANSACTION_METADATA"));
  }

  return mergeValidationResults([
    validateOrderIdRequest({ params }),
    createValidationResult(errors)
  ]);
}

function validateOrderItems(errors, items) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(createValidationError("items", "items must contain at least one order detail.", "body", "ORDER_ITEMS_REQUIRED"));
    return;
  }

  items.forEach((item, index) => {
    const prefix = `items.${index}`;

    pushIfError(errors, validateRequired(item.productName, `${prefix}.productName`, "body"));
    pushIfError(errors, validateRequired(item.productSku, `${prefix}.productSku`, "body"));

    if (!isEmpty(item.productId)) {
      errors.push(...validateId(item.productId, { field: `${prefix}.productId`, location: "body" }).errors);
    }

    validatePositiveInteger(errors, item.quantity, `${prefix}.quantity`);
    errors.push(...validatePrice(item.unitPrice, { required: true, field: `${prefix}.unitPrice`, location: "body" }).errors);
    validateMoneyField(errors, item.discountAmount, `${prefix}.discountAmount`);

    if (!isEmpty(item.productImageUrl) && String(item.productImageUrl).length > 255) {
      errors.push(createValidationError(`${prefix}.productImageUrl`, "productImageUrl must not exceed 255 characters.", "body", "ORDER_ITEM_IMAGE_TOO_LONG"));
    }
  });
}

function validateShippingAddress(errors, address) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    errors.push(createValidationError("shippingAddress", "shippingAddress must be an object.", "body", "INVALID_SHIPPING_ADDRESS"));
    return;
  }

  ["fullName", "phone", "line1", "city"].forEach((field) => {
    pushIfError(errors, validateRequired(address[field], `shippingAddress.${field}`, "body"));
  });

  if (!isEmpty(address.phone)) {
    errors.push(...validatePhone(address.phone, { field: "shippingAddress.phone", location: "body", country: "VN" }).errors);
  }
}

function validateOptionalAllowed(errors, value, field, allowedValues, location, code) {
  if (!isEmpty(value) && !allowedValues.includes(value)) {
    errors.push(createValidationError(field, `${field} is invalid.`, location, code));
  }
}

function validateOptionalDate(errors, value, field, location) {
  if (!isEmpty(value) && Number.isNaN(Date.parse(value))) {
    errors.push(createValidationError(field, `${field} must be a valid date.`, location, "INVALID_DATE"));
  }
}

function validateMoneyField(errors, value, field) {
  if (!isEmpty(value)) {
    errors.push(...validatePrice(value, { field, location: "body" }).errors);
  }
}

function validatePositiveInteger(errors, value, field) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    errors.push(createValidationError(field, `${field} must be a positive integer.`, "body", "INVALID_ORDER_QUANTITY"));
  }
}

function pushIfError(errors, error) {
  if (error) {
    errors.push(error);
  }
}
