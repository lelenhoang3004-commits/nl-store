import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
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

const USER_STATUSES = ["active", "inactive", "locked"];
const USER_ROLES = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF, AUTH_ROLES.CUSTOMER];

export function validateAdminUserListRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.role) && !USER_ROLES.includes(query.role)) {
    errors.push(createValidationError("role", "role is invalid.", "query", "INVALID_USER_ROLE"));
  }

  if (!isEmpty(query.status) && !USER_STATUSES.includes(query.status)) {
    errors.push(createValidationError("status", "status must be active, inactive, or locked.", "query", "INVALID_USER_STATUS"));
  }

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validateAdminUserIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateAdminUserUpdateRequest({ params, body }) {
  return mergeValidationResults([
    validateAdminUserIdRequest({ params }),
    validateAdminUserPayload(body)
  ]);
}

export function validateAdminUserStatusRequest({ params, body }) {
  const errors = [...validateAdminUserIdRequest({ params }).errors];
  pushIfError(errors, validateRequired(body.status, "status", "body"));

  if (!isEmpty(body.status) && !USER_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be active, inactive, or locked.", "body", "INVALID_USER_STATUS"));
  }

  return createValidationResult(errors);
}

export function validateAdminUserRoleRequest({ params, body }) {
  const errors = [...validateAdminUserIdRequest({ params }).errors];
  pushIfError(errors, validateRequired(body.role, "role", "body"));

  if (!isEmpty(body.role) && !USER_ROLES.includes(String(body.role).trim().toUpperCase())) {
    errors.push(createValidationError("role", "role is invalid.", "body", "INVALID_USER_ROLE"));
  }

  return createValidationResult(errors);
}

export function validateAdminUserPermissionsRequest({ params, body }) {
  const errors = [...validateAdminUserIdRequest({ params }).errors];
  validatePermissions(errors, body.permissions, { required: true });
  return createValidationResult(errors);
}

function validateAdminUserPayload(body = {}) {
  const errors = [];

  if (!isEmpty(body.email)) {
    errors.push(...validateEmail(body.email, { required: false }).errors);
  }

  const fullName = body.fullName ?? body.full_name;
  if (!isEmpty(fullName) && String(fullName).trim().length > 120) {
    errors.push(createValidationError("fullName", "fullName must not exceed 120 characters.", "body", "USER_FULL_NAME_TOO_LONG"));
  }

  if (!isEmpty(body.phone)) {
    errors.push(...validatePhone(body.phone, { field: "phone", location: "body", country: "VN" }).errors);
  }

  if (!isEmpty(body.role) && !USER_ROLES.includes(String(body.role).trim().toUpperCase())) {
    errors.push(createValidationError("role", "role is invalid.", "body", "INVALID_USER_ROLE"));
  }

  if (!isEmpty(body.status) && !USER_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be active, inactive, or locked.", "body", "INVALID_USER_STATUS"));
  }

  validatePermissions(errors, body.permissions);
  return createValidationResult(errors);
}

function validatePermissions(errors, permissions, options = {}) {
  if (permissions === undefined || permissions === null) {
    if (options.required) {
      errors.push(createValidationError("permissions", "permissions is required.", "body", "PERMISSIONS_REQUIRED"));
    }
    return;
  }

  if (!Array.isArray(permissions)) {
    errors.push(createValidationError("permissions", "permissions must be an array.", "body", "INVALID_USER_PERMISSIONS"));
    return;
  }

  const allowedPermissions = Object.values(AUTH_PERMISSIONS);
  const invalidPermission = permissions.find((permission) => !allowedPermissions.includes(permission));

  if (invalidPermission) {
    errors.push(createValidationError("permissions", `permissions contains invalid value: ${invalidPermission}.`, "body", "INVALID_USER_PERMISSION"));
  }
}

function pushIfError(errors, error) {
  if (error) errors.push(error);
}
