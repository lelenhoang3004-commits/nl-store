import { canAccessRoute } from "../permissions/access-control.js";
import { isAuthenticated } from "../permissions/user-session.js";
import { clearExpiredSession, isSessionExpired } from "../auth/auth-session.js";

export async function runRouteGuards(route, context = {}) {
  const guards = route.guards ?? [authGuard, permissionGuard];

  for (const guard of guards) {
    const result = await guard(route, context);

    if (result !== true) {
      return result;
    }
  }

  return true;
}

export async function authGuard(route) {
  if (route.requiresAuth === false) {
    if (route.path === "login" && isAuthenticated()) {
      return {
        allowed: false,
        redirect: "dashboard",
        reason: "ALREADY_AUTHENTICATED"
      };
    }
    return true;
  }

  if (isSessionExpired()) {
    clearExpiredSession();
    return {
      allowed: false,
      redirect: "login",
      reason: "SESSION_EXPIRED"
    };
  }

  if (!isAuthenticated()) {
    return {
      allowed: false,
      redirect: "login",
      reason: "UNAUTHENTICATED"
    };
  }

  return true;
}

export async function permissionGuard(route) {
  if (!canAccessRoute(route)) {
    return {
      allowed: false,
      redirect: "403",
      reason: "FORBIDDEN"
    };
  }

  return true;
}
