/**
 * Backward-compatible auth middleware exports.
 * New modules should import from authentication, role, permission, or authorization middleware directly.
 */
export { authenticate } from "./authentication.middleware.js";
export { authorize } from "./authorization.middleware.js";
export { authorizeRoles } from "./role.middleware.js";
export { authorizePermissions } from "./permission.middleware.js";
