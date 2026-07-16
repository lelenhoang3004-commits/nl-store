import { ROLES } from "../permissions/roles.js";
import { tokenService } from "../services/api/token.service.js";

const API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? "http://localhost:5000/api/v1";

const STORAGE_KEYS = {
  accessToken: "fashion_admin_access_token",
  user: "fashion_admin_user",
  compatAccessToken: "fashion_access_token",
  compatUser: "fashion_user",
  session: "fashion_admin_session",
  legacySession: "fashion-admin-auth-session",
  rememberedEmail: "fashion-admin-remembered-email",
  syncEvent: "fashion-admin-auth-sync"
};

const SESSION_DURATION = {
  normal: 30 * 60 * 1000,
  remembered: 7 * 24 * 60 * 60 * 1000,
  token: 5 * 60 * 1000,
  idle: 15 * 60 * 1000
};

let managerStarted = false;
let refreshTimer = null;
let idleTimer = null;
let lastActivitySyncAt = 0;
let storageSyncHandler = null;
let activityTrackingBound = false;

const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

export async function loginAdminAccount({ email, password, remember }) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  let payload;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: normalizedEmail, password: String(password ?? "") })
    });
    payload = await readJsonResponse(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || payload?.error?.message || "Email hoặc mật khẩu không chính xác.");
    }
  } catch (error) {
    return { ok: false, reason: "LOGIN_FAILED", message: error.message || "Đăng nhập thất bại." };
  }

  const authData = payload.data || {};
  const accessToken = authData.accessToken
    || authData.tokens?.accessToken
    || authData.token
    || payload.accessToken
    || "";
  const user = authData.user || payload.user;
  const role = String(user?.role || "").toUpperCase();

  if (!accessToken || !user) {
    tokenService.clearTokens();
    clearStoredAuth();
    return { ok: false, reason: "INVALID_LOGIN_RESPONSE", message: "Phản hồi đăng nhập không có token hoặc thông tin người dùng." };
  }

  if (![ROLES.ADMIN, ROLES.STAFF].includes(role)) {
    tokenService.clearTokens();
    clearStoredAuth();
    return { ok: false, reason: "ADMIN_ROLE_REQUIRED", message: "Bạn không có quyền truy cập trang quản trị" };
  }

  const normalizedUser = { ...user, role };
  tokenService.setAccessToken(accessToken);
  if (authData.refreshToken) tokenService.setRefreshToken(authData.refreshToken);
  const now = Date.now();
  const session = {
    user: normalizedUser,
    accessToken,
    remember: Boolean(remember),
    createdAt: now,
    lastActivityAt: now,
    tokenExpiresAt: getTokenExpiresAt(accessToken, now),
    idleExpiresAt: now + SESSION_DURATION.idle,
    refreshExpiresAt: now + (remember ? SESSION_DURATION.remembered : SESSION_DURATION.normal),
    expiresAt: now + (remember ? SESSION_DURATION.remembered : SESSION_DURATION.normal)
  };

  saveSession(session, "login");

  if (remember) {
    localStorage.setItem(STORAGE_KEYS.rememberedEmail, user.email);
  } else {
    localStorage.removeItem(STORAGE_KEYS.rememberedEmail);
  }

  return {
    ok: true,
    session
  };
}

export function logoutAdminAccount(reason = "logout") {
  clearStoredAuth();
  tokenService.clearTokens();
  syncAcrossTabs(reason);
  notifyAuthChanged(reason);
}

export function getAuthSession() {
  try {
    const accessToken = getAdminToken();
    const user = getAdminUser();
    const rawSession = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");

    if (accessToken && isAdminUser(user)) {
      if (rawSession?.accessToken === accessToken && isAdminUser(rawSession.user)) {
        return rawSession;
      }
      const restoredSession = createRestoredSession(accessToken, user);
      saveSession(restoredSession, "session-restored");
      return restoredSession;
    }

    const legacySession = JSON.parse(localStorage.getItem(STORAGE_KEYS.legacySession) || "null");
    if (legacySession?.accessToken && isAdminUser(legacySession.user)) {
      saveSession(legacySession, "session-migrated");
      tokenService.setAccessToken(legacySession.accessToken);
      localStorage.removeItem(STORAGE_KEYS.legacySession);
      return legacySession;
    }
    return null;
  } catch (error) {
    localStorage.removeItem(STORAGE_KEYS.session);
    return null;
  }
}

