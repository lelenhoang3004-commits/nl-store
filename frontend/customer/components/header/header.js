import { createCustomerNavigation, initCustomerNavigation } from "../navigation/navigation.js";

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
        <button class="header-icon-button" type="button" aria-label="Giỏ hàng" data-popover-toggle="cart">
          <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
          <span class="header-badge" data-cart-badge>${cartQuantity}</span>
        </button>
        <button class="user-menu-button" type="button" aria-label="Tài khoản" data-popover-toggle="user">
          ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer">` : `<span>${initials}</span>`}
        </button>
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

    <div class="header-popover notification-popover" data-popover="notification">
      <strong>Thông báo</strong>
      <p>Bộ sưu tập mới đã sẵn sàng.</p>
      <p>Flash sale bắt đầu lúc 20:00.</p>
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

  root.querySelector("[data-customer-logout]")?.addEventListener("click", (event) => {
    event.preventDefault();
    options.onLogout?.();
  });

  bindGlobalHeaderListeners();
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
