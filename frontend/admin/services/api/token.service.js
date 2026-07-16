const ACCESS_TOKEN_KEY = "fashion_admin_access_token";
const COMPAT_ACCESS_TOKEN_KEY = "fashion_access_token";
const REFRESH_TOKEN_KEY = "fashion_admin_refresh_token";
const LEGACY_SESSION_KEY = "fashion-admin-auth-session";

let accessTokenMemory = null;
let refreshTokenMemory = null;

export const tokenService = {
  getAccessToken() {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY)
      || localStorage.getItem(COMPAT_ACCESS_TOKEN_KEY);
    if (storedToken) {
      accessTokenMemory = storedToken;
      return storedToken;
    }
    accessTokenMemory = null;

    // One-way compatibility for sessions created before the storage-key fix.
    try {
      const legacySession = JSON.parse(localStorage.getItem(LEGACY_SESSION_KEY) || "null");
      if (legacySession?.accessToken) {
        this.setAccessToken(legacySession.accessToken);
        return legacySession.accessToken;
      }
    } catch {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
    return null;
  },

  setAccessToken(token) {
    accessTokenMemory = token || null;
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      localStorage.setItem(COMPAT_ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(COMPAT_ACCESS_TOKEN_KEY);
    }
  },

  getRefreshToken() {
    const storedToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    refreshTokenMemory = storedToken || null;
    return storedToken;
  },

  setRefreshToken(token) {
    refreshTokenMemory = token || null;
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  clearTokens() {
    accessTokenMemory = null;
    refreshTokenMemory = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(COMPAT_ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem("fashion-admin-access-token");
    localStorage.removeItem("fashion-admin-refresh-token");
  }
};

export { ACCESS_TOKEN_KEY, COMPAT_ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY };
