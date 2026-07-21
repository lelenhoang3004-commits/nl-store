import { createCustomerNavigation, initCustomerNavigation } from "../navigation/navigation.js";
import { customerApi, customerAuth } from "../../assets/js/customer-auth.js?v=20260717-cloudflare-pages";

let activeHeaderRoot = null;
let globalHeaderListenersBound = false;

export function createCustomerHeader(user = null, cart = null, wishlistCount = 0) {
  const initials = createInitials(user?.name || user?.fullName || user?.email || "AN");
  const avatarUrl = user?.avatarUrl || user?.avatar_url || user?.picture || "";
  const cartItems = Array.isArray(cart?.items) ? cart.items : [];
  const cartQuantity = Number(cart?.totalQuantity || 0);
  const wishlistTotal = Number(wishlistCount || 0);
  const accountLinks = user
    ? `
      <strong>${escapeHtml(user.name || user.fullName || "Tài khoản")}</strong>
      <a href="#profile">Hồ sơ</a>
      <a href="#orders">Đơn hàng</a>
      <a href="#logout" data-customer-logout>Đăng xuất</a>
    `
    : `
      <strong>Tài khoản</strong>
      <a href="#login">Đăng nhập</a>
      <a href="#register">Đăng ký</a>
      <a href="#profile">Hồ sơ</a>
      <a href="#orders">Đơn hàng</a>
    `;

  return `
    <div class="customer-header-inner customer-container">
      <a class="store-logo" href="#home" aria-label="Trang chủ N&amp;L Store">
        <span class="store-logo-mark"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i></span>
        <span>
          <strong>N&amp;L Store</strong>
          <small>Thời trang hiện đại</small>
        </span>
      </a>

      <button class="mobile-menu-button" type="button" aria-label="Mở menu" data-customer-menu-toggle>
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
      </button>

      ${createCustomerNavigation()}

      <div class="header-actions">
        <button class="header-icon-button search-trigger" type="button" aria-label="Mở tìm kiếm" data-search-toggle>
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        </button>
        <a class="header-icon-button" href="#wishlist" aria-label="Yêu thích">
          <i class="fa-regular fa-heart" aria-hidden="true"></i>
          ${wishlistTotal ? `<span class="header-badge header-badge--wishlist">${wishlistTotal}</span>` : ``}
        </a>
        <button class="header-icon-button" type="button" aria-label="Thông báo" data-popover-toggle="notification">
          <i class="fa-regular fa-bell" aria-hidden="true"></i>
          <span class="header-badge">3</span>
        </button>
        <a class="header-icon-button" href="#cart" aria-label="Xem giỏ hàng" data-cart-link>
          <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
          <span class="header-badge" data-cart-badge>${cartQuantity}</span>
        </a>
        ${user ? `
          <button class="user-menu-button" type="button" aria-label="Tài khoản" data-popover-toggle="user">
            ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer">` : `<span>${initials}</span>`}
          </button>
        ` : `
          <a class="header-login-button" href="#login" aria-label="Đăng nhập">
            <i class="fa-regular fa-user" aria-hidden="true"></i>
            <span>Đăng nhập</span>
          </a>
        `}
      </div>
    </div>

    <div class="customer-search-panel" data-search-panel>
      <div class="customer-container">
        <label>
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" placeholder="Tìm áo khoác, đầm midi, quần jeans..." aria-label="Tìm sản phẩm">
        </label>
        <button type="button" aria-label="Đóng tìm kiếm" data-search-close>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div class="header-popover notification-popover" data-popover="notification" data-customer-notification-popover>
      <strong>Thông báo</strong>
      <p data-customer-notification-empty>${user ? "Đang tải thông báo..." : "Vui lòng đăng nhập để xem thông báo."}</p>
    </div>
    <div class="header-popover cart-popover" data-popover="cart">
      <strong>Giỏ hàng</strong>
      ${cartItems.length
        ? cartItems.slice(0, 3).map((item) => `<p>${escapeHtml(item.productName)} x ${Number(item.quantity || 0)}</p>`).join("")
        : `<p>Giỏ hàng của bạn đang trống.</p>`}
      <a href="#cart">Xem giỏ hàng</a>
    </div>

    <div class="header-popover user-popover" data-popover="user">
      ${accountLinks}
    </div>
  `;
}

export function initCustomerHeader(root = document, options = {}) {
  const nav = root.querySelector("[data-customer-nav]");
  const menuToggle = root.querySelector("[data-customer-menu-toggle]");
  const searchPanel = root.querySelector("[data-search-panel]");

  activeHeaderRoot = root;

  initCustomerNavigation(root);

  menuToggle?.addEventListener("click", () => {
    nav?.classList.toggle("is-open");
  });

  root.querySelector("[data-search-toggle]")?.addEventListener("click", () => {
    searchPanel?.classList.add("is-open");
    searchPanel?.querySelector("input")?.focus();
  });

  root.querySelector("[data-search-close]")?.addEventListener("click", () => {
    searchPanel?.classList.remove("is-open");
  });

  root.querySelectorAll("[data-popover-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      togglePopover(root, button.dataset.popoverToggle);
    });
  });

  root.querySelector("[data-cart-link]")?.addEventListener("click", (event) => {
    event.preventDefault();
    closeHeaderOverlays(root);
    window.location.hash = "#cart";
  });

  root.querySelector("[data-customer-logout]")?.addEventListener("click", (event) => {
    event.preventDefault();
    options.onLogout?.();
  });

  bindGlobalHeaderListeners();
  initCustomerNotifications(root, Boolean(user));
}

