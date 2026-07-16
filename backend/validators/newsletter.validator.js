/**
 * Newsletter validators.
 * They validate subscribe, unsubscribe, email, token, and paginated list requests.
 */
import { createValidationError, createValidationResult, isEmpty, mergeValidationResults } from "./base.validator.js";
import { validateEmail } from "./email.validator.js";
import { validateId } from "./id.validator.js";
import { validatePagination } from "./pagination.validator.js";

const NEWSLETTER_STATUSES = ["subscribed", "unsubscribed"];
const SOURCE_REGEX = /^[a-z0-9_-]{2,60}$/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateNewsletterListRequest({ query }) {
  const errors = [];

  if (!isEmpty(query.status) && !NEWSLETTER_STATUSES.includes(query.status)) {
    errors.push(createValidationError("status", "status must be subscribed or unsubscribed.", "query", "INVALID_NEWSLETTER_STATUS"));
  }

  if (!isEmpty(query.source) && !SOURCE_REGEX.test(query.source)) {
    errors.push(createValidationError("source", "source must contain letters, numbers, underscores, or hyphens.", "query", "INVALID_NEWSLETTER_SOURCE"));
  }

  return mergeValidationResults([
    validatePagination(query),
    createValidationResult(errors)
  ]);
}

export function validateNewsletterIdRequest({ params }) {
  return validateId(params.id, { required: true, field: "id", location: "params" });
}

export function validateSubscribeRequest({ body }) {
  const errors = [
    ...validateEmail(body.email, { required: true }).errors
  ];

  validateOptionalProfile(errors, body);

  return createValidationResult(errors);
}

export function validateUnsubscribeRequest({ body }) {
  return validateEmail(body.email, { required: true });
}

export function validateUnsubscribeTokenRequest({ params }) {
  const errors = [];

  if (isEmpty(params.token) || !UUID_REGEX.test(params.token)) {
    errors.push(createValidationError("token", "token must be a valid UUID.", "params", "INVALID_UNSUBSCRIBE_TOKEN"));
  }

  return createValidationResult(errors);
}

export function validateNewsletterStatusRequest({ params, body }) {
  const errors = [...validateNewsletterIdRequest({ params }).errors];
  if (isEmpty(body.status) || !NEWSLETTER_STATUSES.includes(body.status)) {
    errors.push(createValidationError("status", "status must be subscribed or unsubscribed.", "body", "INVALID_NEWSLETTER_STATUS"));
  }
  return createValidationResult(errors);
}
function validateOptionalProfile(errors, body = {}) {
  if (!isEmpty(body.fullName) && String(body.fullName).length > 120) {
    errors.push(createValidationError("fullName", "fullName must not exceed 120 characters.", "body", "NEWSLETTER_FULL_NAME_TOO_LONG"));
  }

  if (!isEmpty(body.source) && !SOURCE_REGEX.test(body.source)) {
    errors.push(createValidationError("source", "source must contain letters, numbers, underscores, or hyphens.", "body", "INVALID_NEWSLETTER_SOURCE"));
  }
}

