// Error taxonomy used by the global frontend error system.
export const ERROR_TYPES = Object.freeze({
  api: "API_ERROR",
  validation: "VALIDATION_ERROR",
  notFound: "NOT_FOUND_ERROR",
  server: "SERVER_ERROR",
  network: "NETWORK_ERROR",
  timeout: "TIMEOUT_ERROR",
  upload: "UPLOAD_ERROR",
  authentication: "AUTHENTICATION_ERROR",
  authorization: "AUTHORIZATION_ERROR",
  database: "DATABASE_ERROR",
  unknown: "UNKNOWN_ERROR"
});

export const ERROR_SEVERITY = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
  critical: "critical"
});

export const ERROR_DISPLAY = Object.freeze({
  silent: "silent",
  toast: "toast",
  modal: "modal"
});
