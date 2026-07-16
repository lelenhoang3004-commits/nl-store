import { PERMISSIONS } from "./permissions.js";
import { ROLES } from "./roles.js";

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.STAFF]: [],
  [ROLES.CUSTOMER]: [],
  [ROLES.GUEST]: []
});
