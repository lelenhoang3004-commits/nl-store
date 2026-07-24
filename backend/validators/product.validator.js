/**
 * Product validators.
 * They validate Product REST requests before controller methods run.
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

const PRODUCT_STATUSES = ["draft", "active", "inactive"];
const STOCK_STATUSES = ["inStock", "lowStock", "outOfStock"];
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_REGEX = /^[A-Z0-9][A-Z0-9._-]{1,63}$/i;

export function validateProductListRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.status) && !PRODUCT_STATUSES.includes(query.status)) {
    errors.push(createValidationError("status", "status must be draft, active, or inactive.", "query", "INVALID_PRODUCT_STATUS"));
  }

  if (!isEmpty(query.stockStatus) && !STOCK_STATUSES.includes(query.stockStatus)) {
    errors.push(createValidationError("stockStatus", "stockStatus must be inStock, lowStock, or outOfStock.", "query", "INVALID_STOCK_STATUS"));
  }

  if (!isEmpty(query.search) && typeof query.search !== "string") {
    errors.push(createValidationError("search", "search must be a string.", "query", "INVALID_PRODUCT_SEARCH"));
  }

  if (!isEmpty(query.search) && String(query.search).trim().length > 150) {
    errors.push(createValidationError("search", "search must not exceed 150 characters.", "query", "PRODUCT_SEARCH_TOO_LONG"));
  }

  if (!isEmpty(query.categoryId)) {
    errors.push(...validateId(query.categoryId, { field: "categoryId", location: "query" }).errors);
  }

  if (!isEmpty(query.priceMin)) {
    errors.push(...validatePrice(query.priceMin, { field: "priceMin", location: "query" }).errors);
  }

  if (!isEmpty(query.priceMax)) {
    errors.push(...validatePrice(query.priceMax, { field: "priceMax", location: "query" }).errors);
  }

  if (!isEmpty(query.priceMin) && !isEmpty(query.priceMax) && Number(query.priceMin) > Number(query.priceMax)) {
    errors.push(createValidationError("priceMin", "priceMin must be less than or equal to priceMax.", "query", "INVALID_PRICE_RANGE"));
  }

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validateProductIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateProductRequest({ body }) {
  return validateProductPayload(body);
}

export function validateUpdateProductRequest({ params, body }) {
  return mergeValidationResults([
    validateProductIdRequest({ params }),
    validateProductPayload(body)
  ]);
}

function validateProductPayload(body = {}) {
  const errors = [];

  pushIfError(errors, validateRequired(body.name, "name", "body"));
  pushIfError(errors, validateRequired(body.sku, "sku", "body"));
  errors.push(...validatePrice(body.price, { required: true, field: "price", location: "body" }).errors);

  if (!isEmpty(body.name) && String(body.name).trim().length > 160) {
    errors.push(createValidationError("name", "name must not exceed 160 characters.", "body", "PRODUCT_NAME_TOO_LONG"));
  }

  if (!isEmpty(body.slug) && !SLUG_REGEX.test(body.slug)) {
    errors.push(createValidationError("slug", "slug must contain lowercase letters, numbers, and hyphens only.", "body", "INVALID_PRODUCT_SLUG"));
  }

  if (!isEmpty(body.sku) && !SKU_REGEX.test(body.sku)) {
    errors.push(createValidationError("sku", "sku must contain letters, numbers, dots, hyphens, or underscores.", "body", "INVALID_PRODUCT_SKU"));
  }

  if (!isEmpty(body.categoryId)) {
    errors.push(...validateId(body.categoryId, { field: "categoryId", location: "body" }).errors);
  }

  if (!isEmpty(body.brand) && String(body.brand).trim().length > 120) {
    errors.push(createValidationError("brand", "brand must not exceed 120 characters.", "body", "PRODUCT_BRAND_TOO_LONG"));
  }

  if (!isEmpty(body.shortDescription) && String(body.shortDescription).length > 500) {
    errors.push(createValidationError("shortDescription", "shortDescription must not exceed 500 characters.", "body", "PRODUCT_SHORT_DESCRIPTION_TOO_LONG"));
  }

  if (!isEmpty(body.salePrice)) {
    errors.push(...validatePrice(body.salePrice, { field: "salePrice", location: "body" }).errors);
  }

  if (!isEmpty(body.price) && !isEmpty(body.salePrice) && Number(body.salePrice) > Number(body.price)) {
    errors.push(createValidationError("salePrice", "salePrice must be less than or equal to price.", "body", "SALE_PRICE_GREATER_THAN_PRICE"));
  }

  validateIntegerField(errors, body.stock, "stock", 0);
  validateIntegerField(errors, body.sold, "sold", 0);

  if (!isEmpty(body.status) && !PRODUCT_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be draft, active, or inactive.", "body", "INVALID_PRODUCT_STATUS"));
  }

  if (!isEmpty(body.thumbnailUrl) && String(body.thumbnailUrl).length > 255) {
    errors.push(createValidationError("thumbnailUrl", "thumbnailUrl must not exceed 255 characters.", "body", "PRODUCT_THUMBNAIL_TOO_LONG"));
  }

  validateStringArray(errors, body.galleryUrls, "galleryUrls");
  validateStringArray(errors, body.tags, "tags");

  return createValidationResult(errors);
}

function validateIntegerField(errors, value, field, min) {
  if (isEmpty(value)) {
    return;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < min) {
    errors.push(createValidationError(field, `${field} must be an integer greater than or equal to ${min}.`, "body", "INVALID_INTEGER"));
  }
}

function validateStringArray(errors, value, field) {
  if (isEmpty(value)) {
    return;
  }

  if (Array.isArray(value)) {
    const hasInvalidItem = value.some((item) => typeof item !== "string" || item.length > 255);

    if (hasInvalidItem) {
      errors.push(createValidationError(field, `${field} must contain strings up to 255 characters.`, "body", "INVALID_STRING_ARRAY"));
    }

    return;
  }

  if (typeof value !== "string") {
    errors.push(createValidationError(field, `${field} must be an array or comma-separated string.`, "body", "INVALID_ARRAY_FORMAT"));
  }
}

function pushIfError(errors, error) {
  if (error) {
    errors.push(error);
  }
}
