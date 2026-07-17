const API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? (
  ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
    ? "http://localhost:5000/api/v1"
    : "https://nl-store.onrender.com/api/v1"
);
const ACCESS_TOKEN_KEY = "fashion-customer-access-token";
const ACCESS_TOKEN_SESSION_KEY = "fashion-customer-session-access-token";
const USER_KEY = "fashion-customer-user";
const REMEMBER_KEY = "fashion-customer-remember";
const REMEMBERED_EMAIL_KEY = "fashion-customer-remembered-email";
const AUTH_SYNC_KEY = "fashion-customer-auth-sync";

let accessTokenMemory = readStoredAccessToken();
let refreshPromise = null;
let lastRefreshFailureReason = null;  // Track why refresh last failed

// Concurrency guards
let isRefreshing = false;
let hasTriedInitialRefresh = false;

// Initialization guard
let authInitialized = false;

// Login submission guard
// Accessible via customerAuth.isLoginSubmitting

export const customerAuth = {
  isLoginSubmitting: false,
  getAccessToken() {
    return accessTokenMemory || readStoredAccessToken();
  },

  getUser() {
    return readJson(USER_KEY);
  },

  isAuthenticated() {
    return Boolean(this.getAccessToken() && this.getUser());
  },

  getRememberedEmail() {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  },

  async login({ email, password, remember }) {
    const response = await customerApi("/auth/login", {
      method: "POST",
      body: { email, password, remember: Boolean(remember) },
      auth: false,
      refreshOnUnauthorized: false
    });

    saveSession(response.data, Boolean(remember));
    return response.data;
  },

  getOAuthUrl(provider) {
    return `${API_BASE_URL}/auth/${provider}`;
  },

  async completeExternalLogin(payload, remember = true) {
    const accessToken = normalizeAccessToken(payload?.accessToken);
    console.info("[OAuth] token found:", Boolean(accessToken));
    console.info("[OAuth] token length:", accessToken.length);

    if (!accessToken) {
      throw createOAuthTokenError("Token đăng nhập Google không hợp lệ hoặc chưa được lưu.");
    }

    // Persist before /auth/me so every customer API request reads the same token key.
    saveSession({
      accessToken,
      user: payload?.user || this.getUser() || null
    }, remember);
    console.info("[OAuth] localStorage key saved:", remember ? ACCESS_TOKEN_KEY : ACCESS_TOKEN_SESSION_KEY);

    console.info("[OAuth] /auth/me bearer token present:", Boolean(accessToken));
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: {
        ...jsonHeaders(),
        Authorization: `Bearer ${accessToken}`
      },
      credentials: "include"
    });

    if (response.status === 401) {
      console.error("[OAuth] /auth/me unauthorized; bearer token present:", Boolean(accessToken));
      throw createOAuthTokenError("Token đăng nhập Google không hợp lệ hoặc chưa được lưu.", 401);
    }

    if (!response.ok) {
      throw await createApiError(response);
    }

    const result = await response.json();
    const verifiedUser = result?.data?.user || null;
    if (!verifiedUser) {
      throw createOAuthTokenError("Không thể xác thực tài khoản OAuth.");
    }

    const session = {
      accessToken,
      user: {
        ...(payload?.user || {}),
        ...verifiedUser
      }
    };

    saveSession(session, remember);
    return session;
  },
  clearExternalLogin(reason = "oauth-failed") {
    clearSession(reason);
  },

  async sendPhoneOtp(phone) {
    const response = await customerApi("/auth/phone/send-otp", {
      method: "POST", body: { phone }, auth: false, refreshOnUnauthorized: false
    });
    return response.data;
  },

  async verifyPhoneOtp(payload) {
    const response = await customerApi("/auth/phone/verify-otp", {
      method: "POST", body: payload, auth: false, refreshOnUnauthorized: false
    });
    saveSession(response.data, true);
    return response.data;
  },
  async register(payload) {
    const response = await customerApi("/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
      refreshOnUnauthorized: false
    });

    return response.data;
  },

  async logout(reason = "logout") {
    try {
      await customerApi("/auth/logout", {
        method: "POST",
        auth: false,
        refreshOnUnauthorized: false
      });
    } catch {
      // Local cleanup still matters if the server session is already gone.
    } finally {
      clearSession(reason);
    }
  },

  async refresh() {
    if (isRefreshing) return null;
    isRefreshing = true;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: jsonHeaders(),
        credentials: "include"
      });

      if (!response.ok) {
        const err = await createApiError(response);
        lastRefreshFailureReason = err?.status || null;

        if ([401, 403, 429].includes(err.status)) {
          clearSession("refresh-failed");
          notifyAuthChanged("guest");
          return null;
        }

        throw err;
      }

      const payload = await response.json();
      lastRefreshFailureReason = null;
      saveSession(payload.data, isRemembered());
      return payload.data.accessToken;
    } finally {
      isRefreshing = false;
    }
  },

  async restoreSession() {
    if (this.isAuthenticated()) {
      return this.getUser();
    }

    if (authInitialized) return null;
    authInitialized = true;

    if (!hasStoredAuthSession()) {
      hasTriedInitialRefresh = true;
      return null;
    }

    if (hasTriedInitialRefresh) return null;
    hasTriedInitialRefresh = true;

    try {
      const token = await this.refresh();
      return token ? this.getUser() : null;
    } catch (error) {
      clearSession("refresh-error");
      notifyAuthChanged("guest");
      return null;
    }
  }
};

