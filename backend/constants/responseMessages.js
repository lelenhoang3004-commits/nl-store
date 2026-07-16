/**
 * Shared response messages for consistent API responses.
 */
export const RESPONSE_MESSAGES = Object.freeze({
  SUCCESS: "Request completed successfully.",
  CREATED: "Resource created successfully.",
  UPDATED: "Resource updated successfully.",
  DELETED: "Resource deleted successfully.",
  NOT_FOUND: "Resource not found.",
  VALIDATION_ERROR: "Validation failed.",
  UNAUTHORIZED: "Authentication is required.",
  FORBIDDEN: "You do not have permission to perform this action.",
  SERVER_ERROR: "Internal server error."
});
