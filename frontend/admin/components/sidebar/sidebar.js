import { filterMenuByPermission } from "../../permissions/access-control.js";
import { PERMISSIONS } from "../../permissions/permissions.js";
import { getCurrentUser } from "../../permissions/user-session.js";
import { sidebarCountsService } from "../../services/sidebar-counts.service.js";

const REFRESH_INTERVAL_MS = 60000;

const BADGE_CONFIG = Object.freeze({
  products: {
    key: "products_attention",
    title: (count) => `${count} sản phẩm cần kiểm tra tồn kho`,
    aria: (count) => `${count} sản phẩm cần kiểm tra tồn kho`
  },
  inventory: {
    key: "products_attention",
    title: (count) => `${count} sản phẩm có biến thể hết hàng hoặc sắp hết`,
    aria: (count) => `${count} sản phẩm có biến thể hết hàng hoặc sắp hết`
  },
  orders: {
    key: "pending_orders",
    title: (count) => `${count} đơn hàng đang chờ xác nhận`,
    aria: (count) => `${count} đơn hàng đang chờ xác nhận`
  },
  payments: {
    key: "pending_payments",
    title: (count) => `${count} giao dịch đang chờ xác nhận`,
    aria: (count) => `${count} giao dịch đang chờ xác nhận`
  },
  emails: {
    key: "unread_newsletter",
    title: (count) => `${count} đăng ký email mới`,
    aria: (count) => `${count} đăng ký email mới`
  }
});

export const adminMenuItems = [
  { page: "dashboard", icon: "fa-chart-line", label: "Dashboard", permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  { page: "products", icon: "fa-shirt", label: "Quản lý sản phẩm", badgeKey: "products", permissions: [PERMISSIONS.PRODUCT_VIEW] },
  { page: "inventory", icon: "fa-warehouse", label: "Quản lý tồn kho", badgeKey: "inventory", permissions: [PERMISSIONS.INVENTORY_VIEW] },
  { page: "categories", icon: "fa-tags", label: "Quản lý danh mục", permissions: [PERMISSIONS.CATEGORY_VIEW] },
  { page: "users", icon: "fa-users", label: "Quản lý người dùng", permissions: [PERMISSIONS.USER_VIEW] },
  { page: "orders", icon: "fa-box-open", label: "Quản lý đơn hàng", badgeKey: "orders", permissions: [PERMISSIONS.ORDER_VIEW] },
  { page: "payments", icon: "fa-credit-card", label: "Quản lý thanh toán", badgeKey: "payments", permissions: [PERMISSIONS.PAYMENT_VIEW] },
  { page: "vouchers", icon: "fa-ticket", label: "Quản lý mã giảm giá", permissions: [PERMISSIONS.VOUCHER_VIEW] },
  { page: "emails", icon: "fa-envelope-open-text", label: "Đăng ký Email", badgeKey: "emails", permissions: [PERMISSIONS.EMAIL_VIEW, PERMISSIONS.NEWSLETTER_VIEW] },
  { page: "statistics", icon: "fa-chart-pie", label: "Thống kê", permissions: [PERMISSIONS.STATISTIC_VIEW] },
  { page: "settings", icon: "fa-gear", label: "Cài đặt", permissions: [PERMISSIONS.SETTING_VIEW] }
];

let sidebarCounts = {};
let refreshTimer = null;
let refreshInFlight = null;
let focusBound = false;

export function createSidebar(activePage = "dashboard") {
  const currentUser = getCurrentUser();
  const visibleMenuItems = filterMenuByPermission(adminMenuItems, currentUser);
  startAdminSidebarCounts();

  return `
    <div class="sidebar-brand">
      <div class="brand-mark" aria-hidden="true">
        <i class="fa-solid fa-bag-shopping"></i>
      </div>
      <div class="brand-copy">
        <strong>N&amp;L Store</strong>
        <span>${currentUser.role}</span>
      </div>
      <button class="sidebar-collapse-button" type="button" aria-label="Thu gọn sidebar" data-sidebar-collapse>
        <i class="fa-solid fa-angles-left" aria-hidden="true"></i>
      </button>
    </div>

    <nav class="sidebar-nav" aria-label="Admin menu">
      ${visibleMenuItems.map((item) => createMenuItem(item, activePage)).join("")}
    </nav>

  `;
}

export function setActiveSidebarItem(page) {
  document.querySelectorAll("[data-page]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === page);
  });
}

export function startAdminSidebarCounts() {
  if (!focusBound) {
    window.addEventListener("focus", handleWindowFocus);
    focusBound = true;
  }
  if (!refreshTimer) {
    refreshTimer = window.setInterval(refreshAdminSidebarCounts, REFRESH_INTERVAL_MS);
  }
  refreshAdminSidebarCounts();
}

export function stopAdminSidebarCounts() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (focusBound) {
    window.removeEventListener("focus", handleWindowFocus);
    focusBound = false;
  }
  refreshInFlight = null;
  sidebarCounts = {};
  updateSidebarBadges();
}

export async function refreshAdminSidebarCounts() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = sidebarCountsService.getCounts({ showLoading: false, showErrorToast: false })
    .then((response) => {
      sidebarCounts = normalizeCounts(response.data || {});
      updateSidebarBadges();
      return sidebarCounts;
    })
    .catch(() => {
      sidebarCounts = {};
      updateSidebarBadges();
      return sidebarCounts;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function handleWindowFocus() {
  refreshAdminSidebarCounts();
}

function createMenuItem(item, activePage) {
  const activeClass = item.page === activePage ? " is-active" : "";
  const badge = item.badgeKey ? createBadge(item.badgeKey) : "";

  return `
    <a class="nav-item${activeClass}" href="#${item.page}" data-page="${item.page}" title="${item.label}">
      <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
      <span class="nav-label">${item.label}</span>
      ${badge}
    </a>
  `;
}

function createBadge(badgeKey) {
  const config = BADGE_CONFIG[badgeKey];
  if (!config) return "";
  const count = Number(sidebarCounts[config.key] || 0);
  if (count <= 0) return `<span class="nav-badge" data-sidebar-badge="${badgeKey}" hidden></span>`;
  return renderBadgeElement(badgeKey, count);
}

function updateSidebarBadges() {
  document.querySelectorAll("[data-sidebar-badge]").forEach((badge) => {
    const badgeKey = badge.dataset.sidebarBadge;
    const config = BADGE_CONFIG[badgeKey];
    const count = Number(sidebarCounts[config?.key] || 0);
    if (!config || count <= 0) {
      badge.hidden = true;
      badge.textContent = "";
      badge.removeAttribute("title");
      badge.removeAttribute("aria-label");
      return;
    }
    badge.hidden = false;
    badge.textContent = formatBadgeCount(count);
    badge.title = config.title(count);
    badge.setAttribute("aria-label", config.aria(count));
  });
}

function renderBadgeElement(badgeKey, count) {
  const config = BADGE_CONFIG[badgeKey];
  const title = config.title(count);
  const aria = config.aria(count);
  return `<span class="nav-badge" data-sidebar-badge="${badgeKey}" title="${title}" aria-label="${aria}">${formatBadgeCount(count)}</span>`;
}

function normalizeCounts(value) {
  return Object.fromEntries(Object.keys(value).map((key) => [key, Math.max(Number(value[key] || 0), 0)]));
}

function formatBadgeCount(count) {
  return count > 99 ? "99+" : String(count);
}
