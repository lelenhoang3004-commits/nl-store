import { filterMenuByPermission } from "../../permissions/access-control.js";
import { PERMISSIONS } from "../../permissions/permissions.js";
import { getCurrentUser, isAuthenticated } from "../../permissions/user-session.js";
import { sidebarCountsService } from "../../services/sidebar-counts.service.js";

const REFRESH_INTERVAL_MS = 60000;

const BADGE_CONFIG = Object.freeze({
  products: {
    key: "products_attention",
    title: (count) => `${count} s\u1ea3n ph\u1ea9m c\u1ea7n ki\u1ec3m tra t\u1ed3n kho`,
    aria: (count) => `${count} s\u1ea3n ph\u1ea9m c\u1ea7n ki\u1ec3m tra t\u1ed3n kho`
  },
  orders: {
    key: "pending_orders",
    title: (count) => `${count} \u0111\u01a1n h\u00e0ng \u0111ang ch\u1edd x\u00e1c nh\u1eadn`,
    aria: (count) => `${count} \u0111\u01a1n h\u00e0ng \u0111ang ch\u1edd x\u00e1c nh\u1eadn`
  },
  payments: {
    key: "pending_payments",
    title: (count) => `${count} giao d\u1ecbch \u0111ang ch\u1edd x\u00e1c nh\u1eadn`,
    aria: (count) => `${count} giao d\u1ecbch \u0111ang ch\u1edd x\u00e1c nh\u1eadn`
  },
  emails: {
    key: "unread_newsletter",
    title: (count) => `${count} \u0111\u0103ng k\u00fd email m\u1edbi`,
    aria: (count) => `${count} \u0111\u0103ng k\u00fd email m\u1edbi`
  }
});

export const adminMenuItems = [
  { page: "dashboard", icon: "fa-chart-line", label: "Dashboard", permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  { page: "products", icon: "fa-shirt", label: "Qu\u1ea3n l\u00fd s\u1ea3n ph\u1ea9m", badgeKey: "products", permissions: [PERMISSIONS.PRODUCT_VIEW] },
  { page: "categories", icon: "fa-tags", label: "Qu\u1ea3n l\u00fd danh m\u1ee5c", permissions: [PERMISSIONS.CATEGORY_VIEW] },
  { page: "users", icon: "fa-users", label: "Qu\u1ea3n l\u00fd ng\u01b0\u1eddi d\u00f9ng", permissions: [PERMISSIONS.USER_VIEW] },
  { page: "orders", icon: "fa-box-open", label: "Qu\u1ea3n l\u00fd \u0111\u01a1n h\u00e0ng", badgeKey: "orders", permissions: [PERMISSIONS.ORDER_VIEW] },
  { page: "payments", icon: "fa-credit-card", label: "Qu\u1ea3n l\u00fd thanh to\u00e1n", badgeKey: "payments", permissions: [PERMISSIONS.PAYMENT_VIEW] },
  { page: "vouchers", icon: "fa-ticket", label: "Qu\u1ea3n l\u00fd m\u00e3 gi\u1ea3m gi\u00e1", permissions: [PERMISSIONS.VOUCHER_VIEW] },
  { page: "emails", icon: "fa-envelope-open-text", label: "\u0110\u0103ng k\u00fd Email", badgeKey: "emails", permissions: [PERMISSIONS.EMAIL_VIEW] },
  { page: "settings", icon: "fa-gear", label: "C\u00e0i \u0111\u1eb7t", permissions: [PERMISSIONS.SETTING_VIEW] }
];

let sidebarCounts = {};
let refreshTimer = null;
let refreshInFlight = null;
let focusBound = false;

export function createSidebar(activePage = "dashboard") {
  if (!isAuthenticated()) return createGuestSidebar();

  const currentUser = getCurrentUser();
  const visibleMenuItems = filterMenuByPermission(adminMenuItems, currentUser);
  startAdminSidebarCounts();

  return `
    <div class="sidebar-brand">
      <div class="brand-mark" aria-hidden="true">
        <img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="">
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

function createGuestSidebar() {
  stopAdminSidebarCounts();

  return `
    <div class="sidebar-brand sidebar-brand-guest">
      <div class="brand-mark" aria-hidden="true">
        <img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="">
      </div>
      <div class="brand-copy">
        <strong>N&amp;L Store</strong>
        <span>Administration</span>
      </div>
      <button class="sidebar-collapse-button" type="button" aria-label="Thu g&#7885;n sidebar" data-sidebar-collapse>
        <i class="fa-solid fa-angles-left" aria-hidden="true"></i>
      </button>
    </div>

    <div class="sidebar-guest-note">
      <span>Secure Management Portal</span>
      <small>Đăng nhập để truy cập hệ thống quản trị.</small>
    </div>
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
  const count = normalizeCount(sidebarCounts[config.key]);
  if (count <= 0) return `<span class="nav-badge" data-sidebar-badge="${badgeKey}" hidden aria-hidden="true"></span>`;
  return renderBadgeElement(badgeKey, count);
}

function updateSidebarBadges() {
  document.querySelectorAll("[data-sidebar-badge]").forEach((badge) => {
    const badgeKey = badge.dataset.sidebarBadge;
    const config = BADGE_CONFIG[badgeKey];
    const count = normalizeCount(sidebarCounts[config?.key]);
    updateSidebarBadge(badge, count, config);
  });
}

function renderBadgeElement(badgeKey, count) {
  const config = BADGE_CONFIG[badgeKey];
  const normalizedCount = normalizeCount(count);
  const title = config.title(normalizedCount);
  const aria = config.aria(normalizedCount);
  return `<span class="nav-badge" data-sidebar-badge="${badgeKey}" title="${title}" aria-label="${aria}">${formatBadgeCount(normalizedCount)}</span>`;
}

function updateSidebarBadge(element, count, config) {
  if (!element || !config || !Number.isFinite(count) || count <= 0) {
    if (element) {
      element.hidden = true;
      element.setAttribute("hidden", "");
      element.setAttribute("aria-hidden", "true");
      element.textContent = "";
      element.removeAttribute("title");
      element.removeAttribute("aria-label");
    }
    return;
  }

  const normalizedCount = Math.floor(count);
  element.hidden = false;
  element.removeAttribute("hidden");
  element.removeAttribute("aria-hidden");
  element.textContent = formatBadgeCount(normalizedCount);
  element.title = config.title(normalizedCount);
  element.setAttribute("aria-label", config.aria(normalizedCount));
}

function normalizeCounts(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.keys(value).map((key) => [key, normalizeCount(value[key])]));
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function formatBadgeCount(count) {
  return count > 99 ? "99+" : String(count);
}
