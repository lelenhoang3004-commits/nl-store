// Central API configuration for the admin frontend.
// Change window.FASHION_API_BASE_URL or this fallback when the backend URL changes.
const DEFAULT_API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? "http://localhost:5000/api/v1";

export const API_CONFIG = Object.freeze({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 15000,
  retry: {
    attempts: 1,
    delay: 500,
    statuses: [408, 500, 502, 503, 504]
  },
  refreshEndpoint: "/auth/refresh",
  csrf: {
    // Opt in only when the backend deployment enables CSRF protection.
    enabled: globalThis.FASHION_CSRF_ENABLED === true,
    endpoint: "/security/csrf-token",
    headerName: "X-CSRF-Token",
    protectedMethods: ["POST", "PUT", "PATCH", "DELETE"]
  },
  headers: {
    Accept: "application/json"
  },
  events: {
    unauthorized: "fashion-api:unauthorized",
    forbidden: "fashion-api:forbidden",
    serverError: "fashion-api:server-error"
  }
});