export async function customerApi(path, options = {}) {
  const requestOptions = createRequestOptions(options);
  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
  // Do not attempt automatic refresh for auth endpoints themselves
  const isAuthEndpoint = String(path || "").startsWith("/auth/refresh") || String(path || "").startsWith("/auth/login") || String(path || "").startsWith("/auth/logout");

  // Retry-once logic for 401 responses (attempt refresh) but avoid retry loops and skip auth endpoints
  if (response.status === 401 && options.refreshOnUnauthorized !== false && !options._retried && !isAuthEndpoint && lastRefreshFailureReason !== 401) {
    try {
      const nextToken = await customerAuth.refresh();
      if (nextToken) {
        return customerApi(path, {
          ...options,
          _retried: true
        });
      }
    } catch (err) {
      // If refresh throws, do not call logout automatically; bubble up the original 401 below
    }
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  return response.status === 204 ? null : response.json();
}

export function showCustomerMessage(root, message, type = "error") {
  let target = root.querySelector("[data-auth-message]");

  if (!target) {
    target = document.createElement("div");
    target.className = "validation-summary";
    target.dataset.authMessage = "";
    root.prepend(target);
  }

  target.hidden = false;
  target.textContent = message;
  target.style.display = "block";
  target.style.borderColor = type === "success" ? "rgba(22, 163, 74, 0.28)" : "rgba(220, 38, 38, 0.28)";
  target.style.background = type === "success" ? "rgba(22, 163, 74, 0.08)" : "rgba(220, 38, 38, 0.08)";
  target.style.color = type === "success" ? "#166534" : "#991b1b";
}

function createRequestOptions(options) {
  const headers = {
    ...jsonHeaders(),
    ...(options.headers || {})
  };
  const token = customerAuth.getAccessToken();

  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  return {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: createRequestBody(options.body)
  };
}

function createRequestBody(body) {
  if (body === undefined || body === null) {
    return undefined;
  }

  return body instanceof FormData ? body : JSON.stringify(body);
}

function hasStoredAuthSession() {
  return (
    localStorage.getItem("fashion_auth_session") === "true" ||
    Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)) ||
    Boolean(sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY))
  );
}

function jsonHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function createApiError(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const error = new Error(payload?.message || "Yeu cau khong thanh cong. Vui long thu lai.");
  error.status = response.status;
  error.code = payload?.error?.code || "API_ERROR";
  error.details = payload?.error?.details || null;
  return error;
}

function normalizeAccessToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  return token && token !== "undefined" && token !== "null" ? token : "";
}

function createOAuthTokenError(message, status = 0) {
  const error = new Error(message);
  error.status = status;
  error.code = "OAUTH_TOKEN_INVALID";
  return error;
}

function saveSession(payload = {}, remember) {
  const accessToken = normalizeAccessToken(payload.accessToken);
  const user = payload.user || null;

  accessTokenMemory = accessToken;
  sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);

  if (remember) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REMEMBERED_EMAIL_KEY, user?.email || "");
  } else {
    sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, accessToken);
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Mark that this client has an authenticated session (used to gate initial refresh)
  try {
    localStorage.setItem("fashion_auth_session", "true");
  } catch {
    // ignore
  }
  notifyAuthChanged("login");
}

function clearSession(reason) {
  accessTokenMemory = null;
  sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  lastRefreshFailureReason = null;  // âœ“ FIX: Clear on logout so retry is possible on next login
  try {
    localStorage.removeItem("fashion_auth_session");
  } catch {}
  localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ reason, at: Date.now() }));
  notifyAuthChanged(reason);
}

function readStoredAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function isRemembered() {
  return localStorage.getItem(REMEMBER_KEY) === "1";
}

function readJson(key) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function notifyAuthChanged(reason) {
  window.dispatchEvent(new CustomEvent("fashion-customer-auth-changed", {
    detail: { reason }
  }));
}

window.addEventListener("storage", (event) => {
  if (event.key === AUTH_SYNC_KEY) {
    accessTokenMemory = readStoredAccessToken();
    notifyAuthChanged("storage-sync");
  }
});

