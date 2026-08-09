import {
  createChangePasswordPage,
  createForbiddenPage,
  createForgotPasswordPage,
  createLockScreenPage,
  createLoginPage,
  createNotFoundAuthPage,
  createResetPasswordPage,
  createServerErrorPage,
  createSessionExpiredPage,
  initChangePasswordPage,
  initForgotPasswordPage,
  initLockScreenPage,
  initLoginPage,
  initResetPasswordPage,
  initSessionExpiredPage
} from "../auth/auth.js";
import { createActivityTimelinePage, initActivityTimelinePage } from "../activity-timeline/activity-timeline.js";
import { createAuditLogPage, initAuditLogPage } from "../audit-log/audit-log.js";
import { createCategoriesPage, initCategoriesPage } from "../categories/categories.js";
import { createDashboard, initDashboard } from "../dashboard/dashboard.js";
import { createOrdersPage, initOrdersPage } from "../orders/orders.js";
import { createPaymentsPage, initPaymentsPage } from "../payments/payments.js";
import { createProfilePage, initProfilePage } from "../profile/profile.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { createProductsPage, initProductsPage } from "../products/products.js";
import { createUsersPage, initUsersPage } from "../users/users.js";
import { createVouchersPage, initVouchersPage } from "../vouchers/vouchers.js";
import { createNewsletterPage, initNewsletterPage } from "../newsletter/newsletter.js";
import { createSettingsPage, initSettingsPage } from "../settings/settings.js";
import { createGenericAdminPage, initGenericAdminPage } from "./page-factory.js";

function createListRoute(path, title, permission, aliases = []) {
  return {
    path,
    aliases,
    title,
    breadcrumb: title,
    menuKey: path,
    requiresAuth: true,
    permissions: [permission],
    render: (context) => createGenericAdminPage(context.route),
    init: initGenericAdminPage
  };
}

