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
      message: "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
      type: ERROR_TYPES.timeout,
      code: "REQUEST_TIMEOUT",
      cause: error,
      details: context,
      display: ERROR_DISPLAY.toast
    });
  }

  return new AppError({
    message: error?.message ?? "Đã có lỗi không xác định.",
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
    [ERROR_TYPES.validation]: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
    [ERROR_TYPES.notFound]: "Không tìm thấy tài nguyên yêu cầu.",
    [ERROR_TYPES.server]: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
    [ERROR_TYPES.network]: "Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.",
    [ERROR_TYPES.timeout]: "Yêu cầu quá thời gian chờ. Vui lòng thử lại.",
    [ERROR_TYPES.upload]: "Upload thất bại. Kiểm tra định dạng và dung lượng file.",
    [ERROR_TYPES.authentication]: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
    [ERROR_TYPES.authorization]: "Bạn không có quyền thực hiện thao tác này.",
    [ERROR_TYPES.database]: "Hệ thống dữ liệu đang gặp sự cố. Vui lòng thử lại sau.",
    [ERROR_TYPES.api]: error.message || "API trả về lỗi."
  };

  return messages[type] ?? error.message ?? "Đã có lỗi xảy ra.";
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
