import { API_CONFIG } from "./api.config.js";
import { tokenService } from "./token.service.js";

let refreshPromise = null;

// Refresh is isolated here to avoid recursive ApiClient calls during 401 recovery.
export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = tokenService.getRefreshToken();

  refreshPromise = fetch(`${API_CONFIG.baseURL}${API_CONFIG.refreshEndpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    credentials: "include",
    body: refreshToken ? JSON.stringify({ refreshToken }) : undefined
  })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      const accessToken = payload?.data?.accessToken
        ?? payload?.data?.tokens?.accessToken
        ?? payload?.data?.token
        ?? payload?.accessToken;
      const nextRefreshToken = payload?.data?.refreshToken ?? payload?.refreshToken;

      if (accessToken) {
        tokenService.setAccessToken(accessToken);
      }

      if (nextRefreshToken) {
        tokenService.setRefreshToken(nextRefreshToken);
      }

      return accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
