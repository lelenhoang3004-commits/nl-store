import { createValidationError, createValidationResult, isEmpty, mergeValidationResults } from "./base.validator.js";
import { validateId } from "./id.validator.js";

const STATUSES = ["active", "inactive", "out_of_stock"];

export function validateVariantListRequest({ params }) {
  return validateId(params.productId ?? params.id, { required: true, field: "productId", location: "params" });
}

export function validateCreateVariantRequest({ params, body }) {
  return mergeValidationResults([validateVariantListRequest({ params }), validatePayload(body, true)]);
}

export function validateUpdateVariantRequest({ params, body }) {
  return mergeValidationResults([validateVariantListRequest({ params }), validateId(params.variantId, { required: true, field: "variantId", location: "params" }), validatePayload(body, false)]);
}

export function validateStockUpdateVariantRequest({ params, body }) {
  return mergeValidationResults([
    validateVariantListRequest({ params }),
    validateId(params.variantId, { required: true, field: "variantId", location: "params" }),
    validateStockPayload(body)
  ]);
}

export function validateStatusUpdateVariantRequest({ params, body }) {
  return mergeValidationResults([
    validateVariantListRequest({ params }),
    validateId(params.variantId, { required: true, field: "variantId", location: "params" }),
    validateStatusPayload(body)
  ]);
}

export function validateDeleteVariantRequest({ params }) {
  return mergeValidationResults([validateVariantListRequest({ params }), validateId(params.variantId, { required: true, field: "variantId", location: "params" })]);
}

function validatePayload(body, required) {
  const errors = [];
  if (required && isEmpty(body.sku)) errors.push(error("sku", "sku is required."));
  if (!isEmpty(body.sku) && (String(body.sku).length > 120 || !/^[A-Z0-9][A-Z0-9._-]+$/i.test(String(body.sku)))) errors.push(error("sku", "sku is invalid."));
  if (required && isEmpty(body.size)) errors.push(error("size", "size is required."));
  if (required && isEmpty(body.color)) errors.push(error("color", "color is required."));
  ["stock"].forEach((field) => { if (!isEmpty(body[field]) && (!Number.isInteger(Number(body[field])) || Number(body[field]) < 0)) errors.push(error(field, `${field} must be a non-negative integer.`)); });
  const price = body.price; const salePrice = body.salePrice ?? body.sale_price;
  if (!isEmpty(price) && (!Number.isFinite(Number(price)) || Number(price) < 0)) errors.push(error("price", "price is invalid."));
  if (!isEmpty(salePrice) && (!Number.isFinite(Number(salePrice)) || Number(salePrice) < 0 || !isEmpty(price) && Number(salePrice) > Number(price))) errors.push(error("salePrice", "sale price is invalid."));
  if (!isEmpty(body.status) && !STATUSES.includes(String(body.status))) errors.push(error("status", "status is invalid."));
  if (!isEmpty(body.colorCode ?? body.color_code) && !/^#[0-9a-f]{6}$/i.test(String(body.colorCode ?? body.color_code))) errors.push(error("colorCode", "colorCode must be a hex color."));
  return createValidationResult(errors);
}

function validateStockPayload(body) {
  const errors = [];
  const hasStock = Object.prototype.hasOwnProperty.call(body, "stock");
  const hasAdjustment = Object.prototype.hasOwnProperty.call(body, "adjustment");
  if (!hasStock && !hasAdjustment) errors.push(error("stock", "stock or adjustment is required."));
  if (hasStock && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) errors.push(error("stock", "stock must be a non-negative integer."));
  if (hasAdjustment && (!Number.isInteger(Number(body.adjustment)))) errors.push(error("adjustment", "adjustment must be an integer."));
  return createValidationResult(errors);
}

function validateStatusPayload(body) {
  const errors = [];
  if (!body.status || !STATUSES.includes(String(body.status))) errors.push(error("status", "status is invalid."));
  return createValidationResult(errors);
}

function error(field, message) { return createValidationError(field, message, "body", "INVALID_PRODUCT_VARIANT"); }
