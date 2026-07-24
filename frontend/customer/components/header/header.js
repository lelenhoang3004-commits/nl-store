import { createCustomerNavigation, initCustomerNavigation } from "../navigation/navigation.js";
import { customerApi, customerAuth } from "../../assets/js/customer-auth.js?v=20260717-cloudflare-pages";

let activeHeaderRoot = null;
let globalHeaderListenersBound = false;
const SEARCH_SUGGESTIONS = ["Áo khoác", "Áo len", "Chân váy", "Túi xách", "Đồng hồ", "Kính mắt"];
const SEARCH_DEBOUNCE_MS = 300;

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
          <span class="header-badge is-empty" data-customer-notification-badge>0</span>
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
      <div class="customer-container customer-search-shell">
        <form class="customer-search-box" role="search" data-customer-search-form>
          <button class="customer-search-submit" type="submit" aria-label="Tìm kiếm"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>
          <input type="search" placeholder="Tìm áo khoác, đầm midi, quần jeans..." aria-label="Tìm sản phẩm" autocomplete="off" data-customer-search-input>
          <button class="customer-search-clear" type="button" aria-label="Xóa nội dung tìm kiếm" data-search-clear hidden>
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
          <div class="customer-search-suggestions" data-search-suggestions>
            <strong>Tìm kiếm phổ biến:</strong>
            <div>
              ${SEARCH_SUGGESTIONS.map((item) => `<button type="button" data-search-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
            </div>
          </div>
        </form>
        <button class="customer-search-close" type="button" aria-label="Đóng tìm kiếm" data-search-close>
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

  bindHeaderSearch(root, searchPanel);

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

  popoverRootSafeBind(root);
  bindGlobalHeaderListeners();
  initializeUnreadCounter(root);
}

function bindHeaderSearch(root, searchPanel) {
  const input = root.querySelector("[data-customer-search-input]");
  const form = root.querySelector("[data-customer-search-form]");
  const clearButton = root.querySelector("[data-search-clear]");
  const suggestions = root.querySelector("[data-search-suggestions]");
  let debounceTimer = 0;
  let lastSubmittedHash = "";
  let returnHash = normalizeRouteFromHash(window.location.hash) === "products" ? "#products" : window.location.hash || "#products";

  const syncSearchUi = () => {
    const hasValue = Boolean(input?.value.trim());
    if (clearButton) clearButton.hidden = !hasValue;
    suggestions?.classList.toggle("is-visible", Boolean(searchPanel?.classList.contains("is-open") && !hasValue));
  };

  const openSearch = () => {
    closeHeaderPopovers(root);
    const currentHash = window.location.hash || "#products";
    if (!isProductSearchHash(currentHash)) returnHash = currentHash;
    searchPanel?.classList.add("is-open");
    window.requestAnimationFrame(() => input?.focus());
    syncSearchUi();
  };

  const closeSearch = (options = {}) => {
    searchPanel?.classList.remove("is-open");
    suggestions?.classList.remove("is-visible");
    if (options.restore && isProductSearchHash(window.location.hash)) {
      window.location.hash = returnHash && !isProductSearchHash(returnHash) ? returnHash : "#products";
    }
  };

  const runSearch = (rawValue = input?.value || "", options = {}) => {
    const keyword = normalizeSearchKeyword(rawValue);
    if (input && input.value !== rawValue) input.value = rawValue;
    syncSearchUi();

    if (!keyword) {
      if (normalizeRouteFromHash(window.location.hash) === "products" && window.location.hash !== "#products") {
        lastSubmittedHash = "#products";
        window.location.hash = "#products";
      }
      return;
    }

    const nextHash = `#products?search=${encodeURIComponent(keyword)}`;
    if (window.location.hash !== nextHash && lastSubmittedHash !== nextHash) {
      lastSubmittedHash = nextHash;
      window.location.hash = nextHash;
    }
    if (options.close) closeSearch();
  };

  root.querySelector("[data-search-toggle]")?.addEventListener("click", openSearch);
  root.querySelector("[data-search-close]")?.addEventListener("click", () => closeSearch({ restore: true }));

  input?.addEventListener("input", () => {
    syncSearchUi();
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => runSearch(input.value), SEARCH_DEBOUNCE_MS);
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(debounceTimer);
    runSearch(input?.value || "", { close: true });
  });

  clearButton?.addEventListener("click", () => {
    if (input) input.value = "";
    window.clearTimeout(debounceTimer);
    syncSearchUi();
    input?.focus();
    if (normalizeRouteFromHash(window.location.hash) === "products" && window.location.hash !== "#products") {
      lastSubmittedHash = "#products";
      window.location.hash = "#products";
    }
  });

  root.querySelectorAll("[data-search-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      const keyword = button.textContent?.trim() || button.dataset.searchSuggestion || "";
      if (input) input.value = keyword;
      runSearch(keyword, { close: true });
    });
  });

  syncSearchUi();
}

