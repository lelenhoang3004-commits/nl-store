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
import { createInventoryPage, initInventoryPage } from "../inventory/inventory.js";
import { createOrdersPage, initOrdersPage } from "../orders/orders.js";
import { createPaymentsPage, initPaymentsPage } from "../payments/payments.js";
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
    title: "Quản lý danh mục",
    breadcrumb: "Quản lý danh mục",
    menuKey: "categories",
    requiresAuth: true,
    permissions: [PERMISSIONS.CATEGORY_VIEW],
    render: createCategoriesPage,
    init: initCategoriesPage
  },
  {
    path: "products",
    aliases: ["product"],
    title: "Quản lý sản phẩm",
    breadcrumb: "Quản lý sản phẩm",
    menuKey: "products",
    requiresAuth: true,
    permissions: [PERMISSIONS.PRODUCT_VIEW],
    render: createProductsPage,
    init: initProductsPage
  },
  {
    path: "products/:id",
    title: "Chi tiết sản phẩm",
    breadcrumb: "Chi tiết sản phẩm",
    menuKey: "products",
    requiresAuth: true,
    permissions: [PERMISSIONS.PRODUCT_VIEW],
    render: createProductsPage,
    init: initProductsPage
  },
  {
    path: "inventory",
    title: "Quản lý tồn kho",
    breadcrumb: "Quản lý tồn kho",
    menuKey: "inventory",
    requiresAuth: true,
    permissions: [PERMISSIONS.INVENTORY_VIEW],
    render: createInventoryPage,
    init: initInventoryPage
  },
  {
    path: "users",
    aliases: ["user"],
    title: "Quản lý người dùng",
    breadcrumb: "Quản lý người dùng",
    menuKey: "users",
    requiresAuth: true,
    permissions: [PERMISSIONS.USER_VIEW],
    render: createUsersPage,
    init: initUsersPage
  },
  {
    path: "orders",
    aliases: ["order"],
    title: "Quản lý đơn hàng",
    breadcrumb: "Quản lý đơn hàng",
    menuKey: "orders",
    requiresAuth: true,
    permissions: [PERMISSIONS.ORDER_VIEW],
    render: createOrdersPage,
    init: initOrdersPage
  },
  {
    path: "orders/:id",
    title: "Chi tiết đơn hàng",
    breadcrumb: "Chi tiết đơn hàng",
    menuKey: "orders",
    requiresAuth: true,
    permissions: [PERMISSIONS.ORDER_VIEW],
    render: createOrdersPage,
    init: initOrdersPage
  },
  {
    path: "payments",
    aliases: ["payment"],
    title: "Quản lý thanh toán",
    breadcrumb: "Quản lý thanh toán",
    menuKey: "payments",
    requiresAuth: true,
    permissions: [PERMISSIONS.PAYMENT_VIEW],
    render: createPaymentsPage,
    init: initPaymentsPage
  },
  {
    path: "vouchers",
    aliases: ["voucher"],
    title: "Quản lý mã giảm giá",
    breadcrumb: "Quản lý mã giảm giá",
    menuKey: "vouchers",
    requiresAuth: true,
    permissions: [PERMISSIONS.VOUCHER_VIEW],
    render: createVouchersPage,
    init: initVouchersPage
  },
    {
    path: "newsletter",
    aliases: ["emails", "email"],
    title: "Đăng ký Email",
    breadcrumb: "Đăng ký Email",
    menuKey: "emails",
    requiresAuth: true,
    permissions: [PERMISSIONS.EMAIL_VIEW],
    render: createNewsletterPage,
    init: initNewsletterPage
  },
  createListRoute("statistics", "Thống kê", PERMISSIONS.STATISTIC_VIEW, ["statistic"]),
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
    path: "settings",
    title: "Cài đặt",
    breadcrumb: "Cài đặt",
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



