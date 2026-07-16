import { confirmPresets } from "../../admin/components/confirm/confirm.js";
import { createFooter } from "../../admin/components/footer/footer.js";
import { createHeader, updateBreadcrumb } from "../../admin/components/header/header.js";
import { initNotificationCenter } from "../../admin/components/notification-center/notification-center.js";
import { createSidebar, setActiveSidebarItem } from "../../admin/components/sidebar/sidebar.js";
import { closeThemeManager, initThemeManager, isThemeManagerElement, toggleThemeManager } from "../../admin/components/theme/theme-manager.js";
import { toast } from "../../admin/components/toast/toast.js";
import { globalErrorManager } from "../../admin/errors/index.js";
import { logoutAdminAccount, startSessionManager } from "../../admin/auth/auth-session.js";
import { createAdminRouter } from "../../admin/router/router.js";

const STORAGE_KEYS = {
  sidebarCollapsed: "fashion-admin-sidebar-collapsed"
};

let sidebar = null;
let header = null;
let main = null;
let footer = null;
let adminRouter = null;
let authRedirectInProgress = false;

const sessionManagerCallbacks = {
  onSessionExpired(reason) {
    toast.warning(reason === "idle-timeout" ? "Bạn đã không thao tác trong một thời gian." : "Phiên đăng nhập đã hết hạn.");
    window.location.hash = "session-expired";
  },
  onTokenRefreshed() {
    window.dispatchEvent(new CustomEvent("fashion-admin-token-refreshed"));
  },
  onLoggedOutInAnotherTab() {
    toast.info("Phiên đăng nhập đã được đăng xuất ở tab khác.");
    window.location.hash = "login";
  }
};

function bootstrapAdminLayout() {
  if (!resolveLayoutElements()) {
    return;
  }

  globalErrorManager.init();
  applyStoredPreferences();
  renderPersistentLayout();
  initThemeManager();
  bindLayoutEvents();
  startRouter();
}

function renderPersistentLayout() {
  sidebar.innerHTML = createSidebar("dashboard");
  updateSidebarCollapseButton(document.body.classList.contains("sidebar-collapsed"));
  header.innerHTML = createHeader("Dashboard");
  footer.innerHTML = createFooter();
  initNotificationCenter(header);
}

function startRouter() {
  adminRouter = createAdminRouter({
    outlet: main,
    onRouteChange(route) {
      setActiveSidebarItem(route.menuKey);
      updateBreadcrumb(route.breadcrumb ?? route.title);
      document.title = `${route.title} | N&L Store Admin`;
    },
    onAfterRouteChange() {
      closeSidebar();
      closeDropdowns();
    }
  });

  adminRouter.start();
}

function resolveLayoutElements() {
  sidebar = document.querySelector("#admin-sidebar");
  header = document.querySelector("#admin-header");
  main = document.querySelector("#admin-main");
  footer = document.querySelector("#admin-footer");

  return Boolean(sidebar && header && main && footer);
}

function bindLayoutEvents() {
  document.addEventListener("click", handleDocumentClick);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
      closeDropdowns();
      closeThemeManager();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
      closeSidebar();
    }
  });

  window.addEventListener("fashion-admin-auth-changed", (event) => {
    if (event.detail?.reason === "login") authRedirectInProgress = false;
    renderPersistentLayout();
    startSessionManager(sessionManagerCallbacks);
  });
  window.addEventListener("fashion-api:unauthorized", handleUnauthorizedApiResponse);
  window.addEventListener("fashion-api:forbidden", () => {
    toast.error("Bạn không có quyền truy cập.");
  });

  startSessionManager(sessionManagerCallbacks);
}

function handleUnauthorizedApiResponse() {
  if (authRedirectInProgress || window.location.hash === "#login") return;
  authRedirectInProgress = true;
  logoutAdminAccount("api-unauthorized");
  toast.warning("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.");
  window.location.hash = "#login";
}

async function handleDocumentClick(event) {
  const sidebarToggle = event.target.closest("[data-sidebar-toggle]");
  const sidebarClose = event.target.closest("[data-sidebar-close]");
  const sidebarCollapse = event.target.closest("[data-sidebar-collapse]");
  const dropdownToggle = event.target.closest("[data-dropdown-toggle]");
  const themeToggle = event.target.closest("[data-theme-toggle]");
  const fullscreenToggle = event.target.closest("[data-fullscreen-toggle]");
  const logoutTrigger = event.target.closest("[data-logout-trigger]");
  const clickedInsideDropdown = event.target.closest(".dropdown-panel");
  const clickedInsideThemeManager = isThemeManagerElement(event.target);

  if (logoutTrigger) {
    event.preventDefault();
    await handleLogout();
    closeDropdowns();
    return;
  }

  if (sidebarToggle) {
    toggleSidebar();
    return;
  }

  if (sidebarClose) {
    closeSidebar();
    return;
  }

  if (sidebarCollapse) {
    toggleSidebarCollapse();
    return;
  }

  if (dropdownToggle) {
    toggleDropdown(dropdownToggle.dataset.dropdownToggle);
    return;
  }

  if (themeToggle) {
    toggleThemeManager(themeToggle);
    return;
  }

  if (fullscreenToggle) {
    toggleFullscreen();
    return;
  }

  if (!clickedInsideDropdown) {
    closeDropdowns();
  }

  if (!clickedInsideThemeManager) {
    closeThemeManager();
  }
}

async function handleLogout() {
  const confirmed = await confirmPresets.logout();

  if (confirmed) {
    logoutAdminAccount("logout");
    toast.info("Đã đăng xuất khỏi trang quản trị.");
    window.location.hash = "login";
  }
}

function applyStoredPreferences() {
  const isCollapsed = localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "true";

  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  updateSidebarCollapseButton(isCollapsed);
}

function toggleSidebarCollapse() {
  const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(isCollapsed));
  updateSidebarCollapseButton(isCollapsed);
}

function updateSidebarCollapseButton(isCollapsed) {
  const button = document.querySelector("[data-sidebar-collapse]");
  if (!button) return;
  const label = isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("aria-expanded", String(!isCollapsed));
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function toggleDropdown(name) {
  const target = document.querySelector(`[data-dropdown="${name}"]`);
  const isOpen = target?.classList.contains("is-open");

  closeDropdowns();

  if (target && !isOpen) {
    target.classList.add("is-open");
  }
}

function closeDropdowns() {
  document.querySelectorAll("[data-dropdown].is-open").forEach((dropdown) => {
    dropdown.classList.remove("is-open");
  });
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  } catch (error) {
    window.dispatchEvent(new CustomEvent("fashion-admin-fullscreen-unavailable", {
      detail: { error }
    }));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapAdminLayout, { once: true });
} else {
  bootstrapAdminLayout();
}