function normalizeSearchKeyword(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeRouteFromHash(hash = "") {
  return String(hash || "#home").replace(/^#\/?/, "").split("?")[0].toLowerCase() || "home";
}

function isProductSearchHash(hash = "") {
  const value = String(hash || "");
  return normalizeRouteFromHash(value) === "products" && new URLSearchParams(value.split("?")[1] || "").has("search");
}

function closeHeaderPopovers(root) {
  root.querySelectorAll("[data-popover]").forEach((popover) => {
    popover.classList.remove("is-open");
  });
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

function getCurrentCustomerUser() {
  try {
    return customerAuth.getUser?.() || null;
  } catch (error) {
    console.debug("[header] Unable to read customer user", error?.message || error);
    return null;
  }
}

function isCustomerLoggedIn() {
  try {
    return Boolean(customerAuth.isAuthenticated?.() && getCurrentCustomerUser());
  } catch (error) {
    console.debug("[header] Unable to read auth state", error?.message || error);
    return false;
  }
}

function popoverRootSafeBind(root) {
  const popover = root?.querySelector?.("[data-customer-notification-popover]");
  if (!popover || popover.dataset.notificationClickBound === "true") return;
  popover.dataset.notificationClickBound = "true";
  popover.addEventListener("click", (event) => {
    handleCustomerNotificationClick(event, root).catch((error) => {
      console.debug("[header] Notification action failed", error?.message || error);
      updateCustomerNotificationUI(root, { error: "Không thể cập nhật thông báo." });
    });
  });
}

function initializeUnreadCounter(root = activeHeaderRoot || document) {
  try {
    initCustomerNotifications(root, isCustomerLoggedIn());
  } catch (error) {
    console.debug("[header] Notification counter skipped", error?.message || error);
    customerNotificationState.items = [];
    customerNotificationState.unreadCount = 0;
    stopCustomerNotificationPolling();
    updateCustomerNotificationUI(root, { guest: true });
  }
}
const customerNotificationState = {
  interval: null,
  loading: false,
  items: [],
  unreadCount: 0
};
const CUSTOMER_NOTIFICATION_TYPES = new Set(["PROMOTION", "NEW_PRODUCT", "NEW_VOUCHER", "NEW_ARRIVAL", "WISHLIST_PRICE_DROP", "WISHLIST_NEW_VARIANT", "EVENT", "COLLECTION"]);

function initCustomerNotifications(root, isAuthenticated) {
  const badge = root?.querySelector?.("[data-customer-notification-badge]");
  const popover = root?.querySelector?.("[data-customer-notification-popover]");
  if (!badge || !popover) return;

  if (!isAuthenticated || !getCurrentCustomerUser()) {
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
  if (!isCustomerLoggedIn()) {
    stopCustomerNotificationPolling();
    customerNotificationState.items = [];
    customerNotificationState.unreadCount = 0;
    updateCustomerNotificationUI(root, { guest: true });
    return;
  }
  if (customerNotificationState.loading) return;
  customerNotificationState.loading = true;
  try {
    const response = await customerApi("/notifications", { auth: true, refreshOnUnauthorized: false });
    const data = response?.data || {};
    customerNotificationState.items = Array.isArray(data.notifications)
      ? data.notifications.map(normalizeCustomerNotification).filter((item) => CUSTOMER_NOTIFICATION_TYPES.has(String(item.type || "").toUpperCase()))
      : [];
    customerNotificationState.unreadCount = Number(data.unreadCount || 0);
    updateCustomerNotificationUI(root);
  } catch (error) {
    if (error?.status === 401) {
      customerAuth.clearExternalLogin?.("notifications-unauthorized");
      stopCustomerNotificationPolling();
      customerNotificationState.items = [];
      customerNotificationState.unreadCount = 0;
      updateCustomerNotificationUI(root, { guest: true });
    } else if (!options.silent) {
      updateCustomerNotificationUI(root, { error: "Không thể tải thông báo." });
    }
  } finally {
    customerNotificationState.loading = false;
  }
}

function updateCustomerNotificationUI(root, options = {}) {
  const badge = root?.querySelector?.("[data-customer-notification-badge]");
  const popover = root?.querySelector?.("[data-customer-notification-popover]");
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
    if (!isCustomerLoggedIn()) {
      updateCustomerNotificationUI(root, { guest: true });
      return;
    }
    await customerApi("/notifications/read-all", { method: "PATCH", auth: true, refreshOnUnauthorized: false });
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
    if (isCustomerLoggedIn()) {
      await customerApi(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", auth: true, refreshOnUnauthorized: false });
    }
  } catch {}
  customerNotificationState.items = customerNotificationState.items.map((notification) => String(notification.id) === String(id) ? { ...notification, read: true, isRead: true } : notification);
  customerNotificationState.unreadCount = customerNotificationState.items.filter((notification) => !notification.read).length;
  updateCustomerNotificationUI(root);
  window.location.hash = link.replace(/^#?/, "#");
}

function normalizeCustomerNotification(item = {}) {
  return { ...item, id: item.id, type: String(item.type || "").toUpperCase(), read: Boolean(item.read ?? item.isRead), link: item.link || "#home" };
}
