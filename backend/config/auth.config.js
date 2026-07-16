/**
 * Authentication and authorization constants.
 * Roles and permissions are centralized so route guards stay consistent.
 */
export const AUTH_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  CUSTOMER: "CUSTOMER",
  GUEST: "GUEST"
});

export const AUTH_PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: "dashboard:view",
  PRODUCT_VIEW: "product:view",
  PRODUCT_CREATE: "product:create",
  PRODUCT_UPDATE: "product:update",
  PRODUCT_DELETE: "product:delete",
  PRODUCT_MANAGE: "product:manage",
  CATEGORY_VIEW: "category:view",
  CATEGORY_CREATE: "category:create",
  CATEGORY_UPDATE: "category:update",
  CATEGORY_DELETE: "category:delete",
  CATEGORY_MANAGE: "category:manage",
  ORDER_VIEW: "order:view",
  ORDER_UPDATE: "order:update",
  ORDER_MANAGE: "order:manage",
  USER_VIEW: "user:view",
  USER_UPDATE: "user:update",
  USER_MANAGE: "user:manage",
  PAYMENT_VIEW: "payment:view",
  PAYMENT_UPDATE: "payment:update",
  PAYMENT_MANAGE: "payment:manage",
  VOUCHER_VIEW: "voucher:view",
  VOUCHER_CREATE: "voucher:create",
  VOUCHER_UPDATE: "voucher:update",
  VOUCHER_DELETE: "voucher:delete",
  VOUCHER_MANAGE: "voucher:manage",
  EMAIL_VIEW: "email:view",
  NEWSLETTER_VIEW: "newsletter:view",
  NEWSLETTER_UPDATE: "newsletter:update",
  NEWSLETTER_DELETE: "newsletter:delete",
  NEWSLETTER_MANAGE: "newsletter:manage",
  SETTING_MANAGE: "setting:manage"
});

export const ROLE_PERMISSIONS = Object.freeze({
  [AUTH_ROLES.ADMIN]: Object.values(AUTH_PERMISSIONS),
  [AUTH_ROLES.STAFF]: [
    AUTH_PERMISSIONS.DASHBOARD_VIEW,
    AUTH_PERMISSIONS.PRODUCT_VIEW,
    AUTH_PERMISSIONS.CATEGORY_VIEW,
    AUTH_PERMISSIONS.ORDER_VIEW,
    AUTH_PERMISSIONS.PAYMENT_VIEW,
    AUTH_PERMISSIONS.VOUCHER_VIEW,
    AUTH_PERMISSIONS.EMAIL_VIEW,
    AUTH_PERMISSIONS.NEWSLETTER_VIEW
  ],
  [AUTH_ROLES.CUSTOMER]: [],
  [AUTH_ROLES.GUEST]: []
});

export function getPermissionsByRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}
