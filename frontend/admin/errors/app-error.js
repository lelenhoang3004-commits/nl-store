import { ERROR_DISPLAY, ERROR_SEVERITY, ERROR_TYPES } from "./error-types.js";

// Application-level error normalized before logging or rendering.
export class AppError extends Error {
  constructor({
    message = "Co loi xay ra.",
    type = ERROR_TYPES.unknown,
    status = 0,
    code = "APP_ERROR",
    details = null,
    cause = null,
    severity = ERROR_SEVERITY.error,
    display = ERROR_DISPLAY.toast,
    retry = null
  } = {}) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.status = status;
    this.code = code;
    this.details = details;
    this.cause = cause;
    this.severity = severity;
    this.display = display;
    this.retry = retry;
    this.createdAt = new Date().toISOString();
  }
}