export const adminRoutes = [
  {
    path: "login",
    title: "Login",
    breadcrumb: "Login",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createLoginPage,
    init: initLoginPage
  },
  {
    path: "forgot-password",
    title: "Forgot Password",
    breadcrumb: "Forgot Password",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createForgotPasswordPage,
    init: initForgotPasswordPage
  },
  {
    path: "reset-password",
    title: "Reset Password",
    breadcrumb: "Reset Password",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createResetPasswordPage,
    init: initResetPasswordPage
  },
  {
    path: "change-password",
    title: "Change Password",
    breadcrumb: "Change Password",
    menuKey: null,
    requiresAuth: true,
    permissions: [],
    render: createChangePasswordPage,
    init: initChangePasswordPage
  },
  {
    path: "lock-screen",
    title: "Lock Screen",
    breadcrumb: "Lock Screen",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createLockScreenPage,
    init: initLockScreenPage
  },
  {
    path: "session-expired",
    title: "Session Expired",
    breadcrumb: "Session Expired",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createSessionExpiredPage,
    init: initSessionExpiredPage
  },
  {
    path: "dashboard",
    title: "Dashboard",
    breadcrumb: "Dashboard",
    menuKey: "dashboard",
    requiresAuth: true,
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    render: createDashboard,
    init: initDashboard
  },
  {
    path: "categories",
    aliases: ["category"],
    title: "Quáº£n lÃ½ danh má»¥c",
    breadcrumb: "Quáº£n lÃ½ danh má»¥c",
    menuKey: "categories",
    requiresAuth: true,
    permissions: [PERMISSIONS.CATEGORY_VIEW],
    render: createCategoriesPage,
    init: initCategoriesPage
  },
  {
    path: "products",
    aliases: ["product"],
    title: "Quáº£n lÃ½ sáº£n pháº©m",
    breadcrumb: "Quáº£n lÃ½ sáº£n pháº©m",
    menuKey: "products",
    requiresAuth: true,
    permissions: [PERMISSIONS.PRODUCT_VIEW],
    render: createProductsPage,
    init: initProductsPage
  },
  {
    path: "products/:id",
    title: "Chi tiáº¿t sáº£n pháº©m",
    breadcrumb: "Chi tiáº¿t sáº£n pháº©m",
    menuKey: "products",
    requiresAuth: true,
    permissions: [PERMISSIONS.PRODUCT_VIEW],
    render: createProductsPage,
    init: initProductsPage
  },
  {
    path: "users",
    aliases: ["user"],
    title: "Quáº£n lÃ½ ngÆ°á»i dÃ¹ng",
    breadcrumb: "Quáº£n lÃ½ ngÆ°á»i dÃ¹ng",
    menuKey: "users",
    requiresAuth: true,
    permissions: [PERMISSIONS.USER_VIEW],
    render: createUsersPage,
    init: initUsersPage
  },
  {
    path: "orders",
    aliases: ["order"],
    title: "Quáº£n lÃ½ Ä‘Æ¡n hÃ ng",
    breadcrumb: "Quáº£n lÃ½ Ä‘Æ¡n hÃ ng",
    menuKey: "orders",
    requiresAuth: true,
    permissions: [PERMISSIONS.ORDER_VIEW],
    render: createOrdersPage,
    init: initOrdersPage
  },
  {
    path: "orders/:id",
    title: "Chi tiáº¿t Ä‘Æ¡n hÃ ng",
    breadcrumb: "Chi tiáº¿t Ä‘Æ¡n hÃ ng",
    menuKey: "orders",
    requiresAuth: true,
    permissions: [PERMISSIONS.ORDER_VIEW],
    render: createOrdersPage,
    init: initOrdersPage
  },
  {
    path: "payments",
    aliases: ["payment"],
    title: "Quáº£n lÃ½ thanh toÃ¡n",
    breadcrumb: "Quáº£n lÃ½ thanh toÃ¡n",
    menuKey: "payments",
    requiresAuth: true,
    permissions: [PERMISSIONS.PAYMENT_VIEW],
    render: createPaymentsPage,
    init: initPaymentsPage
  },
  {
    path: "vouchers",
    aliases: ["voucher"],
    title: "Quáº£n lÃ½ mÃ£ giáº£m giÃ¡",
    breadcrumb: "Quáº£n lÃ½ mÃ£ giáº£m giÃ¡",
    menuKey: "vouchers",
    requiresAuth: true,
    permissions: [PERMISSIONS.VOUCHER_VIEW],
    render: createVouchersPage,
    init: initVouchersPage
  },
    {
    path: "newsletter",
    aliases: ["emails", "email"],
    title: "ÄÄƒng kÃ½ Email",
    breadcrumb: "ÄÄƒng kÃ½ Email",
    menuKey: "emails",
    requiresAuth: true,
    permissions: [PERMISSIONS.EMAIL_VIEW],
    render: createNewsletterPage,
    init: initNewsletterPage
  },
  createListRoute("statistics", "Thá»‘ng kÃª", PERMISSIONS.STATISTIC_VIEW, ["statistic"]),
  {
    path: "audit-log",
    aliases: ["audit"],
    title: "Audit Log",
    breadcrumb: "Audit Log",
    menuKey: null,
    requiresAuth: true,
    permissions: [PERMISSIONS.SETTING_VIEW],
    render: createAuditLogPage,
    init: initAuditLogPage
  },
  {
    path: "activity-timeline",
    aliases: ["activity"],
    title: "Activity Timeline",
    breadcrumb: "Activity Timeline",
    menuKey: null,
    requiresAuth: true,
    permissions: [PERMISSIONS.SETTING_VIEW],
    render: createActivityTimelinePage,
    init: initActivityTimelinePage
  },
  {
    path: "profile",
    title: "Há»“ sÆ¡ quáº£n trá»‹",
    breadcrumb: "Há»“ sÆ¡ quáº£n trá»‹",
    menuKey: null,
    requiresAuth: true,
    permissions: [],
    render: createProfilePage,
    init: initProfilePage
  },

  {
    path: "settings",
    title: "CÃ i Ä‘áº·t",
    breadcrumb: "CÃ i Ä‘áº·t",
    menuKey: "settings",
    requiresAuth: true,
    permissions: [PERMISSIONS.SETTING_VIEW],
    render: createSettingsPage,
    init: initSettingsPage
  },
  {
    path: "403",
    title: "403",
    breadcrumb: "403",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createForbiddenPage
  },
  {
    path: "500",
    title: "500",
    breadcrumb: "500",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: createServerErrorPage
  },
  {
    path: "404",
    title: "404",
    breadcrumb: "404",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: ({ route }) => createNotFoundAuthPage(route)
  }
];

export const DEFAULT_ADMIN_ROUTE = "dashboard";
