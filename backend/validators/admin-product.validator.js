import { createValidationError, createValidationResult, isEmpty, mergeValidationResults, validateRequired } from "./base.validator.js";
import { validateId } from "./id.validator.js";
import { validatePagination } from "./pagination.validator.js";
import { validatePrice } from "./price.validator.js";

const STATUSES = ["active", "inactive", "out_of_stock"];
const SKU_REGEX = /^[A-Z0-9][A-Z0-9._-]{1,63}$/i;

export function validateAdminProductListRequest({ query }) {
  const errors = [];
  if (!isEmpty(query.categoryId)) errors.push(...validateId(query.categoryId, { field: "categoryId", location: "query" }).errors);
  if (!isEmpty(query.status) && !STATUSES.includes(query.status)) errors.push(error("status", "status must be active, inactive, or out_of_stock.", "query"));
  if (!isEmpty(query.lowStock) && !["true", "false", "1", "0", true, false].includes(query.lowStock)) errors.push(error("lowStock", "lowStock must be true or false.", "query"));
  return mergeValidationResults([validatePagination(query), createValidationResult(errors)]);
}

export function validateAdminProductIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateAdminProductRequest({ body }) {
  return validatePayload(body, true);
}

export function validateUpdateAdminProductRequest({ params, body }) {
  return mergeValidationResults([validateAdminProductIdRequest({ params }), validatePayload(body, false)]);
}

export function validateAdminProductStockRequest({ params, body }) {
  const errors = [];
  const hasStock = !isEmpty(body.stock);
  const hasAdjustment = !isEmpty(body.adjustment);
  if (!hasStock && !hasAdjustment) errors.push(error("stock", "stock or adjustment is required."));
  if (hasStock) validateInteger(errors, body.stock, "stock", 0);
  if (hasAdjustment) validateInteger(errors, body.adjustment, "adjustment", Number.MIN_SAFE_INTEGER);
  if (!isEmpty(body.reason) && String(body.reason).length > 500) errors.push(error("reason", "reason must not exceed 500 characters."));
  return mergeValidationResults([validateAdminProductIdRequest({ params }), createValidationResult(errors)]);
}

export function validateAdminProductStatusRequest({ params, body }) {
  const errors = [];
  const required = validateRequired(body.status, "status", "body");
  if (required) errors.push(required);
  else if (!STATUSES.includes(body.status)) errors.push(error("status", "status must be active, inactive, or out_of_stock."));
  return mergeValidationResults([validateAdminProductIdRequest({ params }), createValidationResult(errors)]);
}

function validatePayload(body = {}, required) {
  const errors = [];
  const get = (camel, snake = camel) => body[camel] ?? body[snake];
  if (required) {
    ["name", "sku"].forEach((field) => { const result = validateRequired(get(field), field, "body"); if (result) errors.push(result); });
    errors.push(...validatePrice(get("price"), { required: true, field: "price", location: "body" }).errors);
  }
  if (!isEmpty(get("name")) && String(get("name")).trim().length > 200) errors.push(error("name", "name must not exceed 200 characters."));
  if (!isEmpty(get("sku")) && !SKU_REGEX.test(String(get("sku")))) errors.push(error("sku", "sku contains invalid characters."));
  if (!isEmpty(get("price"))) errors.push(...validatePrice(get("price"), { field: "price", location: "body" }).errors);
  if (!isEmpty(get("salePrice", "sale_price"))) errors.push(...validatePrice(get("salePrice", "sale_price"), { field: "sale_price", location: "body" }).errors);
  if (!isEmpty(get("price")) && !isEmpty(get("salePrice", "sale_price")) && Number(get("salePrice", "sale_price")) > Number(get("price"))) errors.push(error("sale_price", "sale_price must be less than or equal to price."));
  if (!isEmpty(get("stock"))) validateInteger(errors, get("stock"), "stock", 0);
  if (!isEmpty(get("ratingAverage", "rating_average"))) validateRatingAverage(errors, get("ratingAverage", "rating_average"));
  if (!isEmpty(get("categoryId", "category_id"))) errors.push(...validateId(get("categoryId", "category_id"), { field: "category_id", location: "body" }).errors);
  if (!isEmpty(get("status")) && !STATUSES.includes(get("status"))) errors.push(error("status", "status must be active, inactive, or out_of_stock."));
  if (!isEmpty(get("thumbnailUrl", "thumbnail_url")) && String(get("thumbnailUrl", "thumbnail_url")).length > 255) errors.push(error("thumbnail_url", "thumbnail_url must not exceed 255 characters."));
  validateArrayLike(errors, get("galleryUrls", "gallery_urls"), "gallery_urls");
  validateArrayLike(errors, get("tags"), "tags");
  validateProductAttributes(errors, get("productAttributes", "product_attributes"));
  return createValidationResult(errors);
}

function validateProductAttributes(errors, value) {
  if (isEmpty(value)) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(error("product_attributes", "product_attributes must be an object."));
    return;
  }
  const allowed = new Set(["material", "chain_length", "pendant_type", "stone_color", "pendant_size", "warranty"]);
  for (const [key, item] of Object.entries(value)) {
    if (!allowed.has(key)) errors.push(error(`product_attributes.${key}`, `${key} is not a supported product attribute.`));
    else if (item != null && typeof item !== "string") errors.push(error(`product_attributes.${key}`, `${key} must be a string.`));
    else if (String(item || "").length > 200) errors.push(error(`product_attributes.${key}`, `${key} must not exceed 200 characters.`));
  }
}

function validateInteger(errors, value, field, min) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) errors.push(error(field, `${field} must be an integer greater than or equal to ${min}.`));
}
function validateRatingAverage(errors, value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 5 || Math.round(number * 10) !== number * 10) {
    errors.push(error("rating_average", "rating_average must be a number from 0 to 5 with step 0.1."));
  }
}
function validateArrayLike(errors, value, field) {
  if (isEmpty(value)) return;
  if (Array.isArray(value)) return;
  if (typeof value !== "string") errors.push(error(field, `${field} must be an array or JSON/comma-separated string.`));
  else if (value.trim().startsWith("[") && (() => { try { return !Array.isArray(JSON.parse(value)); } catch { return true; } })()) errors.push(error(field, `${field} contains invalid JSON.`));
}
function error(field, message, location = "body") { return createValidationError(field, message, location, "INVALID_ADMIN_PRODUCT"); }
