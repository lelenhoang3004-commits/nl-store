import { PERMISSIONS } from "../permissions/permissions.js";

function lazyRoute(loadModule, renderName, initName = "", mapRenderArgs = null) {
  let modulePromise = null;
  let moduleValue = null;

  async function getModule() {
    if (moduleValue) return moduleValue;
    modulePromise ||= loadModule();
    moduleValue = await modulePromise;
    return moduleValue;
  }

  return {
    async render(args) {
      return (await getModule())[renderName](mapRenderArgs ? mapRenderArgs(args) : args);
    },
    init: initName ? (...args) => moduleValue?.[initName]?.(...args) : undefined
  };
}

const auth = {
  login: lazyRoute(() => import("../auth/auth.js"), "createLoginPage", "initLoginPage"),
  forgotPassword: lazyRoute(() => import("../auth/auth.js"), "createForgotPasswordPage", "initForgotPasswordPage"),
  resetPassword: lazyRoute(() => import("../auth/auth.js"), "createResetPasswordPage", "initResetPasswordPage"),
  changePassword: lazyRoute(() => import("../auth/auth.js"), "createChangePasswordPage", "initChangePasswordPage"),
  lockScreen: lazyRoute(() => import("../auth/auth.js"), "createLockScreenPage", "initLockScreenPage"),
  sessionExpired: lazyRoute(() => import("../auth/auth.js"), "createSessionExpiredPage", "initSessionExpiredPage"),
  forbidden: lazyRoute(() => import("../auth/auth.js"), "createForbiddenPage"),
  notFound: lazyRoute(() => import("../auth/auth.js"), "createNotFoundAuthPage", "", ({ route }) => route),
  serverError: lazyRoute(() => import("../auth/auth.js"), "createServerErrorPage")
};

const pages = {
  activityTimeline: lazyRoute(() => import("../activity-timeline/activity-timeline.js"), "createActivityTimelinePage", "initActivityTimelinePage"),
  auditLog: lazyRoute(() => import("../audit-log/audit-log.js"), "createAuditLogPage", "initAuditLogPage"),
  categories: lazyRoute(() => import("../categories/categories.js"), "createCategoriesPage", "initCategoriesPage"),
  dashboard: lazyRoute(() => import("../dashboard/dashboard.js"), "createDashboard", "initDashboard"),
  orders: lazyRoute(() => import("../orders/orders.js"), "createOrdersPage", "initOrdersPage"),
  payments: lazyRoute(() => import("../payments/payments.js"), "createPaymentsPage", "initPaymentsPage"),
  profile: lazyRoute(() => import("../profile/profile.js"), "createProfilePage", "initProfilePage"),
  products: lazyRoute(() => import("../products/products.js"), "createProductsPage", "initProductsPage"),
  users: lazyRoute(() => import("../users/users.js"), "createUsersPage", "initUsersPage"),
  vouchers: lazyRoute(() => import("../vouchers/vouchers.js"), "createVouchersPage", "initVouchersPage"),
  newsletter: lazyRoute(() => import("../newsletter/newsletter.js"), "createNewsletterPage", "initNewsletterPage"),
  settings: lazyRoute(() => import("../settings/settings.js"), "createSettingsPage", "initSettingsPage")
};

