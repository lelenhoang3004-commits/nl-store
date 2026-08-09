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
    super(message ?? "Kh\u00f4ng th\u1ec3 th\u1ef1c hi\u1ec7n y\u00eau c\u1ea7u API.");
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
      message: "Y\u00eau c\u1ea7u qu\u00e1 th\u1eddi gian ch\u1edd.",
      code: "REQUEST_TIMEOUT",
      isTimeout: true
    });
  }

  return new ApiError({
    message: error?.message ?? "C\u00f3 l\u1ed7i API kh\u00f4ng x\u00e1c \u0111\u1ecbnh.",
    code: "NETWORK_ERROR",
    details: error,
    isNetworkError: true
  });
}
