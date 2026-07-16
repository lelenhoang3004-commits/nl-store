/**
 * Category validators.
 * They validate category REST requests before controller methods run.
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

const CATEGORY_STATUSES = ["active", "inactive"];
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCategoryListRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.status) && !CATEGORY_STATUSES.includes(query.status)) {
    errors.push(createValidationError("status", "status must be active or inactive.", "query", "INVALID_CATEGORY_STATUS"));
  }

  if (!isEmpty(query.parentId)) {
    errors.push(...validateId(query.parentId, { field: "parentId", location: "query" }).errors);
  }

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validateCategoryIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateCategoryRequest({ body }) {
  return validateCategoryPayload(body, { partial: false });
}

export function validateCategoryStatusRequest({ params, body }) {
  const errors = [];

  errors.push(...validateCategoryIdRequest({ params }).errors);

  if (!isEmpty(body.status) && !CATEGORY_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be active or inactive.", "body", "INVALID_CATEGORY_STATUS"));
  }

  return createValidationResult(errors);
}

export function validateUpdateCategoryRequest({ params, body }) {
  return mergeValidationResults([
    validateCategoryIdRequest({ params }),
    validateCategoryPayload(body, { partial: false })
  ]);
}

function validateCategoryPayload(body = {}, options = {}) {
  const errors = [];
  const nameRequiredError = validateRequired(body.name, "name", "body");

  if (!options.partial && nameRequiredError) {
    errors.push(nameRequiredError);
  }

  if (!isEmpty(body.name) && String(body.name).trim().length > 120) {
    errors.push(createValidationError("name", "name must not exceed 120 characters.", "body", "CATEGORY_NAME_TOO_LONG"));
  }

  if (!isEmpty(body.slug) && !SLUG_REGEX.test(body.slug)) {
    errors.push(createValidationError("slug", "slug must contain lowercase letters, numbers, and hyphens only.", "body", "INVALID_CATEGORY_SLUG"));
  }

  if (!isEmpty(body.description) && String(body.description).length > 500) {
    errors.push(createValidationError("description", "description must not exceed 500 characters.", "body", "CATEGORY_DESCRIPTION_TOO_LONG"));
  }

  if (!isEmpty(body.parentId)) {
    errors.push(...validateId(body.parentId, { field: "parentId", location: "body" }).errors);
  }

  if (!isEmpty(body.imageUrl) && String(body.imageUrl).length > 255) {
    errors.push(createValidationError("imageUrl", "imageUrl must not exceed 255 characters.", "body", "CATEGORY_IMAGE_URL_TOO_LONG"));
  }

  if (!isEmpty(body.status) && !CATEGORY_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be active or inactive.", "body", "INVALID_CATEGORY_STATUS"));
  }

  if (!isEmpty(body.sortOrder) && !Number.isInteger(Number(body.sortOrder))) {
    errors.push(createValidationError("sortOrder", "sortOrder must be an integer.", "body", "INVALID_SORT_ORDER"));
  }

  return createValidationResult(errors);
}
