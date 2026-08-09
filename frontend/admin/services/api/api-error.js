// Normalized error object used by every service and page.
export class ApiError extends Error {
  constructor({
    message,
    status = 0,
    code = "API_ERROR",
    details = null,
    response = null,
    isTimeout = false,
    isNetworkError = false
  } = {}) {
    super(message ?? "Kh?ng th? th?c hi?n y?u c?u API.");
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.response = response;
    this.isTimeout = isTimeout;
    this.isNetworkError = isNetworkError;
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error?.name === "AbortError") {
    return new ApiError({
      message: "Y?u c?u qu? th?i gian ch?.",
      code: "REQUEST_TIMEOUT",
      isTimeout: true
    });
  }

  return new ApiError({
    message: error?.message ?? "C? l?i API kh?ng x?c ??nh.",
    code: "NETWORK_ERROR",
    details: error,
    isNetworkError: true
  });
}
