// Global error system entrypoint for admin frontend.
export { AppError } from "./app-error.js";
export {
  reportAuthenticationError,
  reportAuthorizationError,
  reportNotFoundError,
  reportUploadError,
  reportValidationError
} from "./error-helpers.js";
export { errorLogger, ErrorLogger } from "./error-logger.js";
export { normalizeAppError } from "./error-mapper.js";
export { errorRenderer, ErrorRenderer } from "./error-renderer.js";
export { ERROR_DISPLAY, ERROR_SEVERITY, ERROR_TYPES } from "./error-types.js";
export { ERROR_EVENTS, globalErrorManager, GlobalErrorManager } from "./global-error-manager.js";
