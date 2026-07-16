import { ApiError } from "../services/api/api-error.js";
import { AppError } from "./app-error.js";
import { ERROR_DISPLAY, ERROR_SEVERITY, ERROR_TYPES } from "./error-types.js";

// Converts unknown thrown values into AppError objects.
export function normalizeAppError(error, context = {}) {
  if (error instanceof AppError) {
    return mergeContext(error, context);
  }

  if (error instanceof ApiError) {
    return fromApiError(error, context);
  }

  if (error?.name === "AbortError") {
    return new AppError({
      message: "Yeu cau qua thoi gian cho. Vui long thu lai.",
      type: ERROR_TYPES.timeout,
      code: "REQUEST_TIMEOUT",
      cause: error,
      details: context,
      display: ERROR_DISPLAY.toast
    });
  }

  return new AppError({
    message: error?.message ?? "Da co loi khong xac dinh.",
    type: ERROR_TYPES.unknown,
    code: error?.code ?? "UNKNOWN_ERROR",
    details: context,
    cause: error,
    display: ERROR_DISPLAY.toast
  });
}

function fromApiError(error, context) {
  const type = getTypeFromApiError(error);
  const isCritical = error.status >= 500 || type === ERROR_TYPES.database;

  return new AppError({
    message: getFriendlyMessage(error, type),
    type,
    status: error.status,
    code: error.code,
    details: error.details ?? context,
    cause: error,
    severity: isCritical ? ERROR_SEVERITY.critical : ERROR_SEVERITY.error,
    display: getDisplayMode(type, error.status),
    retry: context.retry ?? null
  });
}

function getTypeFromApiError(error) {
  if (error.isTimeout || error.code === "REQUEST_TIMEOUT") {
    return ERROR_TYPES.timeout;
  }

  if (error.isNetworkError || error.code === "NETWORK_ERROR") {
    return ERROR_TYPES.network;
  }

  if (error.status === 401) {
    return ERROR_TYPES.authentication;
  }

  if (error.status === 403) {
    return ERROR_TYPES.authorization;
  }

  if (error.status === 404) {
    return ERROR_TYPES.notFound;
  }

  if (error.status >= 500) {
    return getDatabaseErrorCode(error) ? ERROR_TYPES.database : ERROR_TYPES.server;
  }

  if (String(error.code).includes("VALIDATION")) {
    return ERROR_TYPES.validation;
  }

  if (String(error.code).includes("UPLOAD")) {
    return ERROR_TYPES.upload;
  }

  return ERROR_TYPES.api;
}

function getFriendlyMessage(error, type) {
  const messages = {
    [ERROR_TYPES.validation]: "Du lieu chua hop le. Vui long kiem tra lai.",
    [ERROR_TYPES.notFound]: "Khong tim thay tai nguyen yeu cau.",
    [ERROR_TYPES.server]: "May chu dang gap su co. Vui long thu lai sau.",
    [ERROR_TYPES.network]: "Khong the ket noi may chu. Kiem tra mang va thu lai.",
    [ERROR_TYPES.timeout]: "Yeu cau qua thoi gian cho. Vui long thu lai.",
    [ERROR_TYPES.upload]: "Upload that bai. Kiem tra dinh dang va dung luong file.",
    [ERROR_TYPES.authentication]: "Phien dang nhap khong hop le hoac da het han.",
    [ERROR_TYPES.authorization]: "Ban khong co quyen thuc hien thao tac nay.",
    [ERROR_TYPES.database]: "He thong du lieu dang gap su co. Vui long thu lai sau.",
    [ERROR_TYPES.api]: error.message || "API tra ve loi."
  };

  return messages[type] ?? error.message ?? "Da co loi xay ra.";
}

function getDisplayMode(type, status) {
  if (type === ERROR_TYPES.authentication || type === ERROR_TYPES.authorization || status >= 500) {
    return ERROR_DISPLAY.modal;
  }

  return ERROR_DISPLAY.toast;
}

function getDatabaseErrorCode(error) {
  const code = String(error.code ?? error.details?.code ?? "");
  return code.startsWith("DB_") || code.includes("DATABASE") || code.includes("SQL");
}

function mergeContext(error, context) {
  return new AppError({
    ...error,
    details: {
      ...(error.details ?? {}),
      ...context
    }
  });
}
