import { createNotificationCenterTemplate } from "../notification-center/notification-center.js";
import { getCurrentUser, isAuthenticated } from "../../permissions/user-session.js";

export function createHeader(activeLabel = "Dashboard") {
  if (!isAuthenticated()) return createGuestHeader(activeLabel);

  const user = getCurrentUser();
  const displayName = user.name && user.name !== "Guest" ? user.name : "Quáº£n trá»‹ viÃªn";
  const displayEmail = user.email || "ChÆ°a Ä‘Äƒng nháº­p";
  const initials = createInitials(displayName);
  return `
    <div class="header-left">
      <button class="icon-button menu-button" type="button" aria-label="Má»Ÿ menu" data-sidebar-toggle>
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>
      <a class="header-logo" href="#dashboard" data-page="dashboard" aria-label="N&amp;L Store Admin">
        <span class="header-logo-mark">
          <img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="">
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

    <label class="header-search" aria-label="TÃ¬m kiáº¿m">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="search" placeholder="TÃ¬m kiáº¿m sáº£n pháº©m, Ä‘Æ¡n hÃ ng, khÃ¡ch hÃ ng">
    </label>

    <div class="header-actions">
      <div class="header-popover">
        ${createNotificationCenterTemplate()}
      </div>

      <button class="icon-button" type="button" aria-label="ToÃ n mÃ n hÃ¬nh" data-fullscreen-toggle>
        <i class="fa-solid fa-expand" aria-hidden="true"></i>
      </button>

      <button class="icon-button" type="button" aria-label="Chuyá»ƒn dark mode" data-theme-toggle>
        <i class="fa-solid fa-moon" aria-hidden="true"></i>
      </button>

      <div class="header-popover">
        <button class="admin-profile" type="button" aria-label="TÃ i khoáº£n quáº£n trá»‹" data-dropdown-toggle="profile">
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
            Há»“ sÆ¡ quáº£n trá»‹
          </a>
          <a href="#settings" data-page="settings">
            <i class="fa-solid fa-gear" aria-hidden="true"></i>
            CÃ i Ä‘áº·t
          </a>
          <button type="button" data-logout-trigger>
            <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
            ÄÄƒng xuáº¥t
          </button>
        </div>
      </div>
    </div>
  `;
}

function createGuestHeader(activeLabel = "Login") {
  return `
    <div class="header-left">
      <button class="icon-button menu-button" type="button" aria-label="M&#7903; menu" data-sidebar-toggle>
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>
      <a class="header-logo" href="#login" data-page="login" aria-label="N&amp;L Store Admin">
        <span class="header-logo-mark">
          <img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="">
        </span>
        <span class="header-logo-copy">
          <strong>N&amp;L Store</strong>
          <small>Admin</small>
        </span>
      </a>
    </div>

    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="#login" data-page="login">Admin</a>
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      <span data-breadcrumb-current>${escapeHtml(activeLabel)}</span>
    </nav>

    <div class="header-actions admin-guest-actions">
      <button class="icon-button" type="button" aria-label="Chuy&#7875;n dark mode" data-theme-toggle>
        <i class="fa-solid fa-moon" aria-hidden="true"></i>
      </button>
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
