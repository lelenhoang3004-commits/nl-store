import { filterMenuByPermission } from "../../permissions/access-control.js";
import { PERMISSIONS } from "../../permissions/permissions.js";
import { getCurrentUser } from "../../permissions/user-session.js";

export const adminMenuItems = [
  { page: "dashboard", icon: "fa-chart-line", label: "Dashboard", permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  { page: "products", icon: "fa-shirt", label: "Quản lý sản phẩm", badge: "12", permissions: [PERMISSIONS.PRODUCT_VIEW] },
  { page: "inventory", icon: "fa-warehouse", label: "Quản lý tồn kho", badge: "3", permissions: [PERMISSIONS.INVENTORY_VIEW] },
  { page: "categories", icon: "fa-tags", label: "Quản lý danh mục", permissions: [PERMISSIONS.CATEGORY_VIEW] },
  { page: "users", icon: "fa-users", label: "Quản lý người dùng", permissions: [PERMISSIONS.USER_VIEW] },
  { page: "orders", icon: "fa-box-open", label: "Quản lý đơn hàng", badge: "8", permissions: [PERMISSIONS.ORDER_VIEW] },
  { page: "payments", icon: "fa-credit-card", label: "Quản lý thanh toán", permissions: [PERMISSIONS.PAYMENT_VIEW] },
  { page: "vouchers", icon: "fa-ticket", label: "Quản lý mã giảm giá", permissions: [PERMISSIONS.VOUCHER_VIEW] },
  { page: "emails", icon: "fa-envelope-open-text", label: "Đăng ký Email", badge: "24", permissions: [PERMISSIONS.EMAIL_VIEW] },
  { page: "statistics", icon: "fa-chart-pie", label: "Thống kê", permissions: [PERMISSIONS.STATISTIC_VIEW] },
  { page: "settings", icon: "fa-gear", label: "Cài đặt", permissions: [PERMISSIONS.SETTING_VIEW] }
];

export function createSidebar(activePage = "dashboard") {
  const currentUser = getCurrentUser();
  const visibleMenuItems = filterMenuByPermission(adminMenuItems, currentUser);

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

    <div class="sidebar-footer-action">
      <button class="logout-button" type="button" title="Đăng xuất" data-logout-trigger>
        <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
        <span class="nav-label">Đăng xuất</span>
      </button>
    </div>
  `;
}

export function setActiveSidebarItem(page) {
  document.querySelectorAll("[data-page]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === page);
  });
}

function createMenuItem(item, activePage) {
  const activeClass = item.page === activePage ? " is-active" : "";
  const badge = item.badge ? `<span class="nav-badge">${item.badge}</span>` : "";

  return `
    <a class="nav-item${activeClass}" href="#${item.page}" data-page="${item.page}" title="${item.label}">
      <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
      <span class="nav-label">${item.label}</span>
      ${badge}
    </a>
  `;
}
