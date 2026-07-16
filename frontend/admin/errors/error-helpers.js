import { AppError } from "./app-error.js";
import { ERROR_DISPLAY, ERROR_TYPES } from "./error-types.js";
import { globalErrorManager } from "./global-error-manager.js";

// Helper functions for common admin error scenarios.
export function reportValidationError(message = "Du lieu chua hop le.", details = null) {
  return globalErrorManager.handle(new AppError({
    message,
    type: ERROR_TYPES.validation,
    code: "VALIDATION_ERROR",
    details,
    display: ERROR_DISPLAY.toast
  }));
}

export function reportUploadError(message = "Upload that bai.", details = null) {
  return globalErrorManager.handle(new AppError({
    message,
    type: ERROR_TYPES.upload,
    code: "UPLOAD_ERROR",
    details,
    display: ERROR_DISPLAY.toast
  }));
}

export function reportAuthenticationError(message = "Phien dang nhap da het han.", retry = null) {
  return globalErrorManager.handle(new AppError({
    message,
    type: ERROR_TYPES.authentication,
    code: "AUTHENTICATION_ERROR",
    display: ERROR_DISPLAY.modal,
    retry
  }));
}

export function reportAuthorizationError(message = "Ban khong co quyen thuc hien thao tac nay.") {
  return globalErrorManager.handle(new AppError({
    message,
    type: ERROR_TYPES.authorization,
    code: "AUTHORIZATION_ERROR",
    display: ERROR_DISPLAY.modal
  }));
}

export function reportNotFoundError(message = "Khong tim thay tai nguyen.") {
  return globalErrorManager.handle(new AppError({
    message,
    type: ERROR_TYPES.notFound,
    code: "NOT_FOUND",
    status: 404,
    display: ERROR_DISPLAY.toast
  }));
}