function createInitials(value) {
  return String(value || "AN")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "AN";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function togglePopover(root, name) {
  const target = root.querySelector(`[data-popover="${name}"]`);
  const isOpen = target?.classList.contains("is-open");

  root.querySelectorAll("[data-popover]").forEach((popover) => {
    popover.classList.remove("is-open");
  });

  if (target && !isOpen) {
    target.classList.add("is-open");
  }
}

function closeHeaderOverlays(root) {
  root.querySelector("[data-customer-nav]")?.classList.remove("is-open");
  root.querySelector("[data-search-panel]")?.classList.remove("is-open");
  root.querySelectorAll("[data-popover]").forEach((popover) => {
    popover.classList.remove("is-open");
  });
}

function bindGlobalHeaderListeners() {
  if (globalHeaderListenersBound) {
    return;
  }

  document.addEventListener("click", (event) => {
    if (activeHeaderRoot && !activeHeaderRoot.contains(event.target)) {
      closeHeaderOverlays(activeHeaderRoot);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeHeaderRoot) {
      closeHeaderOverlays(activeHeaderRoot);
    }
  });

  globalHeaderListenersBound = true;
}

const customerNotificationState = {
  interval: null,
  loading: false,
  items: [],
  unreadCount: 0
};

function initCustomerNotifications(root, isAuthenticated) {
  const badge = root.querySelector("[data-customer-notification-badge]");
  const popover = root.querySelector("[data-customer-notification-popover]");
  if (!badge || !popover) return;

  if (!isAuthenticated) {
    stopCustomerNotificationPolling();
    customerNotificationState.items = [];
    customerNotificationState.unreadCount = 0;
    updateCustomerNotificationUI(root, { guest: true });
    return;
  }

  fetchCustomerNotifications(root);
  if (!customerNotificationState.interval) {
    customerNotificationState.interval = window.setInterval(() => {
      const activeRoot = activeHeaderRoot || root;
      if (customerAuth.isAuthenticated()) fetchCustomerNotifications(activeRoot, { silent: true });
      else stopCustomerNotificationPolling();
    }, 45000);
  }
}

function stopCustomerNotificationPolling() {
  if (customerNotificationState.interval) {
    window.clearInterval(customerNotificationState.interval);
    customerNotificationState.interval = null;
  }
}

async function fetchCustomerNotifications(root, options = {}) {
  if (customerNotificationState.loading) return;
  customerNotificationState.loading = true;
  try {
    const response = await customerApi("/notifications", { auth: true, refreshOnUnauthorized: false });
    const data = response?.data || {};
    customerNotificationState.items = Array.isArray(data.notifications) ? data.notifications.map(normalizeCustomerNotification) : [];
    customerNotificationState.unreadCount = Number(data.unreadCount || 0);
    updateCustomerNotificationUI(root);
  } catch (error) {
    if (error?.status === 401) {
      customerAuth.clearExternalLogin?.("notifications-unauthorized");
      stopCustomerNotificationPolling();
      updateCustomerNotificationUI(root, { guest: true });
    } else if (!options.silent) {
      updateCustomerNotificationUI(root, { error: "Không thể tải thông báo." });
    }
  } finally {
    customerNotificationState.loading = false;
  }
}

function updateCustomerNotificationUI(root, options = {}) {
  const badge = root.querySelector("[data-customer-notification-badge]");
  const popover = root.querySelector("[data-customer-notification-popover]");
  if (!badge || !popover) return;

  const unreadCount = options.guest ? 0 : customerNotificationState.unreadCount;
  badge.textContent = unreadCount;
  badge.classList.toggle("is-empty", unreadCount === 0);

  if (options.guest) {
    popover.innerHTML = `<strong>Thông báo</strong><p>Vui lòng đăng nhập để xem thông báo.</p><a href="#login">Đăng nhập</a>`;
    return;
  }

  if (options.error) {
    popover.innerHTML = `<strong>Thông báo</strong><p>${escapeHtml(options.error)}</p>`;
    return;
  }

  const items = customerNotificationState.items.slice(0, 5);
  popover.innerHTML = `
    <strong>Thông báo</strong>
    ${items.length ? items.map(createCustomerNotificationItem).join("") : "<p>Chưa có thông báo mới.</p>"}
    ${items.length ? '<button type="button" data-customer-notification-read-all>Đánh dấu đã đọc</button>' : ""}
  `;
}

function createCustomerNotificationItem(item) {
  return `<a href="${escapeHtml(item.link || "#orders")}" data-customer-notification-id="${escapeHtml(item.id)}" class="${item.read ? "is-read" : "is-unread"}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span></a>`;
}

async function handleCustomerNotificationClick(event, root) {
  const readAllButton = event.target.closest("[data-customer-notification-read-all]");
  const item = event.target.closest("[data-customer-notification-id]");

  if (readAllButton) {
    event.preventDefault();
    await customerApi("/notifications/read-all", { method: "PATCH" });
    customerNotificationState.items = customerNotificationState.items.map((notification) => ({ ...notification, read: true, isRead: true }));
    customerNotificationState.unreadCount = 0;
    updateCustomerNotificationUI(root);
    return;
  }

  if (!item) return;
  event.preventDefault();
  const id = item.dataset.customerNotificationId;
  const link = item.getAttribute("href") || "#orders";
  try {
    await customerApi(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
  } catch {}
  customerNotificationState.items = customerNotificationState.items.map((notification) => String(notification.id) === String(id) ? { ...notification, read: true, isRead: true } : notification);
  customerNotificationState.unreadCount = customerNotificationState.items.filter((notification) => !notification.read).length;
  updateCustomerNotificationUI(root);
  window.location.hash = link.replace(/^#?/, "#");
}

function normalizeCustomerNotification(item = {}) {
  return { ...item, id: item.id, read: Boolean(item.read ?? item.isRead), link: item.link || "#orders" };
}
