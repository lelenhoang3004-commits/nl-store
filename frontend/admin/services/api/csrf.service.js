import { API_CONFIG } from "./api.config.js";

let csrfToken = "";
let csrfPromise = null;

// CSRF token bootstrap for deployments that enable cookie-backed unsafe requests.
export async function getCsrfToken() {
  if (!API_CONFIG.csrf.enabled) {
    return "";
  }

  if (csrfToken) {
    return csrfToken;
  }

  if (csrfPromise) {
    return csrfPromise;
  }

  csrfPromise = fetch(`${API_CONFIG.baseURL}${API_CONFIG.csrf.endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    credentials: "include"
  })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      csrfToken = payload?.data?.csrfToken ?? "";
      return csrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

export function clearCsrfToken() {
  csrfToken = "";
}
