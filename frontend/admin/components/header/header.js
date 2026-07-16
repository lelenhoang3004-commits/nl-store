import { createNotificationCenterTemplate } from "../notification-center/notification-center.js";
import { getCurrentUser } from "../../permissions/user-session.js";

export function createHeader(activeLabel = "Dashboard") {
  const user = getCurrentUser();
  const displayName = user.name && user.name !== "Guest" ? user.name : "Quản trị viên";
  const displayEmail = user.email || "Chưa đăng nhập";
  const initials = createInitials(displayName);
  return `
    <div class="header-left">
      <button class="icon-button menu-button" type="button" aria-label="Mở menu" data-sidebar-toggle>
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>
      <a class="header-logo" href="#dashboard" data-page="dashboard" aria-label="N&amp;L Store Admin">
        <span class="header-logo-mark">
          <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
        </span>
        <span class="header-logo-copy">
          <strong>N&amp;L Store</strong>
          <small>Admin</small>
        </span>
      </a>
    </div>

    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="#dashboard" data-page="dashboard">Admin</a>
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      <span data-breadcrumb-current>${activeLabel}</span>
    </nav>

    <label class="header-search" aria-label="Tìm kiếm">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="search" placeholder="Tìm kiếm sản phẩm, đơn hàng, khách hàng">
    </label>

    <div class="header-actions">
      <div class="header-popover">
        ${createNotificationCenterTemplate()}
      </div>

      <button class="icon-button" type="button" aria-label="Toàn màn hình" data-fullscreen-toggle>
        <i class="fa-solid fa-expand" aria-hidden="true"></i>
      </button>

      <button class="icon-button" type="button" aria-label="Chuyển dark mode" data-theme-toggle>
        <i class="fa-solid fa-moon" aria-hidden="true"></i>
      </button>

      <div class="header-popover">
        <button class="admin-profile" type="button" aria-label="Tài khoản quản trị" data-dropdown-toggle="profile">
          <span class="profile-avatar">${escapeHtml(initials)}</span>
          <span class="profile-copy">
            <strong>${escapeHtml(displayName)}</strong>
            <small>${escapeHtml(user.role)}</small>
          </span>
          <i class="fa-solid fa-chevron-down profile-chevron" aria-hidden="true"></i>
        </button>
        <div class="dropdown-panel profile-panel" data-dropdown="profile">
          <div class="profile-card">
            <span class="profile-avatar">${escapeHtml(initials)}</span>
            <div>
              <strong>${escapeHtml(displayName)}</strong>
              <small>${escapeHtml(displayEmail)}</small>
            </div>
          </div>
          <a href="#settings" data-page="settings">
            <i class="fa-solid fa-user-gear" aria-hidden="true"></i>
            Hồ sơ quản trị
          </a>
          <a href="#settings" data-page="settings">
            <i class="fa-solid fa-gear" aria-hidden="true"></i>
            Cài đặt
          </a>
          <button type="button" data-logout-trigger>
            <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  `;
}

export function updateBreadcrumb(label) {
  const current = document.querySelector("[data-breadcrumb-current]");

  if (current) {
    current.textContent = label;
  }
}

function createInitials(name) {
  return String(name || "AD").trim().split(/\s+/).slice(-2).map((part) => part[0] || "").join("").toUpperCase() || "AD";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