export function getAdminToken() {
  return localStorage.getItem(STORAGE_KEYS.accessToken)
    || localStorage.getItem(STORAGE_KEYS.compatAccessToken)
    || "";
}

export function getAdminUser() {
  const rawUser = localStorage.getItem(STORAGE_KEYS.user)
    || localStorage.getItem(STORAGE_KEYS.compatUser);
  try {
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function isAdminUser(user) {
  return [ROLES.ADMIN, ROLES.STAFF].includes(String(user?.role || "").toUpperCase());
}

export function getAuthenticatedUser() {
  const session = getAuthSession();
  return isSessionActive(session) ? session.user : null;
}

export function isLoggedIn() {
  return Boolean(getAuthenticatedUser());
}

export function isSessionExpired() {
  const session = getAuthSession();
  return Boolean(session && getSessionExpireReason(session));
}

export function clearExpiredSession() {
  if (isSessionExpired()) {
    logoutAdminAccount("session-expired");
  }
}

export function getRememberedEmail() {
  const rememberedEmail = localStorage.getItem(STORAGE_KEYS.rememberedEmail) ?? "";
  if (rememberedEmail.toLowerCase().endsWith(".local")) {
    localStorage.removeItem(STORAGE_KEYS.rememberedEmail);
    return "";
  }
  return rememberedEmail;
}

export function getSessionTimeRemaining() {
  const session = getAuthSession();

  if (!session) {
    return 0;
  }

  return Math.max(0, getNextSessionDeadline(session) - Date.now());
}

export function getAccessToken() {
  const session = getAuthSession();
  return isSessionActive(session) ? session.accessToken : "";
}

export function getRefreshToken() {
  const session = getAuthSession();
  return session?.refreshToken ?? "";
}

export function isAccessTokenExpired() {
  const session = getAuthSession();
  return Boolean(session && Date.now() >= session.tokenExpiresAt);
}

export async function refreshSessionToken() {
  const session = getAuthSession();

  if (!session || Date.now() >= session.refreshExpiresAt) {
    logoutAdminAccount("refresh-expired");
    return null;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include"
    });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.message || "Refresh failed");
    const now = Date.now();
    const accessToken = payload.data?.accessToken
      || payload.data?.tokens?.accessToken
      || payload.data?.token
      || payload.accessToken;
    if (!accessToken) throw new Error("Refresh response did not include an access token.");
    tokenService.setAccessToken(accessToken);
    const refreshedSession = { ...session, accessToken, tokenExpiresAt: getTokenExpiresAt(accessToken, now) };
    saveSession(refreshedSession, "token-refreshed");
    return accessToken;
  } catch {
    logoutAdminAccount("refresh-expired");
    return null;
  }
}

export function touchSessionActivity() {
  const now = Date.now();

  if (now - lastActivitySyncAt < 2000) {
    return;
  }

  const session = getAuthSession();

  if (!isSessionActive(session)) {
    return;
  }

  lastActivitySyncAt = now;
  saveSession({
    ...session,
    lastActivityAt: now,
    idleExpiresAt: now + SESSION_DURATION.idle
  }, "activity");
}

export function startSessionManager(callbacks = {}) {
  if (managerStarted) {
    scheduleSessionChecks(callbacks);
    return;
  }

  managerStarted = true;
  bindActivityTracking();
  bindMultiTabSync(callbacks);
  scheduleSessionChecks(callbacks);
}

export function stopSessionManager() {
  window.clearTimeout(refreshTimer);
  window.clearTimeout(idleTimer);
  unbindActivityTracking();
  unbindMultiTabSync();
  managerStarted = false;
}

function isSessionActive(session) {
  return Boolean(session?.user && !getSessionExpireReason(session));
}

function getSessionExpireReason(session) {
  const now = Date.now();

  if (!session?.user) {
    return "missing-session";
  }

  if (now >= session.refreshExpiresAt || now >= session.expiresAt) {
    return "session-expired";
  }

  if (now >= session.idleExpiresAt) {
    return "idle-timeout";
  }

  return "";
}

function getNextSessionDeadline(session) {
  return Math.min(session.expiresAt, session.refreshExpiresAt, session.idleExpiresAt);
}

