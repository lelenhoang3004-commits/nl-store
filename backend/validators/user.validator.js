/**
 * User validators.
 * They validate user CRUD, profile, avatar-related payloads, role, permission, and address input.
 */
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
import { validatePassword } from "./password.validator.js";
import { validatePhone } from "./phone.validator.js";

const USER_STATUSES = ["active", "inactive", "locked"];
const ADDRESS_FIELDS = ["line1", "line2", "ward", "district", "city", "province", "provinceCode", "provinceName", "wardCode", "wardName", "country", "postalCode", "detailAddress", "fullAddress"];

export function validateUserListRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.role) && !Object.values(AUTH_ROLES).includes(query.role)) {
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

export function validateUserIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateCreateUserRequest({ body }) {
  return validateUserPayload(body, { requirePassword: true });
}

export function validateUpdateUserRequest({ params, body }) {
  return mergeValidationResults([
    validateUserIdRequest({ params }),
    validateUserPayload(body, { requirePassword: false })
  ]);
}

export function validateProfileUpdateRequest({ body }) {
  const errors = [];

  if (body.fullName !== undefined) {
    pushIfError(errors, validateRequired(body.fullName, "fullName", "body"));
  }
  if (body.email !== undefined) {
    errors.push(...validateEmail(body.email, { required: true }).errors);
  }
  if (!isEmpty(body.currentPassword)) {
    errors.push(...validatePassword(body.currentPassword, { required: false, strong: false, minLength: 1, field: "currentPassword" }).errors);
  }
  validateCommonProfileFields(errors, body);

  return createValidationResult(errors);
}

export function validateChangePasswordRequest({ body }) {
  const errors = [];
  errors.push(...validatePassword(body.currentPassword, { required: true, strong: false, minLength: 1, field: "currentPassword" }).errors);
  errors.push(...validatePassword(body.newPassword, { required: true, strong: true, field: "newPassword" }).errors);
  if (body.newPassword !== body.confirmPassword) {
    errors.push(createValidationError("confirmPassword", "Xác nhận mật khẩu không khớp.", "body", "PASSWORD_CONFIRMATION_MISMATCH"));
  }
  return createValidationResult(errors);
}

export function validateSetPasswordRequest({ body }) {
  const errors = [];
  errors.push(...validatePassword(body.newPassword, { required: true, strong: true, field: "newPassword" }).errors);
  if (body.newPassword !== body.confirmPassword) {
    errors.push(createValidationError("confirmPassword", "Xác nhận mật khẩu không khớp.", "body", "PASSWORD_CONFIRMATION_MISMATCH"));
  }
  return createValidationResult(errors);
}

export function validatePaymentMethodRequest({ body }) {
  const errors = [];
  const type = String(body.type || "").trim().toLowerCase();
  if (!["bank_account", "momo"].includes(type)) {
    errors.push(createValidationError("type", "type must be bank_account or momo.", "body", "INVALID_PAYMENT_METHOD_TYPE"));
  }
  pushIfError(errors, validateRequired(body.accountHolderName, "accountHolderName", "body"));
  pushIfError(errors, validateRequired(body.accountIdentifier || body.accountNumber || body.phone, "accountIdentifier", "body"));
  ["providerName", "accountHolderName", "accountIdentifier", "accountNumber", "phone"].forEach((field) => {
    if (!isEmpty(body[field]) && String(body[field]).length > 120) {
      errors.push(createValidationError(field, `${field} must not exceed 120 characters.`, "body", "PAYMENT_FIELD_TOO_LONG"));
    }
  });
  return createValidationResult(errors);
}

function validateUserPayload(body = {}, options = {}) {
  const errors = [];

  errors.push(...validateEmail(body.email, { required: true }).errors);
  pushIfError(errors, validateRequired(body.fullName, "fullName", "body"));

  if (options.requirePassword || !isEmpty(body.password)) {
    errors.push(...validatePassword(body.password, { required: options.requirePassword }).errors);
  }

  validateCommonProfileFields(errors, body);

  if (!isEmpty(body.role) && !Object.values(AUTH_ROLES).includes(body.role)) {
    errors.push(createValidationError("role", "role is invalid.", "body", "INVALID_USER_ROLE"));
  }

  if (!isEmpty(body.status) && !USER_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be active, inactive, or locked.", "body", "INVALID_USER_STATUS"));
  }

  validatePermissions(errors, body.permissions);

  return createValidationResult(errors);
}

function validateCommonProfileFields(errors, body = {}) {
  if (!isEmpty(body.fullName) && String(body.fullName).trim().length > 120) {
    errors.push(createValidationError("fullName", "fullName must not exceed 120 characters.", "body", "USER_FULL_NAME_TOO_LONG"));
  }

  if (!isEmpty(body.phone)) {
    errors.push(...validatePhone(body.phone, { field: "phone", location: "body", country: "VN" }).errors);
  }

  if (!isEmpty(body.avatarUrl) && String(body.avatarUrl).length > 255) {
    errors.push(createValidationError("avatarUrl", "avatarUrl must not exceed 255 characters.", "body", "USER_AVATAR_URL_TOO_LONG"));
  }

  validateAddress(errors, body.address);
}

function validatePermissions(errors, permissions) {
  if (isEmpty(permissions)) {
    return;
  }

  const allowedPermissions = Object.values(AUTH_PERMISSIONS);
  const requestedPermissions = Array.isArray(permissions)
    ? permissions
    : String(permissions).split(",").map((permission) => permission.trim()).filter(Boolean);
  const invalidPermission = requestedPermissions.find((permission) => !allowedPermissions.includes(permission));

  if (invalidPermission) {
    errors.push(createValidationError("permissions", `permissions contains invalid value: ${invalidPermission}.`, "body", "INVALID_USER_PERMISSION"));
  }
}

function validateAddress(errors, address) {
  if (isEmpty(address)) {
    return;
  }

  if (typeof address !== "object" || Array.isArray(address)) {
    errors.push(createValidationError("address", "address must be an object.", "body", "INVALID_ADDRESS"));
    return;
  }

  ADDRESS_FIELDS.forEach((field) => {
    if (!isEmpty(address[field]) && String(address[field]).length > 120) {
      errors.push(createValidationError(`address.${field}`, `${field} must not exceed 120 characters.`, "body", "ADDRESS_FIELD_TOO_LONG"));
    }
  });
}

function pushIfError(errors, error) {
  if (error) {
    errors.push(error);
  }
}