export const adminRoutes = [
  {
    path: "login",
    title: "Login",
    breadcrumb: "Login",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.login.render,
    init: auth.login.init
  },
  {
    path: "forgot-password",
    title: "Forgot Password",
    breadcrumb: "Forgot Password",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.forgotPassword.render,
    init: auth.forgotPassword.init
  },
  {
    path: "reset-password",
    title: "Reset Password",
    breadcrumb: "Reset Password",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.resetPassword.render,
    init: auth.resetPassword.init
  },
  {
    path: "change-password",
    title: "Change Password",
    breadcrumb: "Change Password",
    menuKey: null,
    requiresAuth: true,
    permissions: [],
    render: auth.changePassword.render,
    init: auth.changePassword.init
  },
  {
    path: "lock-screen",
    title: "Lock Screen",
    breadcrumb: "Lock Screen",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.lockScreen.render,
    init: auth.lockScreen.init
  },
  {
    path: "session-expired",
    title: "Session Expired",
    breadcrumb: "Session Expired",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.sessionExpired.render,
    init: auth.sessionExpired.init
  },
  {
    path: "dashboard",
    title: "Dashboard",
    breadcrumb: "Dashboard",
    menuKey: "dashboard",
    requiresAuth: true,
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
    render: pages.dashboard.render,
    init: pages.dashboard.init
  },
  {
    path: "categories",
    aliases: ["category"],
    title: "Quản lý danh mục",
    breadcrumb: "Quản lý danh mục",
    menuKey: "categories",
    requiresAuth: true,
    permissions: [PERMISSIONS.CATEGORY_VIEW],
    render: pages.categories.render,
    init: pages.categories.init
  },
  {
    path: "products",
    aliases: ["product"],
    title: "Quản lý sản phẩm",
    breadcrumb: "Quản lý sản phẩm",
    menuKey: "products",
    requiresAuth: true,
    permissions: [PERMISSIONS.PRODUCT_VIEW],
    render: pages.products.render,
    init: pages.products.init
  },
  {
    path: "products/:id",
    title: "Chi tiết sản phẩm",
    breadcrumb: "Chi tiết sản phẩm",
    menuKey: "products",
    requiresAuth: true,
    permissions: [PERMISSIONS.PRODUCT_VIEW],
    render: pages.products.render,
    init: pages.products.init
  },
  {
    path: "users",
    aliases: ["user"],
    title: "Quản lý người dùng",
    breadcrumb: "Quản lý người dùng",
    menuKey: "users",
    requiresAuth: true,
    permissions: [PERMISSIONS.USER_VIEW],
    render: pages.users.render,
    init: pages.users.init
  },
  {
    path: "orders",
    aliases: ["order"],
    title: "Quản lý đơn hàng",
    breadcrumb: "Quản lý đơn hàng",
    menuKey: "orders",
    requiresAuth: true,
    permissions: [PERMISSIONS.ORDER_VIEW],
    render: pages.orders.render,
    init: pages.orders.init
  },
  {
    path: "orders/:id",
    title: "Chi tiết đơn hàng",
    breadcrumb: "Chi tiết đơn hàng",
    menuKey: "orders",
    requiresAuth: true,
    permissions: [PERMISSIONS.ORDER_VIEW],
    render: pages.orders.render,
    init: pages.orders.init
  },
  {
    path: "payments",
    aliases: ["payment"],
    title: "Quản lý thanh toán",
    breadcrumb: "Quản lý thanh toán",
    menuKey: "payments",
    requiresAuth: true,
    permissions: [PERMISSIONS.PAYMENT_VIEW],
    render: pages.payments.render,
    init: pages.payments.init
  },
  {
    path: "vouchers",
    aliases: ["voucher"],
    title: "Quản lý mã giảm giá",
    breadcrumb: "Quản lý mã giảm giá",
    menuKey: "vouchers",
    requiresAuth: true,
    permissions: [PERMISSIONS.VOUCHER_VIEW],
    render: pages.vouchers.render,
    init: pages.vouchers.init
  },
    {
    path: "newsletter",
    aliases: ["emails", "email"],
    title: "Đăng ký Email",
    breadcrumb: "Đăng ký Email",
    menuKey: "emails",
    requiresAuth: true,
    permissions: [PERMISSIONS.EMAIL_VIEW],
    render: pages.newsletter.render,
    init: pages.newsletter.init
  },
  {
    path: "audit-log",
    aliases: ["audit"],
    title: "Audit Log",
    breadcrumb: "Audit Log",
    menuKey: null,
    requiresAuth: true,
    permissions: [PERMISSIONS.SETTING_VIEW],
    render: pages.auditLog.render,
    init: pages.auditLog.init
  },
  {
    path: "activity-timeline",
    aliases: ["activity"],
    title: "Activity Timeline",
    breadcrumb: "Activity Timeline",
    menuKey: null,
    requiresAuth: true,
    permissions: [PERMISSIONS.SETTING_VIEW],
    render: pages.activityTimeline.render,
    init: pages.activityTimeline.init
  },
  {
    path: "profile",
    title: "Hồ sơ quản trị",
    breadcrumb: "Hồ sơ quản trị",
    menuKey: null,
    requiresAuth: true,
    permissions: [],
    render: pages.profile.render,
    init: pages.profile.init
  },

  {
    path: "settings",
    title: "Cài đặt",
    breadcrumb: "Cài đặt",
    menuKey: "settings",
    requiresAuth: true,
    permissions: [PERMISSIONS.SETTING_VIEW],
    render: pages.settings.render,
    init: pages.settings.init
  },
  {
    path: "403",
    title: "403",
    breadcrumb: "403",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.forbidden.render
  },
  {
    path: "500",
    title: "500",
    breadcrumb: "500",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.serverError.render
  },
  {
    path: "404",
    title: "404",
    breadcrumb: "404",
    menuKey: null,
    requiresAuth: false,
    permissions: [],
    render: auth.notFound.render
  }
];

export const DEFAULT_ADMIN_ROUTE = "dashboard";
