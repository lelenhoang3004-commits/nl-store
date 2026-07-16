import { ROLE_PERMISSIONS } from "./role-permissions.js";
import { ROLES } from "./roles.js";
import { getAuthenticatedUser, isLoggedIn } from "../auth/auth-session.js";

const MOCK_ROLE_STORAGE_KEY = "fashion-admin-mock-role";

export function getCurrentUser() {
  const authUser = getAuthenticatedUser();
  const role = authUser?.role ?? ROLES.GUEST;

  return {
    id: authUser?.id ?? null,
    name: authUser?.name ?? "Guest",
    email: authUser?.email ?? "",
    role,
    permissions: getUserPermissions(authUser, role)
  };
}

export function isAuthenticated() {
  return isLoggedIn();
}

export function setMockRole(role) {
  const nextRole = Object.values(ROLES).includes(role) ? role : ROLES.ADMIN;
  localStorage.setItem(MOCK_ROLE_STORAGE_KEY, nextRole);
}

export function getMockRole() {
  const storedRole = localStorage.getItem(MOCK_ROLE_STORAGE_KEY);
  return Object.values(ROLES).includes(storedRole) ? storedRole : ROLES.ADMIN;
}

export function getJwtPayloadPlaceholder() {
  return null;
}


function getUserPermissions(authUser, role) {
  if (Array.isArray(authUser?.permissions)) {
    return authUser.permissions;
  }

  if (role === ROLES.ADMIN) {
    return ROLE_PERMISSIONS[ROLES.ADMIN] ?? [];
  }

  return [];
}
