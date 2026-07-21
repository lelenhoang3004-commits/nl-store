import {
  createValidationError,
  createValidationResult,
  VALIDATION_LOCATIONS
} from "./base.validator.js";

export function validateChatbotMessageRequest({ body }) {
  const errors = [];
  const message = typeof body?.message === "string" ? body.message : "";
  const conversationId = body?.conversationId;

  if (!message.trim()) {
    errors.push(createValidationError("message", "Message is required.", VALIDATION_LOCATIONS.BODY, "REQUIRED"));
  }

  if (message.length > 1000) {
    errors.push(createValidationError("message", "Message must be at most 1000 characters.", VALIDATION_LOCATIONS.BODY, "MAX_LENGTH"));
  }

  if (conversationId !== undefined && conversationId !== null && String(conversationId).length > 120) {
    errors.push(createValidationError("conversationId", "Conversation id is too long.", VALIDATION_LOCATIONS.BODY, "MAX_LENGTH"));
  }

  return createValidationResult(errors);
}