function scheduleSessionChecks(callbacks) {
  window.clearTimeout(refreshTimer);
  window.clearTimeout(idleTimer);

  const session = getAuthSession();

  if (!session) {
    return;
  }

  const expireReason = getSessionExpireReason(session);

  if (expireReason) {
    logoutAdminAccount(expireReason);
    callbacks.onSessionExpired?.(expireReason);
    return;
  }

  const refreshIn = Math.max(0, session.tokenExpiresAt - Date.now() - 60 * 1000);
  const idleIn = Math.max(0, getNextSessionDeadline(session) - Date.now());

  refreshTimer = window.setTimeout(async () => {
    const token = await refreshSessionToken();
    callbacks.onTokenRefreshed?.(token);
    scheduleSessionChecks(callbacks);
  }, refreshIn);

  idleTimer = window.setTimeout(() => {
    const reason = getSessionExpireReason(getAuthSession()) || "session-expired";
    logoutAdminAccount(reason);
    callbacks.onSessionExpired?.(reason);
  }, idleIn);
}

function bindActivityTracking() {
  if (activityTrackingBound) {
    return;
  }

  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, touchSessionActivity, { passive: true });
  });
  activityTrackingBound = true;
}

function bindMultiTabSync(callbacks) {
  unbindMultiTabSync();

  storageSyncHandler = (event) => {
    if (event.key !== STORAGE_KEYS.syncEvent) {
      return;
    }

    const detail = parseSyncEvent(event.newValue);
    notifyAuthChanged(detail.reason || "multi-tab-sync");
    callbacks.onSessionChanged?.(detail.reason || "multi-tab-sync");

    if (!getAuthSession() && detail.reason !== "login") {
      callbacks.onLoggedOutInAnotherTab?.(detail.reason || "multi-tab-logout");
    }

    scheduleSessionChecks(callbacks);
  };

  window.addEventListener("storage", storageSyncHandler);
}

function unbindActivityTracking() {
  if (!activityTrackingBound) {
    return;
  }

  ACTIVITY_EVENTS.forEach((eventName) => {
    window.removeEventListener(eventName, touchSessionActivity);
  });
  activityTrackingBound = false;
}

function unbindMultiTabSync() {
  if (!storageSyncHandler) {
    return;
  }

  window.removeEventListener("storage", storageSyncHandler);
  storageSyncHandler = null;
}

function saveSession(session, reason) {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(session.user));
  localStorage.setItem(STORAGE_KEYS.compatUser, JSON.stringify(session.user));
  tokenService.setAccessToken(session.accessToken);
  syncAcrossTabs(reason);

  if (reason !== "activity") {
    notifyAuthChanged(reason);
  }
}

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEYS.session);
  localStorage.removeItem(STORAGE_KEYS.legacySession);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.compatUser);
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.compatAccessToken);
}

function createRestoredSession(accessToken, user) {
  const now = Date.now();
  return {
    user: { ...user, role: String(user.role).toUpperCase() },
    accessToken,
    remember: false,
    createdAt: now,
    lastActivityAt: now,
    tokenExpiresAt: getTokenExpiresAt(accessToken, now),
    idleExpiresAt: now + SESSION_DURATION.idle,
    refreshExpiresAt: now + SESSION_DURATION.normal,
    expiresAt: now + SESSION_DURATION.normal
  };
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    if (!response.ok) throw new Error(`Đăng nhập thất bại (HTTP ${response.status}).`);
    throw new Error("Backend trả về dữ liệu đăng nhập không hợp lệ.");
  }
}

function getTokenExpiresAt(token, fallbackNow = Date.now()) {
  try {
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encodedPayload));
    if (Number(payload.exp) > 0) return Number(payload.exp) * 1000;
  } catch {
    // Opaque tokens use a conservative fallback.
  }
  return fallbackNow + 14 * 60 * 1000;
}

function syncAcrossTabs(reason) {
  localStorage.setItem(STORAGE_KEYS.syncEvent, JSON.stringify({
    reason,
    at: Date.now()
  }));
}

function parseSyncEvent(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return {};
  }
}

function notifyAuthChanged(reason) {
  window.dispatchEvent(new CustomEvent("fashion-admin-auth-changed", {
    detail: { reason }
  }));
}
