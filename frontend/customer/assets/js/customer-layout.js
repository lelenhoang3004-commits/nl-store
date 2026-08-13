import { createCustomerFooter } from "../../components/footer/footer.js?v=20260729-contact-update";
import { createCustomerHeader, initCustomerHeader } from "../../components/header/header.js";
import { initCustomerChatbot } from "../../components/chatbot/chatbot.js";
import { createProductDetailPage, initProductDetailPage } from "../../components/product-detail/product-detail.js";
import { createProductCard, initProductCard } from "../../components/product-card/product-card.js";
import { createProductGrid, initProductGrid } from "../../components/product-grid/product-grid.js";
import { createHomePage, initHomePage } from "../../home/home.js?v=20260730-hero-refresh";
import { customerApi, customerAuth, showCustomerMessage } from "./customer-auth.js?v=20260717-cloudflare-pages";
import { createEmptyCart, customerCart, getCartErrorMessage } from "./customer-cart.js";
import { notifyError, notifySuccess, notifyWarning } from "../../../assets/js/notify.js";
import { VIETNAM_ADMINISTRATIVE_2025, getWardsByProvince } from "../../../assets/data/vietnam-administrative-2025.js";
import { SUPPORTED_CHECKOUT_PAYMENT_METHODS, formatOrderStatus, formatPaymentMethod, formatPaymentStatus } from "../../../admin/utils/payment-formatters.js";

// Minimal, robust layout manager for customer site
// Prevent Live Server / dev-server injected websocket reloads from forcing a full page reload.
// This wrapper only suppresses obvious reload/refresh messages for WS endpoints that look
// like the local dev server (port 5500 or paths containing `/ws` or `livereload`).
(function preventDevServerReloads() {
  try {
    const OriginalWebSocket = window.WebSocket;
    if (!OriginalWebSocket) return;

    window.WebSocket = function (url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      try {
        const u = String(url || '').toLowerCase();
        const shouldIntercept = u.includes(':5500') || u.includes('/ws') || u.includes('livereload');
        if (!shouldIntercept) return ws;

        const origAdd = ws.addEventListener.bind(ws);
        const wrap = (handler) => {
          return function (evt) {
            try {
              const data = evt && evt.data;
              if (typeof data === 'string') {
                const ld = data.toLowerCase();
                if (ld.includes('reload') || ld.includes('refresh') || ld.includes('update')) {
                  console.debug('[dev-server] suppressed reload message', data);
                  return;
                }
              }
              if (typeof data === 'object' && data && (data.command === 'reload' || data.action === 'reload')) {
                console.debug('[dev-server] suppressed object reload', data);
                return;
              }
            } catch (err) {}
            try { handler(evt); } catch (err) {}
          };
        };

        ws.addEventListener = function (type, listener, opts) {
          if (type === 'message' && typeof listener === 'function') {
            return origAdd(type, wrap(listener), opts);
          }
          return origAdd(type, listener, opts);
        };

        Object.defineProperty(ws, 'onmessage', {
          get() { return this._onmessage; },
          set(fn) {
            if (typeof fn === 'function') {
              this._onmessage = wrap(fn);
              origAdd('message', this._onmessage);
            } else {
              this._onmessage = fn;
            }
          }
        });
      } catch (e) {
        // noop
      }
      return ws;
    };

    try {
      window.WebSocket.prototype = OriginalWebSocket.prototype;
      Object.keys(OriginalWebSocket).forEach(k => { try { window.WebSocket[k] = OriginalWebSocket[k]; } catch (e) {} });
    } catch (e) {}
  } catch (e) {}
})();
const layoutState = {
  header: null,
  main: null,
  footer: null,
  cart: createEmptyCart(),
  wishlistItems: [],
  wishlistProductIds: new Set(),
  wishlistTotal: 0,
  pendingRoute: "",
  pendingRouteSection: "",
  lastAuthChangedTime: 0,
  isRenderingRoute: false,
  oauthPopup: null,
  oauthPopupProvider: "",
  isCompletingOAuth: false,
  cartVoucher: {
    code: "",
    discountAmount: 0,
    status: "idle",
    message: ""
  },
  checkoutAddress: {
    provinceCode: "",
    wardCode: "",
    detailAddress: "",
    mapUpdateTimer: null
  },
  newsletterPopup: {
    shown: false,
    showTimer: null,
    hideTimer: null
  },
  paymentPolling: {
    timer: null,
    transactionId: null,
    inFlight: false
  },
  orderSuccessModal: {
    root: null,
    autoCloseTimer: null,
    keydownHandler: null,
    orderId: "",
    hasRedirected: false
  }
};

const PROFILE_BANKS = ["Vietcombank", "BIDV", "VietinBank", "Techcombank", "MB Bank", "ACB", "Sacombank", "VPBank", "TPBank", "Agribank"];
const CREDIT_CARD_PAYMENT_MODE = Object.freeze({ DEMO: "CREDIT_CARD_DEMO", HOSTED: "CREDIT_CARD_HOSTED" });

const protectedRoutes = new Set(["checkout", "orders", "profile", "cart", "wishlist"]);
const homeSectionRoutes = new Set(["flash-sale", "featured-product", "new-arrival", "best-seller", "categories", "jewelry", "brands", "brand", "reviews", "newsletter", "promotion", "collections", "collection", "story", "products"]);
const FALLBACK_PRODUCT_IMAGE = "https://placehold.co/160x200/f1f5f9/334155?text=Fashion";
const PRODUCT_MENU_FILTERS = Object.freeze({
  "ao-khoac": { label: "Áo khoác", keywords: ["áo khoác", "ao khoac", "jacket", "hoodie"] },
  "ao-len": { label: "Áo len", keywords: ["áo len", "ao len", "sweater"] },
  "ao-blazer": { label: "Áo blazer", keywords: ["blazer", "áo blazer", "ao blazer"] },
  "dam-midi": { label: "Đầm midi", keywords: ["đầm midi", "dam midi", "váy midi"] },
  "quan-toi-gian": { label: "Quần tối giản", keywords: ["quần tối giản", "quan toi gian", "quần", "quan"] },
  "chan-vay": { label: "Chân váy", keywords: ["chân váy", "chan vay", "skirt"] },
  "giay": { label: "Giày", keywords: ["giày", "giay", "shoe", "sneaker"] },
  "quan-jeans": { label: "Quần jeans", keywords: ["jeans", "quần jean", "quan jean"] },
  "tui-xach": { label: "Túi xách", keywords: ["túi xách", "tui xach", "bag"] },
  "dong-ho": { label: "Đồng hồ", keywords: ["đồng hồ", "dong ho", "watch"] },
  "trang-suc": { label: "Trang sức", keywords: ["trang sức", "trang suc", "dây chuyền", "day chuyen", "nhẫn", "bông tai"] },
  "kinh-mat": { label: "Kính mắt", keywords: ["kính mắt", "kinh mat", "mắt kính", "mat kinh", "glasses"] },
  "mu-non": { label: "Mũ nón", keywords: ["mÅ©", "nón", "mu-non"] },
  "phu-kien": { label: "Phụ kiện cá nhân", keywords: ["phụ kiện", "phu kien", "accessory"] }
});

let currentRoute = null;
let appInitialized = false;

function scrollCustomerPageToTop(smooth = true) {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

function getCustomerHeaderOffset() {
  const header = document.querySelector('.customer-header, header');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  return headerHeight + 20;
}

function scrollToCustomerSection(sectionId, smooth = true) {
  const target = document.getElementById(resolveCustomerSectionId(sectionId));

  if (!target) {
    console.warn(`[customer-layout] Section not found: ${sectionId}`);
    return false;
  }

  target.scrollIntoView({
    behavior: smooth ? 'smooth' : 'auto',
    block: 'start'
  });

  return true;
}

function resolveCustomerSectionId(sectionId = '') {
  return ({ collections: 'collection', categories: 'collection', brands: 'brand', 'flash-sale': 'promotion' })[sectionId] || sectionId;
}

function scheduleCustomerSectionScroll(sectionId, smooth = true) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollToCustomerSection(sectionId, smooth);
    });
  });
}

function normalizeOrderStatus(status = "") {
  const value = String(status || "").toLowerCase();
  const variants = {
    pending: "warning",
    confirmed: "info",
    processing: "primary",
    shipping: "accent",
    shipped: "accent",
    completed: "success",
    delivered: "success",
    cancelled: "danger",
    canceled: "danger",
    refunded: "neutral"
  };

  return { label: formatOrderStatus(value || status) || "Đang xử lý", variant: variants[value] || "neutral" };
}

function normalizePaymentStatus(status = "") {
  const value = String(status || "").toLowerCase();
  const variants = {
    pending: "warning",
    unpaid: "warning",
    partial: "info",
    processing: "primary",
    customer_reported: "primary",
    waiting_confirmation: "primary",
    paid: "success",
    success: "success",
    completed: "success",
    failed: "danger",
    cancelled: "danger",
    canceled: "danger",
    refunded: "neutral"
  };

  return { label: formatPaymentStatus(value || status) || "Chưa cập nhật", variant: variants[value] || "neutral" };
}

function normalizePaymentTransactionStatus(status = "") {
  return normalizePaymentStatus(status);
}

function getPaymentMethodLabel(method = "") {
  return formatPaymentMethod(method) || "Chưa cập nhật";
}

function createStatusBadge(label, variant) {
  return `<span class="customer-order-status-badge customer-order-status-badge--${variant}">${escapeHtml(label)}</span>`;
}

function formatDate(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatAddress(address = {}) {
  const fullAddress = address.fullAddress || address.full_address || address.full_address_text || "";
  if (fullAddress) {
    return String(fullAddress).trim();
  }

  const detail = [address.detail_address, address.line1, address.line2].filter(Boolean).map((item) => String(item).trim()).join(", ");
  const ward = address.ward_name || address.ward || "";
  const province = address.province_name || address.province || address.city || "";
  const country = address.country ? String(address.country).trim() : "Việt Nam";
  const parts = [detail, ward, province, country].filter(Boolean);

  return parts.length ? parts.join(", ") : "Chưa cập nhật";
}

function loadProvinces(selectElement) {
  if (!selectElement) return;
  selectElement.innerHTML = `<option value="">Chọn tỉnh/thành</option>${VIETNAM_ADMINISTRATIVE_2025.map((province) => `<option value="${escapeHtml(province.code)}">${escapeHtml(province.name)}</option>`).join("")}`;
}

function loadWardsByProvince(selectElement, provinceCode) {
  if (!selectElement) return;

  if (!provinceCode) {
    selectElement.disabled = true;
    selectElement.innerHTML = `<option value="">Chọn phường/xã/thị trấn</option>`;
    return;
  }

  const wards = getWardsByProvince(provinceCode);
  selectElement.disabled = false;
  selectElement.innerHTML = `<option value="">Chọn phường/xã/thị trấn</option>${wards.map((ward) => `<option value="${escapeHtml(ward.code)}">${escapeHtml(ward.name)}</option>`).join("")}`;
}

function updateMapByAddress(mapIframe, detailAddress, provinceCode, wardCode) {
  if (!mapIframe) return;

  const province = VIETNAM_ADMINISTRATIVE_2025.find((item) => item.code === provinceCode);
  const ward = province?.wards.find((item) => item.code === wardCode);
  const fullAddress = [detailAddress, ward?.name || "", province?.name || "", "Việt Nam"].filter(Boolean).join(", ").replace(/,\s*,/g, ",").trim();
  const mapQuery = fullAddress || "Việt Nam";
  mapIframe.src = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
}

function bootstrapCustomerWebsite() {
  if (window.__customerAppInitialized) return;
  window.__customerAppInitialized = true;
  if (appInitialized) return;
  appInitialized = true;

  try { document.documentElement.dataset.moduleLoaded = '1'; } catch (e) {}

  if (forwardOAuthCallbackToOpener()) {
    return;
  }

  if (!resolveLayoutElements()) {
    return;
  }

  renderLayout();
  initCustomerChatbot();
  bindGlobalEvents();

  // Initialize password visibility toggles and observe SPA content changes
  observePasswordTogglesOnMain();
  observeCheckoutPaymentCards();

  // OAuth callback must save/verify its token before normal session restoration or login routing.
  const initialOAuthCallback = readOAuthCallback();
  const isOAuthCallbackRoute = normalizeRoute(window.location.hash) === "auth-callback";
  if (initialOAuthCallback.hasCallbackData || isOAuthCallbackRoute) {
    renderRoute();
    return;
  }

  // Try restore session but do not block UI
  let settled = false;
  let rendered = false;
  const renderOnce = () => {
    if (rendered) return;
    rendered = true;
    renderRoute();
    renderHeader();
  };

  customerAuth.restoreSession().finally(() => {
    settled = true;
    Promise.all([refreshCart(), refreshWishlist()]).finally(renderOnce);
  });

  setTimeout(() => {
    if (!settled) {
      renderOnce();
    }
  }, 1200);
}

function resolveLayoutElements() {
  layoutState.header = document.querySelector("#customer-header");
  layoutState.main = document.querySelector("#customer-main");
  layoutState.footer = document.querySelector("#customer-footer");
  return Boolean(layoutState.header && layoutState.main && layoutState.footer);
}

function renderLayout() {
  layoutState.header.innerHTML = createCustomerHeader(customerAuth.getUser(), layoutState.cart, layoutState.wishlistTotal);
  initCustomerHeader(layoutState.header, { onLogout: async () => { await customerAuth.logout(); } });
  layoutState.footer.innerHTML = createCustomerFooter();
  initNewsletterOfferPopup();
}


function initNewsletterOfferPopup() {
  if (isAuthSurfaceRoute()) {
    document.querySelector("[data-newsletter-popup]")?.remove();
    return;
  }

  if (layoutState.newsletterPopup.shown || sessionStorage.getItem("newsletterPopupClosed") === "true") {
    return;
  }

  clearTimeout(layoutState.newsletterPopup.showTimer);
  layoutState.newsletterPopup.showTimer = window.setTimeout(() => {
    if (layoutState.newsletterPopup.shown || sessionStorage.getItem("newsletterPopupClosed") === "true") {
      return;
    }

    const existing = document.querySelector("[data-newsletter-popup]");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", createNewsletterOfferPopup());
    const popup = document.querySelector("[data-newsletter-popup]");
    if (!popup) return;

    layoutState.newsletterPopup.shown = true;
    bindNewsletterOfferPopup(popup);
    window.requestAnimationFrame(() => popup.classList.add("is-open"));
    scheduleNewsletterPopupHide(popup, 15000);
  }, 1000);
}

function createNewsletterOfferPopup() {
  return `
    <aside class="newsletter-popup" data-newsletter-popup role="dialog" aria-modal="false" aria-labelledby="newsletter-popup-title">
      <button class="newsletter-popup-close" type="button" data-newsletter-popup-close aria-label="Dong popup uu dai">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      <div class="newsletter-popup-badge">N&amp;L STORE</div>
      <h2 id="newsletter-popup-title">Nh&#7853;n &#432;u &#273;&#227;i &#273;&#7863;c bi&#7879;t</h2>
      <p>&#272;&#259;ng k&#253; email &#273;&#7875; nh&#7853;n m&#227; gi&#7843;m gi&#225; cho &#273;&#417;n h&#224;ng &#273;&#7847;u ti&#234;n.</p>
      <form class="newsletter-popup-form" data-newsletter-popup-form novalidate>
        <label class="sr-only" for="newsletter-popup-email">Email</label>
        <input id="newsletter-popup-email" name="email" type="email" autocomplete="email" placeholder="Email c&#7911;a b&#7841;n" required>
        <button class="customer-button" type="submit">Nh&#7853;n m&#227; &#432;u &#273;&#227;i</button>
      </form>
      <p class="newsletter-popup-feedback" data-newsletter-popup-feedback aria-live="polite"></p>
      <div class="newsletter-popup-code" data-newsletter-popup-code hidden>
        <span>M&#227; c&#7911;a b&#7841;n</span>
        <strong>SALE10</strong>
        <button type="button" data-newsletter-copy-code>Sao ch&#233;p m&#227;</button>
      </div>
    </aside>
  `;
}
function isAuthSurfaceRoute() {
  const route = String(window.location.hash || "#home").replace(/^#/, "").split("?")[0];
  return ["login", "register", "phone-login", "forgot-password", "auth-callback"].includes(route);
}

function bindNewsletterOfferPopup(popup) {
  const form = popup.querySelector("[data-newsletter-popup-form]");
  const feedback = popup.querySelector("[data-newsletter-popup-feedback]");
  const codeBox = popup.querySelector("[data-newsletter-popup-code]");
  const closeButton = popup.querySelector("[data-newsletter-popup-close]");
  const copyButton = popup.querySelector("[data-newsletter-copy-code]");
  const originalCopyText = copyButton?.textContent || "Sao chép mã";

  closeButton?.addEventListener("click", () => closeNewsletterPopup(popup, { remember: true }));

  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("SALE10");
      copyButton.textContent = "\u0110\u00e3 sao ch\u00e9p";
      copyButton.classList.add("is-copied");
      setNewsletterPopupFeedback(feedback, "\u0110\u00e3 sao ch\u00e9p m\u00e3 \u01b0u \u0111\u00e3i", "success");
      scheduleNewsletterPopupHide(popup, 1000);
    } catch {
      copyButton.textContent = originalCopyText;
      copyButton.classList.remove("is-copied");
      setNewsletterPopupFeedback(feedback, "Kh\u00f4ng th\u1ec3 sao ch\u00e9p t\u1ef1 \u0111\u1ed9ng. M\u00e3 c\u1ee7a b\u1ea1n l\u00e0 SALE10.", "error");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearTimeout(layoutState.newsletterPopup.hideTimer);

    const input = form.querySelector("input[type='email']");
    const button = form.querySelector("button[type='submit']");
    const email = input?.value?.trim() || "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterPopupFeedback(feedback, "Vui l\u00f2ng nh\u1eadp email h\u1ee3p l\u1ec7.", "error");
      input?.focus();
      return;
    }

    if (button) button.disabled = true;

    try {
      const response = await customerApi("/newsletter/subscribe", {
        method: "POST",
        auth: false,
        refreshOnUnauthorized: false,
        body: { email, fullName: "", source: "newsletter_popup" }
      });
      if (response?.success !== true) throw new Error(response?.message || "Newsletter subscribe failed.");
      setNewsletterPopupFeedback(feedback, response.message || "Đăng ký thành công. Mã ưu đãi của bạn đã sẵn sàng.", "success");
      form.hidden = true;
      if (codeBox) codeBox.hidden = false;
      sessionStorage.setItem("newsletterPopupClosed", "true");
      scheduleNewsletterPopupHide(popup, 15000);
    } catch (error) {
      setNewsletterPopupFeedback(feedback, getNewsletterPopupErrorMessage(error), "error");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function scheduleNewsletterPopupHide(popup, delay) {
  clearTimeout(layoutState.newsletterPopup.hideTimer);
  layoutState.newsletterPopup.hideTimer = window.setTimeout(() => closeNewsletterPopup(popup), delay);
}

function closeNewsletterPopup(popup, options = {}) {
  clearTimeout(layoutState.newsletterPopup.hideTimer);
  if (options.remember) {
    sessionStorage.setItem("newsletterPopupClosed", "true");
  }
  popup?.classList.remove("is-open");
  window.setTimeout(() => popup?.remove(), 220);
}

function setNewsletterPopupFeedback(target, message, type) {
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-success", type === "success");
  target.classList.toggle("is-error", type === "error");
}

function getNewsletterPopupErrorMessage(error) {
  if (error?.status === 422) return "Email kh\u00f4ng h\u1ee3p l\u1ec7.";
  if (error?.status === 404) return "Ch\u01b0a t\u00ecm th\u1ea5y d\u1ecbch v\u1ee5 \u0111\u0103ng k\u00fd email.";
  if (error?.status >= 500) return "H\u1ec7 th\u1ed1ng \u0111ang b\u1eadn. Vui l\u00f2ng th\u1eed l\u1ea1i sau.";
  if (error?.message === "Newsletter subscription successful." || error?.message === "Newsletter subscribe failed.") return "Kh\u00f4ng th\u1ec3 \u0111\u0103ng k\u00fd l\u00fac n\u00e0y.";
  return error?.message || "Kh\u00f4ng th\u1ec3 \u0111\u0103ng k\u00fd l\u00fac n\u00e0y.";
}
function handleFooterLinkNavigation(event) {
  const anchor = event.target.closest("[data-footer-link]");
  if (!anchor) return false;

  const target = anchor.getAttribute("data-footer-link") || "";
  const targetSection = anchor.getAttribute("data-footer-section") || "";
  event.preventDefault();

  if (target === "login") {
    if (customerAuth.isAuthenticated()) {
      notifySuccess("Bạn đã đăng nhập.");
      return true;
    }

    navigateToRoute("login");
    return true;
  }

  if (target === "orders" || target === "wishlist") {
    if (!customerAuth.isAuthenticated()) {
      layoutState.pendingRoute = target;
      layoutState.pendingRouteSection = "";
      navigateToRoute("login");
      return true;
    }

    layoutState.pendingRouteSection = "";
    navigateToRoute(target);
    return true;
  }

  if (target === "profile") {
    if (!customerAuth.isAuthenticated()) {
      layoutState.pendingRoute = "profile";
      layoutState.pendingRouteSection = targetSection === "address" ? "address" : "";
      navigateToRoute("login");
      return true;
    }

    layoutState.pendingRouteSection = targetSection === "address" ? "address" : "";
    navigateToRoute("profile");
    return true;
  }

  if (["new-arrival", "best-seller", "flash-sale", "products"].includes(target)) {
    navigateToRoute(target);
    return true;
  }

  return false;
}

function bindGlobalEvents() {
  if (layoutState._eventsBound) return;
  layoutState._eventsBound = true;

  window.addEventListener("hashchange", () => {
    renderRoute();
  });

  window.addEventListener("message", handleOAuthMessage);

  document.addEventListener("click", (event) => {
    const buyNowButton = event.target.closest("[data-buy-now]");
    if (buyNowButton) {
      event.preventDefault();
      const productId = buyNowButton.dataset.productId;
      if (productId) {
        handleProductCardBuyNow(buyNowButton);
      }
      return;
    }

    const addToCartButton = event.target.closest("[data-add-to-cart]");
    if (addToCartButton) {
      event.preventDefault();
      const productId = addToCartButton.dataset.productId;
      if (productId) {
        handleAddToCart(productId);
      }
      return;
    }

    const wishlistButton = event.target.closest("[data-wishlist-toggle]");
    if (wishlistButton) {
      event.preventDefault();
      const productId = wishlistButton.dataset.wishlistToggle;
      if (productId) {
        handleWishlistToggle(productId, wishlistButton);
      }
      return;
    }

    if (handleFooterLinkNavigation(event)) {
      return;
    }

    const anchor = event.target.closest("a[href^='#']");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    const route = normalizeRoute(href);
    if (route && isAppRoute(route)) {
      event.preventDefault();
      navigateToRoute(String(href).replace(/^#/, ""));
    }
  });

  window.addEventListener("fashion-customer-auth-changed", () => {
    const now = Date.now();
    if (now - layoutState.lastAuthChangedTime < 400) return;
    layoutState.lastAuthChangedTime = now;
    Promise.all([refreshCart(), refreshWishlist()]).finally(() => {
      renderHeader();
      if (protectedRoutes.has(normalizeRoute(window.location.hash))) {
        renderRoute();
      }
    });
  });
}

function renderHeader() {
  try {
    layoutState.header.innerHTML = createCustomerHeader(customerAuth.getUser(), layoutState.cart, layoutState.wishlistTotal);
    initCustomerHeader(layoutState.header, { onLogout: async () => { await customerAuth.logout(); } });
  } catch (e) {
    // Safe fallback: clear header
    layoutState.header.innerHTML = '';
    console.debug('[layout] renderHeader failed', e.message);
  }
}

function navigateToRoute(route, replace = false) {
  if (!route) return;
  const normalized = '#' + String(route).replace(/^#/, '');
  const targetRoute = normalizeRoute(normalized);
  if (window.location.hash === normalized) {
    if (targetRoute === 'home') {
      syncCustomerNavigationActive('home');
      scrollCustomerPageToTop(true);
      return;
    }

    if (homeSectionRoutes.has(targetRoute)) {
      syncCustomerNavigationActive(targetRoute);
      scheduleCustomerSectionScroll(targetRoute, true);
      return;
    }

    renderRoute();
    return;
  }

  if (replace && window.history && typeof window.history.replaceState === 'function') {
    window.history.replaceState(null, '', normalized);
    renderRoute();
    return;
  }

  window.location.hash = normalized;
}

function renderRoute() {
  const hasOAuthCallback = readOAuthCallback().hasCallbackData;
  const nextRoute = hasOAuthCallback ? "auth-callback" : (normalizeRoute(window.location.hash) || 'home');
  if (nextRoute === currentRoute && nextRoute !== "products") return;

  const hashPath = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
  const isOrdersDetailRoute = hashPath.startsWith('orders/');
  const isOrdersRoute = nextRoute === 'orders' || isOrdersDetailRoute;

  if (layoutState.isRenderingRoute) return;
  layoutState.isRenderingRoute = true;

  try {
    if (nextRoute === 'login' && customerAuth.isAuthenticated()) {
      const redirect = layoutState.pendingRoute || 'home';
      layoutState.pendingRoute = '';
      layoutState.pendingRouteSection = '';
      navigateToRoute(redirect, true);
      return;
    }

    if ((protectedRoutes.has(nextRoute) || isOrdersRoute) && !customerAuth.isAuthenticated()) {
      layoutState.pendingRoute = nextRoute;
      if (nextRoute === "checkout" && !getPendingCheckout()) {
        savePendingCheckout({
          action: "CART_CHECKOUT",
          sourceRoute: window.location.hash || "#cart",
          returnRoute: "#checkout"
        });
      }
      if (window.location.hash.toLowerCase() !== '#login') {
        navigateToRoute('login');
      }
      return;
    }

    const route = nextRoute;

    if (route === 'home') {
      renderHomeRoute();
      return;
    }

    if (route === "products") {
      currentRoute = route;
      renderProductListPage();
      return;
    }

    if (homeSectionRoutes.has(route)) {
      renderHomeRoute(route);
      return;
    }

    if (route === 'auth-callback') {
      renderAuthCallbackPage();
      return;
    }

    if (route === 'phone-login') {
      currentRoute = route;
      renderPhoneLoginPage();
      return;
    }

    if (route === 'forgot-password') {
      currentRoute = route;
      renderForgotPasswordPage();
      return;
    }
    if (route === 'login') {
      if (customerAuth.isAuthenticated()) {
        const redirect = layoutState.pendingRoute || 'home';
        layoutState.pendingRoute = '';
        layoutState.pendingRouteSection = '';
        navigateToRoute(redirect);
        return;
      }
      currentRoute = route;
      renderLoginPage();
      return;
    }

    if (route === 'register') {
      currentRoute = route;
      renderRegisterPage();
      return;
    }

    if (route === 'wishlist') {
      currentRoute = route;
      renderWishlistPage();
      return;
    }

    if (route === 'cart') {
      currentRoute = route;
      renderCartPage();
      return;
    }

    if (route === 'checkout') {
      currentRoute = route;
      renderCheckoutPage();
      return;
    }

    if (route === 'orders') {
      currentRoute = route;
      renderOrdersPage();
      return;
    }

    if (isOrdersDetailRoute) {
      currentRoute = hashPath;
      renderOrderDetailPage(getRouteParam(window.location.hash));
      return;
    }

    if (route === 'profile') {
      currentRoute = route;
      renderProfilePage();
      return;
    }

    if (route.startsWith('product-detail')) {
      currentRoute = hashPath || route;
      const id = getRouteParam(window.location.hash);
      layoutState.main.replaceChildren();
      layoutState.main.innerHTML = createProductDetailPage(id);
      const detailInit = initProductDetailPage(layoutState.main, id, {
        onAddToCart: async (payload) => {
          await handleAddToCartPayload(payload);
        },
        onBuyNow: (item) => {
          startBuyNowCheckout(item);
        }
      });
      Promise.resolve(detailInit).finally(syncWishlistToggleButtons);
      return;
    }

    renderHomeRoute();
  } finally {
    layoutState.isRenderingRoute = false;
  }
}

function renderHomeRoute(sectionId = "") {
  const route = sectionId || 'home';
  currentRoute = route;
  syncCustomerNavigationActive(route);

  layoutState.main.replaceChildren();
  layoutState.main.innerHTML = createHomePage();

  const initResult = initHomePage(layoutState.main);

  Promise.resolve(initResult).finally(() => {
    syncWishlistToggleButtons();
    if (sectionId) {
      scheduleCustomerSectionScroll(sectionId, true);
      return;
    }

    window.requestAnimationFrame(() => {
      scrollCustomerPageToTop(true);
    });
  });
}

function syncCustomerNavigationActive(route = normalizeRoute(window.location.hash)) {
  const activeHref = route && route !== 'home' ? `#${route}` : '#home';
  layoutState.header?.querySelectorAll?.('[data-customer-nav] a').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href')?.toLowerCase() === activeHref.toLowerCase());
  });
}

function getListFromApiPayload(payload, key = "items") {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;
  return [];
}
async function renderProductListPage() {
  const hashQuery = (window.location.hash.split("?")[1] || "");
  const params = new URLSearchParams(hashQuery);
  const categorySlug = decodeURIComponent(params.get("category") || "").toLowerCase();
  const keywordKey = decodeURIComponent(params.get("keyword") || "").toLowerCase();
  const searchKeyword = normalizeSearchTerm(params.get("search") || "");
  const legacyFilter = PRODUCT_MENU_FILTERS[keywordKey];
  let category = null;
  let title = searchKeyword ? `Kết quả tìm kiếm cho: ${searchKeyword}` : legacyFilter?.label || "Tất cả sản phẩm";
  const shellOptions = { showTitle: !searchKeyword };

  layoutState.main.innerHTML = renderPageShell(title, `
    <div class="customer-empty-state">
      <div class="customer-button-spinner"></div>
      <p>Đang tải sản phẩm...</p>
    </div>
  `, shellOptions);

  try {
    if (categorySlug && !searchKeyword) {
      category = await getCustomerCategoryBySlug(categorySlug);
      title = category?.name || categorySlug;
    }

    const query = new URLSearchParams({ status: "active", page: "1", limit: "100" });
    if (category?.id && !searchKeyword) {
      query.set("categoryId", String(category.id));
    } else if (legacyFilter && !searchKeyword) {
      query.set("search", [...legacyFilter.keywords, keywordKey].join("|"));
    } else if (searchKeyword) {
      query.set("search", searchKeyword);
    }

    const response = await customerApi(`/products?${query.toString()}`, { auth: false });
    const apiProducts = getListFromApiPayload(response, "products").filter(isActiveCustomerProduct);
    const products = searchKeyword
      ? apiProducts.filter((product) => matchesProductSearch(product, searchKeyword))
      : categorySlug && !category?.id
        ? apiProducts.filter((product) => isProductInCategory(product, categorySlug, category))
        : legacyFilter
          ? apiProducts.filter((product) => matchesProductMenuFilter(product, legacyFilter))
          : apiProducts;

    if (!products.length) {
      layoutState.main.innerHTML = renderPageShell(title, `
        <div class="customer-empty-state">
          <div class="customer-empty-icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></div>
          ${searchKeyword ? `<span class="ds-tag">TÌM KIẾM SẢN PHẨM</span>
          <h1>Kết quả tìm kiếm cho: ${escapeHtml(searchKeyword)}</h1>
          <p>Tìm thấy 0 sản phẩm phù hợp.</p>
          <p>Không tìm thấy sản phẩm phù hợp.</p>
          <p>Hãy thử từ khóa khác hoặc xem tất cả sản phẩm.</p>` : `<h2>Danh mục: ${escapeHtml(title)}</h2>
          <p>Chưa có sản phẩm phù hợp.</p>`}
          <a class="customer-button secondary" href="#products">Xem tất cả sản phẩm</a>
        </div>
      `, shellOptions);
      return;
    }

    const cards = uniqueCustomerProducts(products).map(mapApiProductForCard);
    window.__customerProductResults = cards;
    const resultHeading = searchKeyword ? `Kết quả tìm kiếm cho: ${escapeHtml(searchKeyword)}` : `Danh mục: ${escapeHtml(title)}`;
    layoutState.main.innerHTML = renderPageShell(title, `
      <section class="customer-product-results">
        <div class="section-heading">
          <div>
            <span class="ds-tag">${searchKeyword ? "TÌM KIẾM SẢN PHẨM" : "DANH MỤC SẢN PHẨM"}</span>
            <h1>${resultHeading}</h1>
            <p>Tìm thấy ${products.length} sản phẩm phù hợp.</p>
          </div>
        </div>
        ${createProductGrid({ items: cards, page: 1, totalPages: Math.max(1, Math.ceil(cards.length / 8)), onPageChange: "handleCustomerProductResultsPage" })}
      </section>
    `, shellOptions);
    initProductGrid(layoutState.main);
    syncWishlistToggleButtons();
    window.requestAnimationFrame(() => {
      scrollCustomerPageToTop(true);
    });
  } catch (error) {
    console.error("[products] Unable to load customer products", error);
    layoutState.main.innerHTML = renderPageShell(title, `
      <div class="customer-empty-state">
        <div class="customer-empty-icon"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i></div>
        <h2>Không thể tải sản phẩm</h2>
        <p>${escapeHtml(getCustomerProductErrorMessage(error))}</p>
        <button class="customer-button" type="button" data-products-retry>Thử lại</button>
      </div>
    `, shellOptions);
    layoutState.main.querySelector("[data-products-retry]")?.addEventListener("click", renderProductListPage);
  }
}

function getCustomerProductErrorMessage(error) {
  if (error?.status === 400 || error?.status === 422) {
    return "Không thể tìm kiếm sản phẩm với bộ lọc hiện tại. Vui lòng thử lại.";
  }
  if (error?.status >= 500) {
    return "Hệ thống đang bận. Vui lòng thử lại sau.";
  }
  return "Đã xảy ra lỗi khi tải danh sách sản phẩm. Vui lòng thử lại.";
}

let customerCategoryCache = { items: [], loadedAt: 0, promise: null };
const CUSTOMER_CATEGORY_CACHE_TTL = 5 * 60 * 1000;

async function getCustomerCategoryBySlug(slug = "") {
  const categories = await getCustomerCategories();
  const normalizedSlug = normalizeSlug(slug);
  return categories.find((category) => normalizeSlug(category.slug || category.code || category.name) === normalizedSlug) || null;
}

async function getCustomerCategories() {
  const now = Date.now();
  if (customerCategoryCache.items.length && now - customerCategoryCache.loadedAt < CUSTOMER_CATEGORY_CACHE_TTL) {
    return customerCategoryCache.items;
  }

  if (!customerCategoryCache.promise) {
    customerCategoryCache.promise = fetchCustomerCategoryPages()
      .then((items) => {
        customerCategoryCache.items = uniqueCustomerCategories(items.map(normalizeCustomerCategory));
        customerCategoryCache.loadedAt = Date.now();
        return customerCategoryCache.items;
      })
      .finally(() => {
        customerCategoryCache.promise = null;
      });
  }

  return customerCategoryCache.promise;
}

async function fetchCustomerCategoryPages() {
  const firstPayload = await fetchCustomerCategoryPage(1);
  const categories = getListFromApiPayload(firstPayload, "categories");
  const pagination = firstPayload?.data?.pagination || firstPayload?.meta?.pagination || firstPayload?.pagination || {};
  const totalPages = Math.max(1, Number(pagination.totalPages || pagination.total_pages || 1));

  if (totalPages > 1) {
    const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchCustomerCategoryPage(index + 2)));
    rest.forEach((payload) => categories.push(...getListFromApiPayload(payload, "categories")));
  }

  return categories;
}

async function fetchCustomerCategoryPage(page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: "100", sortBy: "sortOrder", sortOrder: "asc", _: String(Date.now()) });
  return customerApi(`/categories?${query.toString()}`, { auth: false });
}

function normalizeCustomerCategory(category = {}) {
  const name = category.name || "Danh mục";
  const slug = category.slug || category.code || normalizeSlug(name);
  return { id: category.id, name, slug };
}

function uniqueCustomerCategories(categories = []) {
  const seen = new Set();
  return categories.filter((category) => {
    const key = String(category.slug || category.id || category.name || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


function uniqueCustomerProducts(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = String(item?.id ?? item?.productId ?? item?.product_id ?? "").trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

window.handleCustomerProductResultsPage = function handleCustomerProductResultsPage(page) {
  const section = document.querySelector(".customer-product-results");
  const current = section?.querySelector("[data-product-grid-shell]");
  const items = window.__customerProductResults || [];
  if (!section || !current) return;
  current.outerHTML = createProductGrid({
    items,
    page,
    totalPages: Math.max(1, Math.ceil(items.length / 8)),
    onPageChange: "handleCustomerProductResultsPage"
  });
  initProductGrid(section);
  section.scrollIntoView({ behavior: "smooth", block: "start" });
};
function isProductInCategory(product = {}, slug = "", category = null) {
  if (category?.id && String(product.categoryId ?? product.category_id ?? "") === String(category.id)) return true;
  const normalizedSlug = normalizeSlug(slug);
  const productCategorySlug = normalizeSlug(product.categorySlug || product.category_slug || product.category?.slug || "");
  if (productCategorySlug && productCategorySlug === normalizedSlug) return true;
  const categoryName = normalizeSlug(product.categoryName || product.category_name || product.category || "");
  return Boolean(categoryName && categoryName === normalizedSlug);
}

function normalizeSlug(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapApiProductForCard(product = {}) {
  const originalPrice = Number(product.price || 0);
  const hasSalePrice = product.salePrice !== null && product.salePrice !== undefined && Number(product.salePrice) < originalPrice;
  const price = hasSalePrice ? Number(product.salePrice) : originalPrice;
  return {
    id: product.id,
    name: product.name || "",
    category: product.categoryName || product.category_name || "Sản phẩm",
    image: resolveProductImageUrl(product.thumbnailUrl || product.thumbnail_url || ""),
    hoverImage: "",
    price,
    comparePrice: hasSalePrice ? originalPrice : null,
    discount: hasSalePrice && originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    rating: Number(product.ratingAverage ?? product.rating_average ?? product.rating ?? 4.8),
    sold: Number(product.sold || 0),
    badge: hasSalePrice ? "GIẢM GIÁ" : "SẢN PHẨM",
    inStock: Number(product.stock || 0) > 0,
    stock: Number(product.stock || 0),
    salePrice: product.salePrice ?? product.sale_price ?? null,
    finalPrice: price,
    thumbnailUrl: resolveProductImageUrl(product.thumbnailUrl || product.thumbnail_url || ""),
    imageUrl: resolveProductImageUrl(product.thumbnailUrl || product.thumbnail_url || ""),
    selectedImageUrl: resolveProductImageUrl(product.thumbnailUrl || product.thumbnail_url || ""),
    variantCount: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)),
    hasVariants: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)) > 0,
    variants: Array.isArray(product.variants) ? product.variants : []
  };
}


function normalizeSearchTerm(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isActiveCustomerProduct(product = {}) {
  const status = String(product.status || "active").toLowerCase();
  return status === "active" && !(product.deletedAt || product.deleted_at);
}

function matchesProductSearch(product = {}, rawKeyword = "") {
  const normalizedKeyword = normalizeSearchText(rawKeyword);
  if (!normalizedKeyword) return true;
  const tags = normalizeTagsForSearch(product.tags);
  const searchable = normalizeSearchText([
    product.name,
    product.slug,
    tags,
    product.shortDescription || product.short_description,
    product.description,
    product.categoryName || product.category_name || product.category,
    product.brand
  ].filter(Boolean).join(" "));
  return normalizedKeyword.split(" ").every((part) => searchable.includes(part));
}

function normalizeTagsForSearch(tags) {
  if (Array.isArray(tags)) return tags.join(" ");
  if (typeof tags !== "string") return "";
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.join(" ") : tags;
  } catch {
    return tags;
  }
}
function matchesProductMenuFilter(product = {}, filter = {}) {
  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
  const tags = Array.isArray(product.tags) ? product.tags.join(" ") : product.tags;
  const searchable = normalize([
    product.name,
    product.slug,
    tags,
    product.shortDescription || product.short_description,
    product.description,
    product.categoryName || product.category_name
  ].filter(Boolean).join(" "));

  return (filter.keywords || []).some((keyword) => {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return false;
    if (normalizedKeyword.includes("-")) {
      return searchable.includes(normalizedKeyword)
        || searchable.includes(normalizedKeyword.replaceAll("-", " "));
    }
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`, "i").test(searchable);
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderPageShell(title, content, options = {}) {
  return `
    <section class="customer-section">
      <div class="customer-container customer-page-shell">
        <article class="customer-card" style="padding:24px;">
          ${options.showTitle === false ? "" : `<h1 style="margin-bottom:12px;">${escapeHtml(title)}</h1>`}
          ${content}
        </article>
      </div>
    </section>
  `;
}

function renderSocialButtons(label = "đăng nhập") {
  return `<div class="auth-divider"><span>Hoặc ${label} với</span></div>
    <div class="auth-social-grid">
      <button class="auth-social-button" type="button" data-oauth="google" aria-label="Đăng nhập bằng Google"><span class="auth-social-icon google"><i class="fa-brands fa-google" aria-hidden="true"></i></span><span>Google</span></button>
      <button class="auth-social-button" type="button" data-oauth="facebook" aria-label="Đăng nhập bằng Facebook"><span class="auth-social-icon facebook"><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></span><span>Facebook</span></button>
    </div>`;
}
function bindOAuthButtons(root) {
  root.querySelectorAll("[data-oauth]").forEach(button => button.addEventListener("click", () => {
    const provider = button.dataset.oauth;
    if (!["google", "facebook"].includes(provider)) return;
    openOAuthLoginPopup(provider, button);
  }));
}

function openOAuthLoginPopup(provider, button) {
  const width = 520;
  const height = 650;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const features = `width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`;
  const providerLabel = provider === "facebook" ? "Facebook" : "Google";

  button.disabled = true;
  const popup = window.open(
    customerAuth.getOAuthUrl(provider),
    `${provider}-login`,
    features
  );

  if (!popup) {
    button.disabled = false;
    notifyError(`Vui lòng cho phép popup để đăng nhập ${providerLabel}.`);
    return;
  }

  layoutState.oauthPopup = popup;
  layoutState.oauthPopupProvider = provider;
  popup.focus?.();

}

async function handleOAuthMessage(event) {
  const allowedOrigins = getAllowedOAuthOrigins();
  if (!allowedOrigins.includes(event.origin)) return;
  const successTypes = ["GOOGLE_AUTH_SUCCESS", "FACEBOOK_AUTH_SUCCESS", "OAUTH_AUTH_SUCCESS"];
  const errorTypes = ["GOOGLE_AUTH_ERROR", "FACEBOOK_AUTH_ERROR", "OAUTH_AUTH_ERROR"];
  if (!event.data || ![...successTypes, ...errorTypes].includes(event.data.type)) return;

  const provider = ["google", "facebook"].includes(event.data.provider)
    ? event.data.provider
    : (event.data.type.startsWith("GOOGLE_") ? "google" : event.data.type.startsWith("FACEBOOK_") ? "facebook" : (layoutState.oauthPopupProvider || "oauth"));
  const providerLabel = provider === "facebook" ? "Facebook" : provider === "google" ? "Google" : "OAuth";

  layoutState.oauthPopup = null;
  layoutState.oauthPopupProvider = "";
  document.querySelectorAll("[data-oauth]").forEach(button => { button.disabled = false; });

  if (errorTypes.includes(event.data.type)) {
    notifyError(event.data.message || "Đăng nhập thất bại");
    return;
  }

  if (layoutState.isCompletingOAuth) return;
  layoutState.isCompletingOAuth = true;

  try {
    await customerAuth.completeExternalLogin({
      accessToken: event.data.token,
      user: event.data.user || null,
      provider
    }, true);
    await Promise.all([refreshCart(), refreshWishlist()]);
    renderHeader();
    if (await continuePendingCheckoutAfterLogin()) return;
    layoutState.pendingRoute = "";
    window.history.replaceState(null, "", "index.html#home");
    currentRoute = "";
    renderRoute();
    notifySuccess("Đăng nhập thành công");
  } catch (error) {
    console.debug(`[auth] ${providerLabel} popup login failed`, error?.message || error);
    customerAuth.clearExternalLogin(`${provider}-popup-token-invalid`);
    window.history.replaceState(null, "", "index.html#login");
    currentRoute = "";
    renderHeader();
    renderRoute();
    notifyError(error?.message || "Đăng nhập thất bại");
  } finally {
    layoutState.isCompletingOAuth = false;
  }
}
function renderLoginPage() {
  const pendingCheckout = getPendingCheckout();
  const pendingCheckoutNotice = pendingCheckout
    ? `<div class="auth-pending-checkout-note" role="status"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><span>Vui lòng đăng nhập để tiếp tục thanh toán. Lựa chọn của bạn đã được giữ lại.</span></div>`
    : "";
  layoutState.main.innerHTML = `<section class="customer-section auth-page auth-login-page"><div class="customer-container"><article class="auth-card auth-login-card auth-luxury-card">
    <aside class="auth-luxury-panel login-banner-panel" aria-label="N&L Store">
      <img src="assets/images/login-fashion-photo-placeholder.svg" alt="Thời trang cao cấp N&L Store">
      <div class="login-banner-overlay"></div>
      <div class="login-hero-content">
        <div class="login-hero-brand" aria-label="N&amp;L Store"><span class="login-hero-brand-main">N&amp;L</span><span class="login-hero-brand-sub">STORE</span></div>
        <div class="nl-login-slogan" data-no-text-split="true" aria-label="Khẳng định gu thời thượng – Kiến tạo dấu ấn riêng">
          <div class="nl-login-slogan__white">KH&#7858;NG &#272;&#7882;NH GU TH&#7900;I TH&#431;&#7906;NG</div>
          <div class="nl-login-slogan__gold">KI&#7870;N T&#7840;O D&#7844;U &#7844;N RI&#202;NG</div>
        </div>
        <p class="login-hero-subtitle">Khám phá trải nghiệm mua sắm tinh tế, hiện đại và ưu đãi dành riêng cho bạn.</p>
        <ul class="login-hero-benefits">
          <li>Bộ sưu tập mới mỗi tuần</li>
          <li>Ưu đãi dành riêng cho thành viên</li>
          <li>Theo dõi đơn hàng nhanh chóng</li>
        </ul>
      </div>
    </aside>
    <div class="auth-login-content">
      <a class="auth-back" href="#home"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Quay lại trang trước</span></a>
      <div class="auth-heading auth-login-heading"><div class="auth-logo-mark"><img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="N&amp;L Store"></div><span class="auth-kicker">N&amp;L STORE</span><h1>Ch&#224;o m&#7915;ng tr&#7903; l&#7841;i</h1><p>&#272;&#259;ng nh&#7853;p &#273;&#7875; ti&#7871;p t&#7909;c tr&#7843;i nghi&#7879;m N&amp;L Store.</p></div>
      <form data-login-form class="auth-form auth-login-form" novalidate><div data-auth-message hidden></div>${pendingCheckoutNotice}
        <label class="auth-field"><span>Email hoặc số điện thoại</span><div class="auth-input-shell"><i class="fa-regular fa-envelope" aria-hidden="true"></i><input name="email" required autocomplete="username" placeholder="email@example.com hoặc 0901234567"></div><small data-field-error="email"></small></label>
        <label class="auth-field"><span>Mật khẩu</span><div class="auth-input-shell"><i class="fa-solid fa-lock" aria-hidden="true"></i><input type="password" name="password" required autocomplete="current-password" placeholder="Nhập mật khẩu"></div><small data-field-error="password"></small></label>
        <div class="auth-row"><label class="auth-check"><input type="checkbox" name="remember"><span>Ghi nhớ đăng nhập</span></label><a href="#forgot-password">Quên mật khẩu?</a></div>
        <button class="customer-button auth-primary" type="submit"><span>Đăng nhập</span></button>
        ${renderSocialButtons("tiếp tục")}
        <a class="auth-phone-button" href="#phone-login"><i class="fa-solid fa-phone" aria-hidden="true"></i><span>Đăng nhập bằng số điện thoại</span></a>
        <p class="auth-switch">Chưa có tài khoản? <a href="#register">Đăng ký</a></p>
      </form>
    </div>
  </article></div></section>`;
  resetAuthRouteScroll();
  const root = layoutState.main; bindOAuthButtons(root);
  root.querySelector("[data-login-form]")?.addEventListener("submit", async event => {
    event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); const button=form.querySelector("button[type=submit]"); clearLoginFieldErrors(form);
    if(customerAuth.isLoginSubmitting)return; customerAuth.isLoginSubmitting=true; button.disabled=true; button.innerHTML="<span class=\"customer-button-spinner\" aria-hidden=\"true\"></span><span>Đang đăng nhập...</span>";
    try { await customerAuth.login({ email:String(data.get("email")||"").trim(), password:String(data.get("password")||""), remember:Boolean(data.get("remember")) }); await Promise.all([refreshCart(), refreshWishlist()]); renderHeader(); if (await continuePendingCheckoutAfterLogin()) return; notifySuccess("Đăng nhập thành công."); const redirect=layoutState.pendingRoute||"home"; layoutState.pendingRoute=""; navigateToRoute(redirect); }
    catch(error){ showLoginError(form,error); }
    finally{ customerAuth.isLoginSubmitting=false; button.disabled=false; button.innerHTML="<span>Đăng nhập</span>"; }
  });
}

function resetAuthRouteScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function clearLoginFieldErrors(form) {
  form.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; });
}

function showLoginError(form, error) {
  const message = error?.message || "Đăng nhập thất bại.";
  const code = String(error?.code || "");
  const targetField = code.includes("PASSWORD") || code === "INVALID_CREDENTIALS" ? "password" : "email";
  const fieldNode = form.querySelector(`[data-field-error="${targetField}"]`);
  if (fieldNode) fieldNode.textContent = message;
  showCustomerMessage(form, message);
}
function renderForgotPasswordPage() {
  let resetEmail = "";
  let countdownTimer = null;
  let forgotRequestPending = false;
  layoutState.main.innerHTML = `<section class="customer-section auth-page auth-login-page"><div class="customer-container"><article class="auth-card auth-login-card">
    <a class="auth-back" href="#login"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Quay lại đăng nhập</span></a>
    <div class="auth-heading auth-login-heading"><div class="auth-logo-mark"><img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="N&amp;L Store"></div><span class="auth-kicker">N&amp;L SHOP</span><h1>Quên mật khẩu</h1><p>Nhập email tài khoản để nhận mã xác thực đặt lại mật khẩu.</p></div>
    <form data-forgot-form class="auth-form auth-login-form"><div data-auth-message hidden></div>
      <div data-forgot-email-step>
        <label class="auth-field"><span>Email</span><div class="auth-input-shell"><i class="fa-regular fa-envelope" aria-hidden="true"></i><input type="email" name="email" required autocomplete="email" placeholder="email@example.com"></div><small data-field-error="email"></small></label>
        <button class="customer-button auth-primary" type="submit"><span>Gửi mã xác thực</span></button>
      </div>
      <div data-forgot-reset-step hidden>
        <label class="auth-field"><span>Mã xác thực</span><div class="auth-input-shell"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i><input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="Nhập mã 6 số"></div><small data-field-error="code"></small></label>
        <label class="auth-field"><span>Mật khẩu mới</span><div class="auth-input-shell"><i class="fa-solid fa-lock" aria-hidden="true"></i><input type="password" name="password" autocomplete="new-password" placeholder="Tối thiểu 8 ký tự"></div><small data-field-error="password"></small></label>
        <label class="auth-field"><span>Xác nhận mật khẩu</span><div class="auth-input-shell"><i class="fa-solid fa-lock" aria-hidden="true"></i><input type="password" name="confirmPassword" autocomplete="new-password" placeholder="Nhập lại mật khẩu mới"></div><small data-field-error="confirmPassword"></small></label>
        <button class="customer-button auth-primary" type="submit"><span>Đổi mật khẩu</span></button>
        <button class="auth-resend-button" type="button" data-forgot-resend disabled>Gửi lại mã sau <strong data-forgot-countdown>60</strong>s</button>
      </div>
      <p class="auth-switch">Đã nhớ mật khẩu? <a href="#login">Đăng nhập</a></p>
    </form></article></div></section>`;

  const root = layoutState.main;
  const form = root.querySelector("[data-forgot-form]");
  const emailStep = root.querySelector("[data-forgot-email-step]");
  const resetStep = root.querySelector("[data-forgot-reset-step]");
  const resendButton = root.querySelector("[data-forgot-resend]");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const visibleResetStep = !resetStep.hidden;
    const button = event.submitter?.matches("button[type='submit']") ? event.submitter : form.querySelector("button[type='submit']");

    if (!visibleResetStep) {
      await submitForgotEmail(form, button, data.get("email"));
      return;
    }

    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    const code = String(data.get("code") || "").trim();
    if (!/^\d{6}$/.test(code)) {
      showCustomerMessage(form, "Mã xác thực phải gồm 6 chữ số.");
      return;
    }
    if (password.length < 8) {
      showCustomerMessage(form, "Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      showCustomerMessage(form, "Xác nhận mật khẩu không khớp.");
      return;
    }

    button.disabled = true;
    button.innerHTML = "<span>Đang đổi mật khẩu...</span>";
    try {
      await customerAuth.resetPassword({ email: resetEmail, code, password, confirmPassword });
      notifySuccess("Mật khẩu đã được đặt lại. Vui lòng đăng nhập.");
      navigateToRoute("login");
    } catch (error) {
      showCustomerMessage(form, error?.message || "Không thể đặt lại mật khẩu.");
    } finally {
      button.disabled = false;
      button.innerHTML = "<span>Đổi mật khẩu</span>";
    }
  });

  resendButton?.addEventListener("click", async () => {
    if (!resetEmail) return;
    await submitForgotEmail(form, resendButton, resetEmail, { resend: true });
  });

  async function submitForgotEmail(formElement, button, emailValue, options = {}) {
    if (forgotRequestPending) return;
    const email = String(emailValue || "").trim().toLowerCase();
    if (!email) {
      showCustomerMessage(formElement, "Vui lòng nhập email.");
      return;
    }

    forgotRequestPending = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    const idleText = options.resend ? "Gửi lại mã xác thực" : "<span>Gửi mã xác thực</span>";

    if (button) {
      button.disabled = true;
      button.innerHTML = options.resend ? "Đang gửi lại..." : "<span>Đang gửi mã...</span>";
    }

    let requestSucceeded = false;
    try {
      const result = await customerAuth.forgotPassword(email, { signal: controller.signal });
      resetEmail = email;
      emailStep.hidden = true;
      resetStep.hidden = false;
      resetStep.querySelectorAll("input").forEach((input) => { input.required = true; });
      showCustomerMessage(formElement, result?.message || "Nếu email hợp lệ, mã xác thực đã được gửi.", "success");
      startForgotCountdown(Number(result?.resendAfter || 60));
      requestSucceeded = true;
      resetStep.querySelector("[name='code']")?.focus();
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
        : (error?.message || "Không thể gửi mã xác thực.");
      showCustomerMessage(formElement, message);
    } finally {
      window.clearTimeout(timeoutId);
      forgotRequestPending = false;
      if (button && (!requestSucceeded || resetStep.hidden)) {
        button.disabled = false;
        button.innerHTML = idleText;
      }
      if (requestSucceeded && !resetStep.hidden && resendButton) {
        resendButton.disabled = true;
      }
    }
  }

  function startForgotCountdown(seconds) {
    window.clearInterval(countdownTimer);
    let left = Math.max(Number(seconds || 60), 1);
    const counter = root.querySelector("[data-forgot-countdown]");
    resendButton.disabled = true;
    const update = () => {
      if (counter) counter.textContent = String(Math.max(left, 0));
      resendButton.innerHTML = `Gửi lại mã sau <strong data-forgot-countdown>${Math.max(left, 0)}</strong>s`;
      left -= 1;
      if (left < 0) {
        window.clearInterval(countdownTimer);
        resendButton.disabled = false;
        resendButton.textContent = "Gửi lại mã xác thực";
      }
    };
    update();
    countdownTimer = window.setInterval(update, 1000);
  }
}
const REGISTER_PASSWORD_HELP_TEXT = "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";
const REGISTER_PASSWORD_ERROR_MESSAGE = "Mật khẩu chưa hợp lệ.";
const REGISTER_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\dA-Za-z]).{8,}$/;
const REGISTER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGISTER_PHONE_PATTERN = /^0(3|5|7|8|9)\d{8}$/;
const REGISTER_FIELD_MESSAGES = Object.freeze({
  fullNameRequired: "Vui lòng nhập họ và tên.",
  fullNameInvalid: "Họ và tên chưa hợp lệ.",
  phoneRequired: "Vui lòng nhập số điện thoại.",
  phoneInvalid: "Số điện thoại chưa hợp lệ.",
  phoneDuplicate: "Số điện thoại này đã được sử dụng.",
  emailRequired: "Vui lòng nhập email.",
  emailInvalid: "Email không đúng định dạng.",
  emailDuplicate: "Email này đã được sử dụng.",
  addressInvalid: "Vui lòng nhập địa chỉ đầy đủ hơn.",
  confirmRequired: "Vui lòng xác nhận mật khẩu.",
  confirmMismatch: "Mật khẩu xác nhận chưa khớp.",
  termsRequired: "Vui lòng đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư.",
  genericRegister: "Không thể đăng ký tài khoản lúc này. Vui lòng thử lại sau."
});

function isRegisterPasswordValid(password) { return REGISTER_PASSWORD_PATTERN.test(String(password || "")); }
function normalizeRegisterPhone(phone) { return String(phone || "").replace(/[\s.-]/g, "").trim(); }
function isRegisterAddressValid(address) {
  const text = String(address || "").trim();
  const meaningful = text.replace(/[^\p{L}\p{N}]/gu, "");
  return meaningful.length >= 5 && /[\p{L}\p{N}]/u.test(meaningful);
}
function ensureRegisterErrorNode(form, field) {
  if (field === "password") return form.querySelector("[data-register-password-help]");
  return form.querySelector(`[data-field-error="${CSS.escape(field)}"]`);
}
function getRegisterFieldShell(form, field) {
  const input = form.elements[field];
  return field === "acceptTerms" ? input?.closest(".auth-terms") || null : input?.closest(".auth-field") || null;
}
function resetRegisterFieldErrors(form) {
  form.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; });
  const passwordHelp = form.querySelector("[data-register-password-help]");
  if (passwordHelp) { passwordHelp.textContent = REGISTER_PASSWORD_HELP_TEXT; passwordHelp.removeAttribute("data-field-error"); }
  form.querySelectorAll(".is-invalid, .is-valid").forEach((node) => node.classList.remove("is-invalid", "is-valid"));
  form.querySelectorAll(".auth-input-shell input, .auth-terms input").forEach((input) => { input.setCustomValidity(""); input.removeAttribute("aria-invalid"); });
  form.querySelector("[data-auth-message]")?.setAttribute("hidden", "");
}
function clearRegisterFieldError(form, field) {
  const node = ensureRegisterErrorNode(form, field), input = form.elements[field], shell = getRegisterFieldShell(form, field);
  if (node) { node.textContent = field === "password" ? REGISTER_PASSWORD_HELP_TEXT : ""; if (field === "password") node.removeAttribute("data-field-error"); }
  shell?.classList.remove("is-invalid", "is-valid"); input?.setCustomValidity(""); input?.removeAttribute("aria-invalid"); input?.removeAttribute("aria-describedby");
}
function setRegisterFieldError(form, field, message) {
  const node = ensureRegisterErrorNode(form, field), input = form.elements[field], shell = getRegisterFieldShell(form, field);
  if (node) { if (!node.id) node.id = `register-${field}-error`; if (field === "password") node.setAttribute("data-field-error", "password"); node.textContent = message; input?.setAttribute("aria-describedby", node.id); }
  shell?.classList.remove("is-valid");
  shell?.classList.add("is-invalid");
  if (input) { input.setAttribute("aria-invalid", "true"); input.setCustomValidity(message); }
}
function setRegisterFieldValid(form, field) {
  const node = ensureRegisterErrorNode(form, field), input = form.elements[field], shell = getRegisterFieldShell(form, field);
  if (node) node.textContent = "";
  shell?.classList.remove("is-invalid");
  shell?.classList.add("is-valid");
  input?.setCustomValidity("");
  input?.removeAttribute("aria-invalid");
  input?.removeAttribute("aria-describedby");
}
function updateRegisterConfirmState(form, options = {}) {
  const password = String(form.elements.password?.value || "");
  const confirmPassword = String(form.elements.confirmPassword?.value || "");
  if (!confirmPassword) {
    if (options.required) setRegisterFieldError(form, "confirmPassword", REGISTER_FIELD_MESSAGES.confirmRequired);
    else clearRegisterFieldError(form, "confirmPassword");
    return !options.required;
  }
  if (confirmPassword !== password) {
    setRegisterFieldError(form, "confirmPassword", REGISTER_FIELD_MESSAGES.confirmMismatch);
    return false;
  }
  setRegisterFieldValid(form, "confirmPassword");
  return true;
}
function getRegisterPayload(form) {
  const data = new FormData(form);
  return { fullName: String(data.get("fullName") || "").trim(), phone: normalizeRegisterPhone(data.get("phone")), address: String(data.get("address") || "").trim(), email: String(data.get("email") || "").trim(), password: String(data.get("password") || ""), confirmPassword: String(data.get("confirmPassword") || ""), acceptTerms: Boolean(data.get("acceptTerms")) };
}
function validateRegisterField(form, field, payload = null) {
  const data = payload || getRegisterPayload(form);
  if (field === "fullName") { if (!data.fullName) return REGISTER_FIELD_MESSAGES.fullNameRequired; if (data.fullName.length < 2 || !/[\p{L}]/u.test(data.fullName)) return REGISTER_FIELD_MESSAGES.fullNameInvalid; }
  if (field === "phone") { if (!data.phone) return REGISTER_FIELD_MESSAGES.phoneRequired; if (!REGISTER_PHONE_PATTERN.test(data.phone)) return REGISTER_FIELD_MESSAGES.phoneInvalid; }
  if (field === "email") { if (!data.email) return REGISTER_FIELD_MESSAGES.emailRequired; if (!REGISTER_EMAIL_PATTERN.test(data.email)) return REGISTER_FIELD_MESSAGES.emailInvalid; }
  if (field === "address" && !isRegisterAddressValid(data.address)) return REGISTER_FIELD_MESSAGES.addressInvalid;
  if (field === "password" && !isRegisterPasswordValid(data.password)) return REGISTER_PASSWORD_ERROR_MESSAGE;
  if (field === "confirmPassword") { if (!data.confirmPassword) return REGISTER_FIELD_MESSAGES.confirmRequired; if (data.password !== data.confirmPassword) return REGISTER_FIELD_MESSAGES.confirmMismatch; }
  if (field === "acceptTerms" && !data.acceptTerms) return REGISTER_FIELD_MESSAGES.termsRequired;
  return "";
}
function validateRegisterForm(form, payload) {
  const errors = {};
  ["fullName", "phone", "address", "email", "password", "confirmPassword", "acceptTerms"].forEach((field) => { const message = validateRegisterField(form, field, payload); if (message) errors[field] = message; });
  Object.entries(errors).forEach(([field, message]) => setRegisterFieldError(form, field, message));
  return { isValid: Object.keys(errors).length === 0, errors };
}
function focusFirstRegisterError(form) {
  const target = form.querySelector(".auth-field.is-invalid input, .auth-terms.is-invalid input");
  target?.focus({ preventScroll: true }); target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}
function collectRegisterApiFieldErrors(error) {
  const details = error?.details;
  const detailList = Array.isArray(details) ? details : Object.entries(details || {}).flatMap(([field, messages]) => (Array.isArray(messages) ? messages : [messages]).map((message) => ({ field, message })));
  const errors = {}, code = String(error?.code || ""), apiMessage = String(error?.message || "").toLowerCase();
  const duplicateMessage = /(already|exist|registered|tồn tại|đã được sử dụng)/i.test(apiMessage);
  if (code === "USER_EMAIL_EXISTS" || (apiMessage.includes("email") && duplicateMessage)) errors.email = REGISTER_FIELD_MESSAGES.emailDuplicate;
  if (code === "USER_PHONE_EXISTS" || (apiMessage.includes("phone") && duplicateMessage)) errors.phone = REGISTER_FIELD_MESSAGES.phoneDuplicate;
  detailList.forEach((item) => {
    const field = item?.field, itemCode = String(item?.code || ""), itemMessage = String(item?.message || "").toLowerCase();
    if (field === "email" || itemCode === "USER_EMAIL_EXISTS" || itemCode === "INVALID_EMAIL") errors.email = itemCode === "USER_EMAIL_EXISTS" || /(already|exist|registered|tồn tại|đã được sử dụng)/i.test(itemMessage) ? REGISTER_FIELD_MESSAGES.emailDuplicate : REGISTER_FIELD_MESSAGES.emailInvalid;
    if (field === "phone" || itemCode === "USER_PHONE_EXISTS" || itemCode === "INVALID_PHONE") errors.phone = itemCode === "USER_PHONE_EXISTS" || /(already|exist|registered|tồn tại|đã được sử dụng)/i.test(itemMessage) ? REGISTER_FIELD_MESSAGES.phoneDuplicate : REGISTER_FIELD_MESSAGES.phoneInvalid;
    if (field === "fullName") errors.fullName = itemCode === "REQUIRED" ? REGISTER_FIELD_MESSAGES.fullNameRequired : REGISTER_FIELD_MESSAGES.fullNameInvalid;
    if (field === "address") errors.address = REGISTER_FIELD_MESSAGES.addressInvalid;
    if (field === "password" || (itemCode.startsWith("PASSWORD_") && itemCode !== "PASSWORD_CONFIRMATION_MISMATCH")) errors.password = REGISTER_PASSWORD_ERROR_MESSAGE;
    if (field === "confirmPassword" || itemCode === "PASSWORD_CONFIRMATION_MISMATCH") errors.confirmPassword = REGISTER_FIELD_MESSAGES.confirmMismatch;
    if (field === "acceptTerms") errors.acceptTerms = REGISTER_FIELD_MESSAGES.termsRequired;
  });
  return errors;
}
function showRegisterApiError(form, error) {
  const fieldErrors = collectRegisterApiFieldErrors(error);
  if (Object.keys(fieldErrors).length) { Object.entries(fieldErrors).forEach(([field, message]) => setRegisterFieldError(form, field, message)); focusFirstRegisterError(form); return; }
  showCustomerMessage(form, REGISTER_FIELD_MESSAGES.genericRegister);
}
function bindRegisterLiveValidation(form) {
  ["fullName", "phone", "address", "email"].forEach((field) => {
    form.elements[field]?.addEventListener("input", () => { const message = validateRegisterField(form, field); if (!message) clearRegisterFieldError(form, field); });
  });
  form.elements.password?.addEventListener("input", () => {
    if (!validateRegisterField(form, "password")) clearRegisterFieldError(form, "password");
    updateRegisterConfirmState(form);
  });
  form.elements.confirmPassword?.addEventListener("input", () => updateRegisterConfirmState(form));
  form.elements.acceptTerms?.addEventListener("change", () => { if (!validateRegisterField(form, "acceptTerms")) clearRegisterFieldError(form, "acceptTerms"); });
}
function renderRegisterPage() {
  layoutState.main.innerHTML = `<section class="customer-section auth-page auth-login-page auth-register-page"><div class="customer-container"><article class="auth-card auth-register-card">
    <div class="auth-register-content">
      <a class="auth-back" href="#home"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Quay l&#7841;i trang tr&#432;&#7899;c</span></a>
      <div class="auth-heading auth-register-heading"><div class="auth-logo-mark"><img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt="N&amp;L Store"></div><span class="auth-kicker">N&amp;L STORE</span><h1>&#272;&#259;ng k&#253; t&#224;i kho&#7843;n</h1><p>T&#7841;o t&#224;i kho&#7843;n &#273;&#7875; b&#7855;t &#273;&#7847;u tr&#7843;i nghi&#7879;m N&amp;L Store.</p></div>
      <form data-register-form class="auth-form auth-register-form"><div data-auth-message hidden></div><div class="auth-register-grid">
        <label class="auth-field"><span>H&#7885; v&#224; t&#234;n</span><div class="auth-input-shell"><i class="fa-regular fa-user" aria-hidden="true"></i><input name="fullName" required autocomplete="name" placeholder="Nguy&#7877;n V&#259;n A"></div><small data-field-error="fullName"></small></label>
        <label class="auth-field"><span>S&#7889; &#273;i&#7879;n tho&#7841;i</span><div class="auth-input-shell"><i class="fa-solid fa-phone" aria-hidden="true"></i><input type="tel" name="phone" required autocomplete="tel" placeholder="0901234567"></div><small data-field-error="phone"></small></label>
        <label class="auth-field auth-full"><span>&#272;&#7883;a ch&#7881;</span><div class="auth-input-shell"><i class="fa-regular fa-map" aria-hidden="true"></i><input name="address" required autocomplete="street-address" placeholder="S&#7889; nh&#224;, &#273;&#432;&#7901;ng, ph&#432;&#7901;ng/x&#227;, t&#7881;nh/th&#224;nh"></div><small data-field-error="address"></small></label>
        <label class="auth-field auth-full"><span>Email</span><div class="auth-input-shell"><i class="fa-regular fa-envelope" aria-hidden="true"></i><input type="email" name="email" required autocomplete="email" placeholder="email@example.com"></div><small data-field-error="email"></small></label>
        <label class="auth-field"><span>M&#7853;t kh&#7849;u</span><div class="auth-input-shell"><i class="fa-solid fa-lock" aria-hidden="true"></i><input type="password" name="password" required autocomplete="new-password" placeholder="&#205;t nh&#7845;t 8 k&#253; t&#7921;"></div><small data-register-password-help>Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small></label>
        <label class="auth-field"><span>X&#225;c nh&#7853;n m&#7853;t kh&#7849;u</span><div class="auth-input-shell"><i class="fa-solid fa-lock" aria-hidden="true"></i><input type="password" name="confirmPassword" required autocomplete="new-password" placeholder="Nh&#7853;p l&#7841;i m&#7853;t kh&#7849;u"></div><small data-field-error="confirmPassword"></small></label>
      </div><label class="auth-check auth-terms"><input type="checkbox" name="acceptTerms" required><span>T&#244;i &#273;&#7891;ng &#253; v&#7899;i <a href="#terms">&#272;i&#7873;u kho&#7843;n s&#7917; d&#7909;ng</a> v&#224; <a href="#privacy">Ch&#237;nh s&#225;ch quy&#7873;n ri&#234;ng t&#432;</a></span><small data-field-error="acceptTerms"></small></label>
        <button class="customer-button auth-primary" type="submit"><span>&#272;&#259;ng k&#253;</span></button>${renderSocialButtons("ti&#7871;p t&#7909;c")}
        <p class="auth-switch">&#272;&#227; c&#243; t&#224;i kho&#7843;n? <a href="#login">&#272;&#259;ng nh&#7853;p</a></p>
      </form>
    </div>
  </article></div></section>`;
  resetAuthRouteScroll();
  const root=layoutState.main; bindOAuthButtons(root);
  const registerForm = root.querySelector("[data-register-form]");
  if (registerForm) bindRegisterLiveValidation(registerForm);
  registerForm?.addEventListener("submit",async event=>{ event.preventDefault(); const form=event.currentTarget,button=form.querySelector("button[type=submit]"); resetRegisterFieldErrors(form);
    const payload=getRegisterPayload(form);
    const validation=validateRegisterForm(form,payload); if(!validation.isValid){if(validation.errors.confirmPassword) form.elements.confirmPassword?.focus({ preventScroll: true }); else focusFirstRegisterError(form); return;}
    button.disabled=true; button.innerHTML="<span class=\"customer-button-spinner\" aria-hidden=\"true\"></span><span>Đang đăng ký...</span>";
    try{await customerAuth.register(payload);notifySuccess("Đăng ký thành công. Vui lòng đăng nhập.");navigateToRoute("login");}catch(error){showRegisterApiError(form,error);}finally{button.disabled=false;button.innerHTML="<span>Đăng ký</span>";}
  });
}

function renderPhoneLoginPage() {
  layoutState.main.innerHTML=`<section class="customer-section auth-page"><div class="customer-container"><article class="auth-card">
    <a class="auth-back" href="#login">← Quay lại trang trước</a><div class="auth-heading"><span class="auth-kicker">BẢO MẬT OTP</span><h1>Đăng nhập bằng số điện thoại</h1><p>Mã xác thực có hiệu lực trong 5 phút.</p></div>
    <form data-phone-form class="auth-form"><div data-auth-message hidden></div><label><span>Số điện thoại</span><input type="tel" name="phone" required placeholder="0901234567"></label>
      <button class="auth-phone-button" type="button" data-send-otp>Gửi mã OTP</button>
      <div data-otp-fields hidden><div class="otp-status">Mã đã gửi. Có thể gửi lại sau <strong data-countdown>60</strong> giây.</div><label><span>Mã OTP</span><input name="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="Nhập mã 6 số"></label>
        <label data-new-password><span>Mật khẩu mới <small>(nếu tài khoản chưa có mật khẩu)</small></span><input type="password" name="password" autocomplete="new-password"></label>
        <label data-confirm-password><span>Xác nhận mật khẩu</span><input type="password" name="confirmPassword" autocomplete="new-password"></label>
        <button class="customer-button auth-primary" type="submit">Xác thực và đăng nhập</button></div>
    </form></article></div></section>`;
  const form=layoutState.main.querySelector("[data-phone-form]"),send=form.querySelector("[data-send-otp]"),fields=form.querySelector("[data-otp-fields]"); let timer;
  send.addEventListener("click",async()=>{send.disabled=true;try{const result=await customerAuth.sendPhoneOtp(form.phone.value);fields.hidden=false;fields.querySelector("[name=otp]").required=true;const passwordField=fields.querySelector("[data-new-password]"),confirmField=fields.querySelector("[data-confirm-password]");passwordField.hidden=!result.requiresPassword;confirmField.hidden=!result.requiresPassword;passwordField.querySelector("input").required=Boolean(result.requiresPassword);confirmField.querySelector("input").required=Boolean(result.requiresPassword);let left=result.resendAfter||60;const counter=fields.querySelector("[data-countdown]");counter.textContent=left;clearInterval(timer);timer=setInterval(()=>{left-=1;counter.textContent=Math.max(left,0);if(left<=0){clearInterval(timer);send.disabled=false;send.textContent="Gửi lại mã OTP";}},1000);showCustomerMessage(form,"Mã OTP đã được gửi.","success");}catch(error){showCustomerMessage(form,error?.message||"Không thể gửi OTP.");send.disabled=false;}});
  form.addEventListener("submit",async event=>{event.preventDefault();const data=new FormData(form),button=form.querySelector("button[type=submit]");button.disabled=true;try{await customerAuth.verifyPhoneOtp({phone:String(data.get("phone")||"").trim(),otp:String(data.get("otp")||"").trim(),password:String(data.get("password")||""),confirmPassword:String(data.get("confirmPassword")||"")});await Promise.all([refreshCart(), refreshWishlist()]);renderHeader();if(await continuePendingCheckoutAfterLogin())return;notifySuccess("Đăng nhập thành công.");const redirect=layoutState.pendingRoute||"home";layoutState.pendingRoute="";navigateToRoute(redirect);}catch(error){showCustomerMessage(form,error?.message||"Xác thực OTP thất bại.");}finally{button.disabled=false;}});
}

async function renderAuthCallbackPage() {
  currentRoute = "auth-callback";
  const callback = readOAuthCallback();
  if (callback.provider === "google") {
    console.info("[Google OAuth] callback URL =", redactOAuthCallbackUrl(window.location.href));
  }

  layoutState.main.innerHTML = renderPageShell(
    "Đang hoàn tất đăng nhập",
    `<p>${escapeHtml(callback.error || "Vui lòng chờ trong giây lát...")}</p>`
  );

  if (callback.error || !callback.token) {
    customerAuth.clearExternalLogin("oauth-callback-error");
    finishOAuthFailure(callback.error || (callback.provider === "google" ? "Không nhận được token Google" : "Đăng nhập thất bại"));
    return;
  }

  try {
    await customerAuth.completeExternalLogin({ accessToken: callback.token, user: callback.user, provider: callback.provider }, true);
    await Promise.all([refreshCart(), refreshWishlist()]);
    renderHeader();
    if (await continuePendingCheckoutAfterLogin()) return;
    window.history.replaceState(null, "", "index.html#home");
    currentRoute = "";
    renderRoute();
    notifySuccess("Đăng nhập thành công");
  } catch (callbackError) {
    console.debug("[auth] OAuth callback failed", callbackError?.message || callbackError);
    customerAuth.clearExternalLogin("oauth-token-invalid");
    finishOAuthFailure(callbackError?.message || "Đăng nhập thất bại");
  }
}

function forwardOAuthCallbackToOpener() {
  const callback = readOAuthCallback();
  if (!callback.hasCallbackData) return false;
  if (!window.opener) return false;

  const provider = callback.provider === "google" ? "google" : callback.provider === "facebook" ? "facebook" : "oauth";
  if (provider === "google") {
    console.info("[Google OAuth] callback URL =", redactOAuthCallbackUrl(window.location.href));
  }
  const successType = provider === "google" ? "GOOGLE_AUTH_SUCCESS" : provider === "facebook" ? "FACEBOOK_AUTH_SUCCESS" : "OAUTH_AUTH_SUCCESS";
  const errorType = provider === "google" ? "GOOGLE_AUTH_ERROR" : provider === "facebook" ? "FACEBOOK_AUTH_ERROR" : "OAUTH_AUTH_ERROR";

  const message = callback.error || !callback.token
    ? {
        type: errorType,
        provider,
        message: callback.error || (provider === "google" ? "Không nhận được token Google" : "Đăng nhập thất bại")
      }
    : {
        type: successType,
        provider,
        token: callback.token,
        user: callback.user
      };

  const targetOrigins = getAllowedOAuthOrigins();
  targetOrigins.forEach(origin => {
    try {
      window.opener.postMessage(message, origin);
    } catch {
      // Continue until the callback matching origin receives the result.
    }
  });
  try { window.close(); } catch { /* The opener already received the OAuth result. */ }
  return true;
}

function getAllowedOAuthOrigins() {
  const origins = new Set([
    window.location.origin,
    "https://nl-store.pages.dev"
  ]);

  try {
    const current = new URL(window.location.href);
    if (["localhost", "127.0.0.1"].includes(current.hostname)) {
      origins.add(`${current.protocol}//${current.host}`);
      origins.add("http://localhost:5500");
      origins.add("http://127.0.0.1:5500");
      origins.add("http://localhost:5000");
      origins.add("http://127.0.0.1:5000");
    }
  } catch {
    // Keep the static production origin above.
  }

  return Array.from(origins).filter(Boolean);
}

function readOAuthCallback() {
  const params = getOAuthCallbackParams();
  const token = params.get("token") || params.get("access_token") || "";
  const error = params.get("error_description") || params.get("error") || params.get("message") || "";
  const popupProvider = window.name === "google-login"
    ? "google"
    : window.name === "facebook-login" ? "facebook" : "";
  const providerValue = String(params.get("provider") || popupProvider).toLowerCase();

  return {
    token,
    error,
    provider: ["google", "facebook"].includes(providerValue) ? providerValue : "oauth",
    user: decodeOAuthUser(params.get("user")),
    hasCallbackData: Boolean(token || error || params.has("provider"))
  };
}
function getOAuthCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = String(window.location.hash || "").replace(/^#/, "");
  const hashQueryIndex = hash.indexOf("?");
  const hashAmpersandIndex = hash.indexOf("&");

  if (hashQueryIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1));
    hashParams.forEach((value, key) => params.set(key, value));
  } else if (hashAmpersandIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(hashAmpersandIndex + 1));
    hashParams.forEach((value, key) => params.set(key, value));
  } else if (hash && !hash.startsWith("auth-callback")) {
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((value, key) => params.set(key, value));
  }

  return params;
}

function redactOAuthCallbackUrl(value) {
  return String(value || "").replace(/([?&]token=)[^&#]+/i, "$1[REDACTED]");
}

function decodeOAuthUser(encodedUser) {
  if (!encodedUser) return null;

  try {
    const normalized = encodedUser.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function finishOAuthFailure(message) {
  notifyError(message || "Đăng nhập thất bại");
  window.history.replaceState(null, "", "index.html#login");
  currentRoute = "";
  renderHeader();
  renderRoute();
}
async function renderCartPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Giỏ hàng", `<div class="customer-cart-empty-state"><div class="customer-cart-empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem và quản lý giỏ hàng của bạn.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  layoutState.main.innerHTML = renderPageShell("Giỏ hàng", renderCartSkeleton());

  try {
    const cart = await customerCart.load();
    layoutState.cart = cart;
    renderHeader();

    const items = Array.isArray(cart?.items) ? cart.items : [];

    if (!items.length) {
      layoutState.main.innerHTML = renderPageShell("Giỏ hàng", renderCartEmptyState());
      return;
    }

    const selectedItems = items.filter((item) => item.isSelected);
    const selectedSubtotal = selectedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const voucherSummary = getCartVoucherSummary(selectedSubtotal);
    const discountAmount = Math.min(Number(voucherSummary.discountAmount || 0), selectedSubtotal);
    const { eligibleAmount, shippingFee, vatAmount, grandTotal, freeShippingRemaining } = calculateCheckoutTotals(selectedSubtotal, discountAmount);
    const selectedCount = selectedItems.length;

    layoutState.main.innerHTML = renderPageShell("Giỏ hàng", `
      <div class="customer-cart-shell">
        <div class="customer-cart-layout">
          <div class="customer-cart-list-column">
            <div class="customer-cart-toolbar">
              <label class="customer-cart-select-all">
                <input type="checkbox" data-cart-select-all ${selectedCount === items.length ? "checked" : ""}>
                <span>Chọn tất cả (${items.length} sản phẩm)</span>
              </label>
              <div class="customer-cart-toolbar-actions">
                <div class="customer-cart-toolbar-meta">${selectedCount}/${items.length} &#273;ang ch&#7885;n</div>
                <button class="customer-cart-bulk-delete" type="button" data-cart-remove-selected ${selectedCount ? "" : "disabled"}>
                  <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
                  <span>X&#243;a &#273;&#227; ch&#7885;n</span>
                </button>
              </div>
            </div>
            <div class="customer-cart-list">
              ${items.map((item) => `
                <article class="customer-cart-item">
                  <label class="customer-cart-item-checkbox">
                    <input type="checkbox" data-cart-select-item="${item.id}" ${item.isSelected ? "checked" : ""}>
                  </label>
                  <div class="customer-cart-item-media">
                    <img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveProductImageUrl(item.productImageUrl))}" alt="${escapeHtml(item.productName || "Sản phẩm")}" loading="lazy" decoding="async" data-product-image>
                  </div>
                  <div class="customer-cart-item-body">
                    <div class="customer-cart-item-header">
                      <div>
                        <h3>${escapeHtml(item.productName || "Sản phẩm")}</h3>
                        ${item.productSku ? `<p class="customer-cart-item-sku">SKU: ${escapeHtml(item.productSku)}</p>` : ""}
                      </div>
                      <button class="customer-cart-action-link" type="button" data-cart-remove="${item.id}">Xóa</button>
                    </div>
                    <div class="customer-cart-item-details">
                      ${item.size ? `<span class="customer-cart-pill">Size ${escapeHtml(item.size)}</span>` : ""}
                      ${item.color ? `<span class="customer-cart-pill">${escapeHtml(item.color)}</span>` : ""}
                    </div>
                    <div class="customer-cart-item-price-row">
                      <div class="customer-cart-item-prices">
                        <span class="customer-cart-price">${formatCurrency(item.unitPrice || 0)}</span>
                        <span class="customer-cart-price-muted">${formatCurrency(Number(item.totalPrice || 0))}</span>
                      </div>
                      <div class="customer-cart-quantity" data-max-stock="${Number(item.variantStock || item.productStock || 0)}">
                        <button class="customer-cart-quantity-btn" type="button" data-cart-qty-dec="${item.id}">−</button>
                        <span>${Number(item.quantity || 0)}</span>
                        <button class="customer-cart-quantity-btn" type="button" data-cart-qty-inc="${item.id}">+</button>
                      </div>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          </div>

          <aside class="customer-cart-summary-card">
            <div class="customer-cart-summary-header">
              <h2>Tóm tắt đơn hàng</h2>
              <span class="customer-cart-summary-badge">${selectedCount} sản phẩm</span>
            </div>

            <div class="customer-cart-voucher">
              <div class="customer-cart-voucher-title">Mã giảm giá</div>
              <div class="customer-cart-voucher-input-row">
                <input type="text" name="voucher" value="${escapeHtml(layoutState.cartVoucher.code)}" placeholder="Nhập mã giảm giá" data-cart-voucher-input>
                <button class="customer-button secondary customer-cart-voucher-button" type="button" data-cart-voucher-apply>Áp dụng</button>
              </div>
              <div class="customer-cart-voucher-message ${voucherSummary.status === "success" ? "is-success" : voucherSummary.status === "error" ? "is-error" : ""}" data-cart-voucher-message>${escapeHtml(voucherSummary.message || "Nhập mã để nhận ưu đãi")}</div>
            </div>

            <div class="customer-cart-summary-lines">
              <div><span>Tạm tính</span><strong>${formatCurrency(selectedSubtotal)}</strong></div>
              <div><span>Giảm giá</span><strong>${formatCurrency(discountAmount)}</strong></div>
              <div><span>Thu&#7871; VAT (10%)</span><strong>&#272;&#227; g&#7891;m ${formatCurrency(vatAmount)}</strong></div>
              <div><span>Phí vận chuyển</span><strong>${formatShippingFee(shippingFee)}</strong></div>
              ${freeShippingRemaining > 0 ? `<div class="customer-checkout-free-shipping-hint"><span>Mua thêm ${formatCurrency(freeShippingRemaining)} để được miễn phí vận chuyển</span></div>` : ""}
            </div>

            <div class="customer-cart-summary-total">
              <span>Tổng thanh toán</span>
              <strong>${formatCurrency(grandTotal)}</strong>
            </div>

            <button class="customer-button customer-cart-checkout-btn" type="button" data-cart-checkout>Tiến hành thanh toán</button>
            <a class="customer-cart-secondary-link" href="#home">Tiếp tục mua sắm</a>
          </aside>
        </div>
      </div>
    `);

    bindCartPageEvents();
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Giỏ hàng", `
      <div class="customer-cart-empty-state">
        <div class="customer-cart-empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
        <h2>Không thể tải giỏ hàng</h2>
        <p>${escapeHtml(error?.message || "Đã xảy ra lỗi khi tải giỏ hàng.")}</p>
        <button class="customer-button" type="button" data-cart-retry>Thử lại</button>
      </div>
    `);

    layoutState.main.querySelector("[data-cart-retry]")?.addEventListener("click", () => {
      renderCartPage();
    });
  }
}

function renderCartSkeleton() {
  return `
    <div class="customer-cart-shell">
      <div class="customer-cart-layout">
        <div class="customer-cart-list-column">
          <div class="skeleton-line" style="width:220px;height:18px;margin-bottom:16px;"></div>
          <div class="customer-cart-list">
            ${[1, 2].map(() => `
              <div class="customer-cart-item customer-cart-skeleton-item">
                <div class="skeleton-media" style="width:92px;height:112px;border-radius:18px;"></div>
                <div class="customer-cart-item-body">
                  <div class="skeleton-line" style="width:60%;height:16px;margin-bottom:8px;"></div>
                  <div class="skeleton-line" style="width:40%;height:14px;margin-bottom:12px;"></div>
                  <div class="skeleton-line" style="width:100%;height:14px;margin-bottom:8px;"></div>
                  <div class="skeleton-line" style="width:35%;height:14px;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="customer-cart-summary-card">
          <div class="skeleton-line" style="width:70%;height:18px;margin-bottom:16px;"></div>
          <div class="skeleton-line" style="width:100%;height:56px;margin-bottom:16px;"></div>
          <div class="skeleton-line" style="width:100%;height:12px;margin-bottom:8px;"></div>
          <div class="skeleton-line" style="width:100%;height:12px;margin-bottom:8px;"></div>
          <div class="skeleton-line" style="width:100%;height:12px;margin-bottom:20px;"></div>
          <div class="skeleton-line" style="width:100%;height:46px;"></div>
        </div>
      </div>
    </div>
  `;
}

function renderCartEmptyState() {
  return `
    <div class="customer-cart-empty-state">
      <div class="customer-cart-empty-icon"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i></div>
      <h2>Giỏ hàng của bạn đang trống</h2>
      <p>Hãy thêm những sản phẩm bạn yêu thích để bắt đầu trải nghiệm mua sắm.</p>
      <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
    </div>
  `;
}

function bindCartPageEvents() {
  layoutState.main.querySelectorAll("[data-cart-qty-inc]").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemId = button.dataset.cartQtyInc;
      const container = button.parentElement;
      const maxStock = Number(container?.dataset?.maxStock || 0);
      const current = Number(container.querySelector("span")?.textContent || 0);
      if (maxStock <= 0) { notifyError("Sản phẩm này đã hết hàng"); return; }
      if (current >= maxStock) { notifyWarning(`Chỉ còn ${maxStock} sản phẩm trong kho`); return; }
      await customerCart.updateQuantity(itemId, current + 1);
      await renderCartPage();
    });
  });

  layoutState.main.querySelectorAll("[data-cart-qty-dec]").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemId = button.dataset.cartQtyDec;
      const container = button.parentElement;
      const current = Number(container.querySelector("span")?.textContent || 0);
      if (current <= 1) {
        await removeCartItemWithConfirm(itemId);
      } else {
        await customerCart.updateQuantity(itemId, current - 1);
        await renderCartPage();
      }
    });
  });

  layoutState.main.querySelectorAll("[data-cart-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemId = button.dataset.cartRemove;
      await removeCartItemWithConfirm(itemId);
    });
  });

  layoutState.main.querySelector("[data-cart-remove-selected]")?.addEventListener("click", async (event) => {
    if (event.currentTarget.disabled) return;
    await removeSelectedCartItemsWithConfirm();
  });
  layoutState.main.querySelector("[data-cart-select-all]")?.addEventListener("change", async (event) => {
    await customerCart.selectAll(Boolean(event.target.checked));
    await renderCartPage();
  });

  layoutState.main.querySelectorAll("[data-cart-select-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const itemId = checkbox.dataset.cartSelectItem;
      await customerCart.selectItem(itemId, Boolean(event.target.checked));
      await renderCartPage();
    });
  });

  layoutState.main.querySelector("[data-cart-voucher-apply]")?.addEventListener("click", async () => {
    const input = layoutState.main.querySelector("[data-cart-voucher-input]");
    const code = String(input?.value || "").trim().toUpperCase();
    const subtotal = getSelectedCartSubtotal();

    if (!code) {
      layoutState.cartVoucher = { code: "", discountAmount: 0, status: "idle", message: "Nhập mã giảm giá để nhận ưu đãi" };
      await renderCartPage();
      return;
    }

    try {
      const response = await customerApi("/vouchers/validate", {
        method: "POST",
        auth: false,
        body: { code, orderTotal: subtotal }
      });
      const result = response.data || {};
      layoutState.cartVoucher = {
        code: result.code || code,
        discountAmount: Number(result.discountAmount || 0),
        status: "success",
        message: `Áp dụng thành công! Giá̉m ${formatCurrency(result.discountAmount || 0)}.`
      };
      notifySuccess(layoutState.cartVoucher.message);
    } catch (error) {
      layoutState.cartVoucher = { code, discountAmount: 0, status: "error", message: getVoucherErrorMessage(error) };
      notifyError(layoutState.cartVoucher.message);
    }

    await renderCartPage();
  });

  layoutState.main.querySelector("[data-cart-voucher-input]")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      layoutState.main.querySelector("[data-cart-voucher-apply]")?.click();
    }
  });

  layoutState.main.querySelector("[data-cart-checkout]")?.addEventListener("click", async () => {
    const selectedCount = Array.isArray(layoutState.cart?.items) ? layoutState.cart.items.filter((item) => item.isSelected).length : 0;
    if (!selectedCount) {
      notifyError("Vui lòng chọn ít nhất một sản phẩm để thanh toán.");
      return;
    }
    clearBuyNowCheckout();
    if (!customerAuth.isAuthenticated()) {
      savePendingCheckout({
        action: "CART_CHECKOUT",
        sourceRoute: "#cart",
        returnRoute: "#checkout"
      });
      layoutState.pendingRoute = "checkout";
      notifySuccess("Vui lòng đăng nhập để tiếp tục thanh toán. Giỏ hàng của bạn đã được giữ lại.");
      navigateToRoute("login");
      return;
    }
    navigateToRoute('checkout');
  });
}

function getSelectedCartSubtotal() {
  if (!Array.isArray(layoutState.cart?.items)) {
    return 0;
  }

  return layoutState.cart.items.reduce((sum, item) => sum + (item.isSelected ? Number(item.totalPrice || 0) : 0), 0);
}

function getCartVoucherSummary(subtotal) {
  const code = String(layoutState.cartVoucher.code || "").trim().toUpperCase();

  if (!code) {
    return { code, discountAmount: 0, status: "idle", message: "Nhập mã giảm giá để nhận ưu đãi" };
  }

  if (layoutState.cartVoucher.status === "success") {
    return {
      code,
      discountAmount: Math.min(Number(layoutState.cartVoucher.discountAmount || 0), Number(subtotal || 0)),
      status: "success",
      message: layoutState.cartVoucher.message || "Áp dụng mã giảm giá thành công."
    };
  }

  return {
    code,
    discountAmount: 0,
    status: layoutState.cartVoucher.status || "idle",
    message: layoutState.cartVoucher.message || "Bấm áp dụng để kiểm tra mã giảm giá."
  };
}

function getVoucherErrorMessage(error) {
  const code = error?.code || "";
  if (code === "VOUCHER_NOT_FOUND") return "Mã giảm giá không tồn tại.";
  if (code === "VOUCHER_NOT_ACTIVE") return "Mã giảm giá đang tạm tắt.";
  if (code === "VOUCHER_EXPIRED") return "Mã giảm giá đã hết hạn.";
  if (code === "VOUCHER_USAGE_LIMIT_EXCEEDED") return "Mã giảm giá đã hết lượt dùng.";
  if (code === "VOUCHER_MIN_ORDER_NOT_MET") return "Đơn hàng chưa đạt giá trị tối thiểu.";
  return error?.message || "Mã không hợp lệ hoặc chưa đủ điều kiện.";
}

async function removeCartItemWithConfirm(itemId) {
  const item = Array.isArray(layoutState.cart?.items) ? layoutState.cart.items.find((entry) => String(entry.id) === String(itemId)) : null;
  const itemName = item?.productName || "sản phẩm này";

  showCartConfirmModal({
    title: "Xóa sản phẩm",
    message: `Bạn có chắc muốn xóa ${itemName} khỏi giỏ hàng?`,
    onConfirm: async () => {
      await customerCart.removeItem(itemId);
      await renderCartPage();
      notifySuccess("Đã xóa sản phẩm khỏi giỏ hàng.");
    }
  });
}


async function removeSelectedCartItemsWithConfirm() {
  const selectedItems = Array.isArray(layoutState.cart?.items) ? layoutState.cart.items.filter((item) => item.isSelected) : [];

  if (!selectedItems.length) {
    notifyError("Vui l\u00f2ng ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t s\u1ea3n ph\u1ea9m \u0111\u1ec3 x\u00f3a.");
    return;
  }

  const count = selectedItems.length;
  showCartConfirmModal({
    title: "X\u00f3a s\u1ea3n ph\u1ea9m \u0111\u00e3 ch\u1ecdn?",
    message: count === 1
      ? "B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a s\u1ea3n ph\u1ea9m \u0111\u00e3 ch\u1ecdn kh\u1ecfi gi\u1ecf h\u00e0ng?"
      : `B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a ${count} s\u1ea3n ph\u1ea9m \u0111\u00e3 ch\u1ecdn kh\u1ecfi gi\u1ecf h\u00e0ng?`,
    confirmLabel: count === 1 ? "X\u00f3a s\u1ea3n ph\u1ea9m" : `X\u00f3a ${count} s\u1ea3n ph\u1ea9m`,
    loadingLabel: "\u0110ang x\u00f3a...",
    onConfirm: async () => {
      const nextCart = await customerCart.removeItems(selectedItems.map((item) => item.id));
      layoutState.cart = nextCart;
      await renderCartPage();
      notifySuccess(count === 1 ? "\u0110\u00e3 x\u00f3a 1 s\u1ea3n ph\u1ea9m kh\u1ecfi gi\u1ecf h\u00e0ng." : `\u0110\u00e3 x\u00f3a ${count} s\u1ea3n ph\u1ea9m kh\u1ecfi gi\u1ecf h\u00e0ng.`);
    }
  });
}

function showCartConfirmModal({ title, message, confirmLabel = "X\u00f3a", loadingLabel = "\u0110ang x\u00f3a...", onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "customer-cart-modal-backdrop";
  overlay.innerHTML = `
    <div class="customer-cart-modal">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="customer-cart-modal-actions">
        <button class="customer-button secondary" type="button" data-cart-modal-cancel>Hủy</button>
        <button class="customer-button" type="button" data-cart-modal-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let modalBusy = false;
  overlay.querySelector("[data-cart-modal-cancel]")?.addEventListener("click", () => { if (!modalBusy) overlay.remove(); });
  const confirmButton = overlay.querySelector("[data-cart-modal-confirm]");
  const cancelButton = overlay.querySelector("[data-cart-modal-cancel]");

  confirmButton?.addEventListener("click", async () => {
    if (confirmButton.disabled) return;
    modalBusy = true;
    confirmButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;
    confirmButton.textContent = loadingLabel;
    try {
      await onConfirm?.();
      overlay.remove();
    } catch (error) {
      modalBusy = false;
      confirmButton.disabled = false;
      if (cancelButton) cancelButton.disabled = false;
      confirmButton.textContent = confirmLabel;
      notifyError(error?.message || "Kh\u00f4ng th\u1ec3 x\u00f3a s\u1ea3n ph\u1ea9m kh\u1ecfi gi\u1ecf h\u00e0ng.");
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && !modalBusy) {
      overlay.remove();
    }
  });
}

function renderCheckoutSkeleton() {
  return `
    <div class="customer-checkout-shell">
      <div class="customer-checkout-steps">
        ${[1, 2, 3, 4].map((step) => `
          <div class="customer-checkout-step ${step === 2 ? "is-active" : ""}">
            <span>${step}</span>
            <div><strong>${step === 1 ? "Giỏ hàng" : step === 2 ? "Thông tin" : step === 3 ? "Thanh toán" : "Hoàn tất"}</strong></div>
          </div>
        `).join("")}
      </div>
      <div class="customer-checkout-layout">
        <div class="customer-checkout-form-card">
          <div class="skeleton-line" style="width:220px;height:18px;margin-bottom:16px;"></div>
          <div class="skeleton-line" style="width:100%;height:44px;margin-bottom:14px;"></div>
          <div class="skeleton-line" style="width:100%;height:44px;margin-bottom:14px;"></div>
          <div class="skeleton-line" style="width:100%;height:44px;"></div>
        </div>
        <div class="customer-checkout-summary-card">
          <div class="skeleton-line" style="width:70%;height:18px;margin-bottom:16px;"></div>
          <div class="skeleton-line" style="width:100%;height:60px;margin-bottom:12px;"></div>
          <div class="skeleton-line" style="width:100%;height:12px;margin-bottom:8px;"></div>
          <div class="skeleton-line" style="width:100%;height:12px;margin-bottom:8px;"></div>
          <div class="skeleton-line" style="width:100%;height:46px;"></div>
        </div>
      </div>
    </div>
  `;
}

function renderCheckoutEmptyState() {
  return `
    <div class="customer-cart-empty-state">
      <div class="customer-cart-empty-icon"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i></div>
      <h2>Giỏ hàng của bạn đang trống</h2>
      <p>Vui lòng quay lại sau khi thêm sản phẩm để đặt hàng.</p>
      <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
    </div>
  `;
}

function calculateCheckoutTotals(subtotalIncludingVat = 0, discountAmount = 0) {
  const selectedSubtotal = Math.max(Math.round(Number(subtotalIncludingVat || 0)), 0);
  const normalizedDiscount = Math.min(Math.max(Math.round(Number(discountAmount || 0)), 0), selectedSubtotal);
  const eligibleAmount = Math.max(selectedSubtotal - normalizedDiscount, 0);
  const vatAmount = Math.round(eligibleAmount - eligibleAmount / 1.1);
  const shippingFee = eligibleAmount > 0 && eligibleAmount >= 500000 ? 0 : eligibleAmount > 0 ? 30000 : 0;
  const grandTotal = eligibleAmount + shippingFee;
  const freeShippingRemaining = eligibleAmount > 0 && eligibleAmount < 500000 ? 500000 - eligibleAmount : 0;

  return { eligibleAmount, shippingFee, vatAmount, grandTotal, freeShippingRemaining };
}

function getCheckoutSummary(items, voucherCode = "") {
  const selectedItems = Array.isArray(items) ? items.filter((item) => item.isSelected) : [];
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const voucherSummary = getCartVoucherSummary(selectedSubtotal);
  const discountAmount = Math.min(Number(voucherSummary.discountAmount || 0), selectedSubtotal);
    const { eligibleAmount, shippingFee, vatAmount, grandTotal, freeShippingRemaining } = calculateCheckoutTotals(selectedSubtotal, discountAmount);

  return {
    items: selectedItems,
    selectedSubtotal,
    discountAmount,
    eligibleAmount,
    shippingFee,
    vatAmount,
    grandTotal,
    freeShippingRemaining,
    voucherSummary
  };
}

function getPaymentGuideOrderId(paymentGuide = {}, payment = {}) {
  return payment?.orderId || payment?.order_id || paymentGuide?.orderId || paymentGuide?.order_id || "";
}

function getPaymentGuideStatus(payment = {}, guide = {}) {
  const reported = Boolean(payment?.customerReportedPaymentAt || guide?.customerReportedPaymentAt || guide?.customer_reported_payment_at);
  const status = String(payment?.transactionStatus || guide?.status || payment?.paymentStatus || "pending").toLowerCase();
  return reported || status === "processing" ? "processing" : status;
}

function getPaymentStatusLabel(status = "pending") {
  const value = String(status || "pending").toLowerCase();
  if (value === "paid" || value === "success") return "Đã thanh toán";
  if (value === "processing" || value === "customer_reported") return "Đang chờ xác nhận";
  if (value === "failed") return "Thanh toán thất bại";
  if (value === "cancelled") return "Đã hủy";
  if (value === "expired") return "Đã hết hạn";
  return "Chờ thanh toán";
}

function isCreditCardPaymentMethod(paymentMethod) {
  return normalizePaymentMethodValue(paymentMethod) === "credit_card";
}

function canChangePaymentMethod(payment = {}, guide = {}) {
  const status = getPaymentGuideStatus(payment, guide);
  const paid = String(payment?.paymentStatus || "").toLowerCase() === "paid" || String(payment?.actualTransactionStatus || payment?.transactionStatus || "").toLowerCase() === "paid";
  return !paid && !payment?.customerReportedPaymentAt && !guide?.customerReportedPaymentAt && status !== "processing";
}

function showCheckoutSuccessModal(orderCode, paymentMethod = "cod", paymentGuide = null, payment = null) {
  return openOrderSuccessModal({ orderCode, paymentMethod, paymentGuide, payment });
}

function openOrderSuccessModal({ order = null, orderCode = "", paymentMethod = "cod", paymentGuide = null, payment = null } = {}) {
  closeOrderSuccessModal({ clearTimer: true });

  const guide = paymentGuide || {};
  const isCreditCardDemo = isCreditCardPaymentMethod(paymentMethod);
  const isCodPayment = normalizePaymentMethodValue(paymentMethod) === "cod";
  const orderId = getOrderSuccessOrderId(order, guide, payment);
  const displayOrderCode = orderCode || order?.orderCode || order?.order_code || order?.id || "DON HANG";
  const isPersonalMomo = isMomoPersonalGuide(paymentMethod, guide);
  const isPersonalBank = isBankPersonalGuide(paymentMethod, guide);
  const isReportablePayment = isCustomerReportableGuide(paymentMethod, guide);
  const canSaveQr = isPersonalMomo || isPersonalBank;
  const paymentTransactionId = payment?.id || payment?.paymentTransactionId || guide?.paymentTransactionId || guide?.payment_transaction_id || guide?.transaction_id || "";
  const statusLabel = isCreditCardDemo ? "Ch\u01b0a thanh to\u00e1n - Ch\u1ebf \u0111\u1ed9 m\u00f4 ph\u1ecfng" : getPaymentStatusLabel(getPaymentGuideStatus(payment, guide));
  const saveFilename = isPersonalBank ? `NL-Store-Bank-QR-${orderSafeCode(displayOrderCode)}.png` : isPersonalMomo ? `NL-Store-MoMo-${orderSafeCode(displayOrderCode)}.png` : `NL-Store-QR-${orderSafeCode(displayOrderCode)}.png`;
  const personalActions = isCreditCardDemo
    ? `<button class="customer-button secondary" type="button" data-payment-status-check="${escapeHtml(paymentTransactionId)}">Ki&#7875;m tra tr&#7841;ng th&#225;i</button>`
    : isReportablePayment
    ? `<button class="customer-button" type="button" data-report-payment="${escapeHtml(paymentTransactionId)}">${isPersonalBank ? "T&#244;i &#273;&#227; chuy&#7875;n kho&#7843;n" : "T&#244;i &#273;&#227; thanh to&#225;n"}</button>`
    : `<button class="customer-button secondary" type="button" data-payment-status-check="${escapeHtml(paymentTransactionId)}">Ki&#7875;m tra tr&#7841;ng th&#225;i</button>${guide?.deeplink ? `<a class="customer-button secondary" href="${escapeHtml(guide.deeplink)}">M&#7903; MoMo</a>` : ""}${(guide?.payUrl || guide?.pay_url) ? `<a class="customer-button" href="${escapeHtml((guide.payUrl || guide.pay_url))}">Thanh to&#225;n tr&#234;n MoMo</a>` : ""}`;

  const overlay = document.createElement("div");
  overlay.className = "customer-checkout-modal-backdrop";
  overlay.dataset.orderSuccessModal = "true";
  overlay.innerHTML = `
    <div class="customer-checkout-modal customer-payment-result-modal" role="dialog" aria-modal="true">
      <button class="customer-payment-modal-close" type="button" aria-label="&#272;&#243;ng c&#7917;a s&#7893; thanh to&#225;n" data-payment-modal-close>&times;</button>
      <div class="customer-checkout-modal-icon"><i class="fa-solid ${isCreditCardDemo ? "fa-credit-card" : "fa-check"}" aria-hidden="true"></i></div>
      <h3>${isCodPayment ? "&#272;&#7863;t h&#224;ng th&#224;nh c&#244;ng - Thanh to&#225;n khi nh&#7853;n h&#224;ng" : "&#272;&#7863;t h&#224;ng th&#224;nh c&#244;ng - Vui l&#242;ng ho&#224;n t&#7845;t thanh to&#225;n"}</h3>
      <p>M&#227; &#273;&#417;n h&#224;ng c&#7911;a b&#7841;n l&#224; <strong>${escapeHtml(displayOrderCode || "")}</strong>.</p>
      ${isCodPayment ? "" : `<p>${escapeHtml(getPaymentMethodLabel(paymentMethod))} - ${escapeHtml(statusLabel)}</p>`}
      ${renderPaymentGuideModal(paymentMethod, guide, { payment, orderCode: displayOrderCode })}
      <div class="customer-checkout-modal-actions">
        ${canSaveQr ? `<button class="customer-button secondary" type="button" data-save-payment-qr="${escapeHtml(displayOrderCode || "ORDER")}" data-payment-qr-filename="${escapeHtml(saveFilename)}">L&#432;u m&#227; QR</button>` : ""}
        ${personalActions}
        <button class="customer-button secondary" type="button" data-order-success-view="${escapeHtml(orderId || "")}">Xem &#273;&#417;n h&#224;ng</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("modal-open", "customer-modal-open", "customer-checkout-modal-open");
  document.body.style.overflow = "hidden";

  layoutState.orderSuccessModal.root = overlay;
  layoutState.orderSuccessModal.orderId = orderId || "";
  layoutState.orderSuccessModal.hasRedirected = false;

  bindPaymentGuideActions(overlay);
  bindOrderSuccessModalEvents(overlay);
  scheduleOrderSuccessAutoClose();
  return overlay;
}

function getOrderSuccessOrderId(order = null, guide = {}, payment = null) {
  return String(order?.id || order?.orderId || order?.order_id || getPaymentGuideOrderId(guide, payment) || "").trim();
}

function closeOrderSuccessModal({ clearTimer = true } = {}) {
  const state = layoutState.orderSuccessModal || {};
  if (clearTimer) clearOrderSuccessAutoClose();
  if (state.keydownHandler) {
    document.removeEventListener("keydown", state.keydownHandler);
  }
  clearCreditCardDemoData(state.root || document);
  stopPaymentPolling();
  document.querySelectorAll(".customer-checkout-modal-backdrop[data-order-success-modal]").forEach((node) => node.remove());
  document.body.classList.remove("modal-open", "customer-modal-open", "customer-checkout-modal-open");
  document.body.style.overflow = "";
  layoutState.orderSuccessModal = { root: null, autoCloseTimer: null, keydownHandler: null, orderId: "", hasRedirected: state.hasRedirected || false };
}

function scheduleOrderSuccessAutoClose() {
  clearOrderSuccessAutoClose();
  layoutState.orderSuccessModal.autoCloseTimer = window.setTimeout(() => {
    redirectToOrders();
  }, 3000);
}

function clearOrderSuccessAutoClose() {
  const timer = layoutState.orderSuccessModal?.autoCloseTimer;
  if (timer) window.clearTimeout(timer);
  if (layoutState.orderSuccessModal) layoutState.orderSuccessModal.autoCloseTimer = null;
}

function bindOrderSuccessModalEvents(root) {
  const close = () => redirectToOrders();
  root.querySelector("[data-payment-modal-close]")?.addEventListener("click", close);
  root.querySelector("[data-order-success-view]")?.addEventListener("click", close);
  const onKeydown = (event) => {
    if (event.key === "Escape" && document.body.contains(root)) close();
    if (!document.body.contains(root)) document.removeEventListener("keydown", onKeydown);
  };
  layoutState.orderSuccessModal.keydownHandler = onKeydown;
  document.addEventListener("keydown", onKeydown);
  root.addEventListener("click", (event) => {
    if (event.target === root) close();
  });
}

function redirectToOrders() {
  if (layoutState.orderSuccessModal?.hasRedirected) return;
  layoutState.orderSuccessModal.hasRedirected = true;

  clearOrderSuccessAutoClose();
  closeOrderSuccessModal({ clearTimer: false });

  const currentHashPath = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
  if (currentHashPath === "orders" || currentRoute === "orders") {
    renderOrdersPage();
    return;
  }
  navigateToRoute("orders");
}

function navigateToOrderDetailAfterSuccess(orderId = "") {
  const cleanOrderId = String(orderId || "").trim();
  if (!cleanOrderId) {
    navigateToRoute("orders");
    return;
  }
  const targetRoute = `orders/${encodeURIComponent(cleanOrderId)}`;
  const currentHashPath = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
  if (currentHashPath === targetRoute || currentRoute === targetRoute) {
    document.querySelector(".customer-order-detail-shell")?.scrollIntoView({ block: "start" });
    return;
  }
  navigateToRoute(targetRoute);
}

function renderPaymentGuideModal(paymentMethod, guide = null, context = {}) {
  const method = normalizePaymentMethodValue(paymentMethod);
  if (!guide || method === "cod") {
    return `<div class="customer-payment-guide-note is-cod-note">Đơn hàng sẽ được xử lý sau khi cửa hàng xác nhận thông tin.</div>`;
  }

  if (method === "bank_transfer") {
    const orderCode = guide.orderCode || guide.order_code || context.orderCode || "";
    const transferContent = guide.transferContent || guide.transfer_content || `NL ${orderSafeCode(orderCode)}`;
    const statusLabel = getPaymentStatusLabel(getPaymentGuideStatus(context.payment || {}, guide));
    return `
      <section class="customer-payment-guide is-bank is-bank-personal">
        <div class="customer-payment-bank-layout">
          <div class="customer-payment-qr-panel is-bank-qr">
            ${guide.qrCodeUrl ? `<img class="customer-payment-qr" data-payment-qr-image src="${escapeHtml(guide.qrCodeUrl)}" alt="QR chuyển khoản ngân hàng">` : ""}
          </div>
          <div class="customer-payment-recipient-card is-bank-info">
            <div class="customer-payment-recipient-head">
              <span>Thông tin chuyển khoản</span>
              <strong>${escapeHtml(statusLabel)}</strong>
            </div>
            <div class="customer-payment-recipient-list">
              ${paymentGuideRow("Ngân hàng", guide.bank?.bankName || "MB Bank")}
              ${paymentGuideRow("Chủ tài khoản", guide.bank?.accountName || "LÊ HOÀNG LÊN")}
              ${paymentGuideRow("Số tài khoản", guide.bank?.accountNumber || "02024443125")}
              ${paymentGuideRow("Số tiền", formatCurrency(guide.amount), "is-highlight")}
              ${paymentGuideRow("Nội dung", transferContent, "is-highlight")}
              ${paymentGuideRow("Trạng thái", statusLabel)}
            </div>
            <p class="customer-payment-guide-note">Vui lòng chuyển đúng số tiền và nội dung NL + mã đơn. Đơn hàng chỉ được xác nhận sau khi cửa hàng kiểm tra giao dịch.</p>
            <div class="customer-payment-copy-row is-compact is-payment-copy-grid">
              <button type="button" data-copy-payment="${escapeHtml(guide.bank?.accountNumber || "02024443125")}">Sao chép số tài khoản</button>
              <button type="button" data-copy-payment="${escapeHtml(String(Math.round(Number(guide.amount || 0))))}">Sao chép số tiền</button>
              <button type="button" data-copy-payment="${escapeHtml(transferContent)}">Sao chép nội dung</button>
            </div>
          </div>
        </div>
      </section>`;
  }

  if (method === "momo") {
    const isPersonal = isMomoPersonalGuide(method, guide);
    const paymentUrl = guide.payUrl || guide.pay_url || guide.deeplink || "";
    const orderCode = guide.orderCode || guide.order_code || context.orderCode || "";
    const transferContent = guide.transferContent || guide.transfer_content || `NL ${orderSafeCode(orderCode)}`;
    const statusLabel = getPaymentStatusLabel(getPaymentGuideStatus(context.payment || {}, guide));
    if (isPersonal) {
      return `
        <section class="customer-payment-guide is-momo is-momo-personal">
          <div class="customer-payment-momo-layout">
            <div class="customer-payment-qr-panel is-momo-qr">
              ${renderPaymentQrMarkup(guide, paymentUrl)}
            </div>
            <div class="customer-payment-recipient-card">
              <div class="customer-payment-recipient-head">
                <span>Thông tin nhận tiền</span>
                <strong>${escapeHtml(statusLabel)}</strong>
              </div>
              <div class="customer-payment-recipient-list">
                ${paymentGuideRow("Tên chủ tài khoản", guide.accountName || "LÊ HOÀNG LÊN")}
                ${paymentGuideRow("Số điện thoại MoMo", guide.phone || "0793244405")}
                ${paymentGuideRow("Loại tài khoản", "MoMo")}
                ${paymentGuideRow("Mã đơn hàng", orderCode || "-")}
                ${paymentGuideRow("Số tiền", formatCurrency(guide.amount), "is-highlight")}
                ${paymentGuideRow("Nội dung chuyển tiền", transferContent, "is-highlight")}
                ${paymentGuideRow("Trạng thái", statusLabel)}
              </div>
              <div class="customer-payment-copy-row is-compact is-momo-copy is-payment-copy-grid">
                <button type="button" data-copy-payment="0793244405">Sao chép số điện thoại</button>
                <button type="button" data-copy-payment="${escapeHtml(String(Math.round(Number(guide.amount || 0))))}">Sao chép số tiền</button>
                <button type="button" data-copy-payment="${escapeHtml(transferContent)}">Sao chép nội dung</button>
              </div>
            </div>
          </div>
          <p class="customer-payment-guide-note">Vui lòng chuyển đúng số tiền và nội dung NL + mã đơn. Đơn hàng chỉ được xác nhận sau khi cửa hàng kiểm tra giao dịch.</p>
        </section>`;
    }
    return `
      <section class="customer-payment-guide is-momo">
        <div class="customer-payment-status-pill"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${escapeHtml(statusLabel)}</div>
        ${renderPaymentQrMarkup(guide, paymentUrl)}
        <div class="customer-payment-guide-grid">
          ${paymentGuideRow("Số tiền", formatCurrency(guide.amount))}
          ${paymentGuideRow("Nội dung", transferContent)}
          ${paymentGuideRow("Trạng thái", statusLabel)}
        </div>
        ${paymentUrl ? `<a class="customer-button" href="${escapeHtml(paymentUrl)}" data-hosted-payment-url>Thanh toán qua MoMo</a>` : `<div class="customer-payment-unavailable">${escapeHtml(guide.message || "Không thể tạo phiên thanh toán MoMo.")}</div>`}
      </section>`;
  }
  if (method === "credit_card") {
    return `
      <section class="customer-payment-guide is-card is-credit-card-demo" data-credit-card-demo data-card-mode="${CREDIT_CARD_PAYMENT_MODE.DEMO}">
        <div class="customer-payment-recipient-head">
          <span>Thanh toán thẻ tín dụng</span>
          <strong>MÔ PHỎNG – KHÔNG PHÁT SINH GIAO DỊCH THẬT</strong>
        </div>
        <div class="customer-payment-card-brands"><span>Thẻ tín dụng</span><span>3D Secure</span></div>
        <p class="customer-payment-guide-note">Không nhập thông tin thẻ ngân hàng thật. Dữ liệu chỉ được dùng để mô phỏng giao diện và không được gửi đến máy chủ.</p>
        <form class="customer-card-demo-form" data-credit-card-demo-form autocomplete="off" novalidate>
          <label>Tên chủ thẻ<input name="cardholder" type="text" autocomplete="off" maxlength="80" placeholder="NGUYEN VAN A"></label>
          <label>Số thẻ<input name="cardNumber" type="text" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="4111 1111 1111 1111" data-card-number-demo></label>
          <div class="customer-card-demo-row">
            <label>Ngày hết hạn MM/YY<input name="expiry" type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="MM/YY" data-card-expiry-demo></label>
            <label>CVV<span class="customer-card-cvv-field"><input name="cvv" type="password" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="•••" data-card-cvv-demo><button type="button" data-toggle-card-cvv aria-label="Hiện hoặc ẩn CVV"><i class="fa-regular fa-eye" aria-hidden="true"></i></button></span></label>
          </div>
          <label class="customer-card-demo-confirm"><input name="confirmDemo" type="checkbox"> <span>Tôi xác nhận đang sử dụng dữ liệu thẻ thử nghiệm.</span></label>
          <div class="customer-card-demo-message" data-card-demo-message aria-live="polite"></div>
          <button class="customer-button" type="submit">Xác nhận thanh toán thẻ</button>
        </form>
      </section>`;
  }

  return "";
}

function renderPaymentQrMarkup(guide = {}, fallbackUrl = "") {
  const raw = String(guide.qrCodeUrl || guide.qr_code_content || guide.qrImage || guide.qr_image || guide.qrData || fallbackUrl || "").trim();
  if (!raw) return "";
  if (isImageQrSource(raw)) {
    return '<img class="customer-payment-qr" data-payment-qr-image src="' + escapeHtml(normalizeQrImageSource(raw)) + '" alt="QR thanh toán">';
  }
  return '<canvas class="customer-payment-qr" width="220" height="220" data-payment-qr-canvas data-payment-qr-text="' + escapeHtml(raw) + '" aria-label="QR thanh toán"></canvas>';
}

function isImageQrSource(value = "") {
  return /^(data:image\/|blob:|https?:\/\/|\.?\/?assets\/|\/assets\/)/i.test(value) || /^[A-Za-z0-9+/=]{120,}$/.test(value);
}

function normalizeQrImageSource(value = "") {
  if (/^[A-Za-z0-9+/=]{120,}$/.test(value) && !/^data:/i.test(value)) {
    return "data:image/png;base64," + value;
  }
  return value;
}

function renderDeferredPaymentQr(root) {
  root.querySelectorAll("[data-payment-qr-canvas]").forEach((canvas) => {
    const value = canvas.dataset.paymentQrText || "";
    if (!value) return;
    if (window.QRCode?.toCanvas) {
      window.QRCode.toCanvas(canvas, value, { width: 220, margin: 2 }, () => {});
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QR thanh toán", canvas.width / 2, 106);
    ctx.fillText("Không tải được thư viện QR", canvas.width / 2, 126);
  });
}
function paymentGuideRow(label, value, className = "") {
  return `<div class="customer-payment-guide-row ${escapeHtml(className)}"><span>${label}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function ensurePaymentPollingState() {
  if (!layoutState.paymentPolling) {
    layoutState.paymentPolling = { timer: null, transactionId: null, inFlight: false };
  }
  return layoutState.paymentPolling;
}

function stopPaymentPolling() {
  const polling = ensurePaymentPollingState();
  if (polling.timer) {
    window.clearInterval(polling.timer);
  }
  polling.timer = null;
  polling.transactionId = null;
  polling.inFlight = false;
}

function startPaymentPolling(transactionId, onUpdate) {
  stopPaymentPolling();
  if (!transactionId) return;
  const polling = ensurePaymentPollingState();
  polling.transactionId = transactionId;
  const tick = async () => {
    const current = ensurePaymentPollingState();
    if (current.inFlight || current.transactionId !== transactionId) return;
    current.inFlight = true;
    try {
      const response = await customerApi(`/payments/transactions/${encodeURIComponent(transactionId)}/status`);
      const payment = response?.data?.payment || null;
      onUpdate?.(payment);
      const status = String(payment?.actualTransactionStatus || payment?.transactionStatus || payment?.paymentStatus || "").toLowerCase();
      if (["paid", "success", "failed", "cancelled", "expired", "refunded"].includes(status)) {
        stopPaymentPolling();
        if (status === "paid" || status === "success") notifySuccess("Thanh toán đã được xác nhận.");
      }
    } catch (error) {
      console.debug("[payment-polling] status check failed", error?.message);
    } finally {
      const latest = ensurePaymentPollingState();
      if (latest.transactionId === transactionId) latest.inFlight = false;
    }
  };
  tick();
  polling.timer = window.setInterval(tick, 5000);
}
async function savePaymentQr(root, orderCode = "ORDER", filenameOverride = "") {
  const qr = root?.querySelector?.("[data-payment-qr-image], canvas") || document.querySelector("[data-payment-qr-image], canvas");
  if (!qr) {
    notifyError("Chưa có mã QR để lưu.");
    return;
  }
  const filename = filenameOverride || `NL-Store-QR-${orderSafeCode(orderCode)}.png`;
  let href = "";
  if (qr instanceof HTMLCanvasElement) {
    href = qr.toDataURL("image/png");
  } else if (qr.src) {
    href = await imageToPngDataUrl(qr);
  }
  if (!href) {
    notifyError("Không thể lưu mã QR.");
    return;
  }
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  notifySuccess("Đã lưu mã QR");
}


async function imageToPngDataUrl(image) {
  if (!image?.src) return "";
  if (image.src.startsWith("data:image/png")) return image.src;
  const canvas = document.createElement("canvas");
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = image.src;
  }).catch(() => null);
  if (!img.naturalWidth) return image.src;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")?.drawImage(img, 0, 0);
  try { return canvas.toDataURL("image/png"); } catch { return image.src; }
}

function closePaymentOverlay(root, orderId = "") {
  clearCreditCardDemoData(root);
  stopPaymentPolling();
  root?.remove?.();
  if (orderId) {
    window.location.hash = `#orders/${encodeURIComponent(orderId)}`;
  } else if (!String(window.location.hash || "").startsWith("#orders")) {
    window.location.hash = "#orders";
  }
}

function bindPaymentModalClose(root, orderId = "") {
  const close = () => closePaymentOverlay(root, orderId);
  root.querySelector("[data-payment-modal-close]")?.addEventListener("click", close);
  const onKeydown = (event) => {
    if (event.key === "Escape" && document.body.contains(root)) close();
    if (!document.body.contains(root)) document.removeEventListener("keydown", onKeydown);
  };
  document.addEventListener("keydown", onKeydown);
  root.addEventListener("click", (event) => {
    if (event.target === root) close();
  });
}

function clearCreditCardDemoData(root = document) {
  root?.querySelectorAll?.('[data-credit-card-demo-form] input').forEach((input) => {
    if (input.type === 'checkbox') input.checked = false;
    else input.value = '';
    if (input.name === 'cvv') input.type = 'password';
  });
  root?.querySelectorAll?.('[data-card-demo-message]').forEach((message) => {
    message.textContent = '';
    delete message.dataset.state;
  });
  root?.querySelectorAll?.('[data-toggle-card-cvv] i').forEach((icon) => {
    icon.classList.remove('fa-eye-slash');
  });
}

function getCardDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function passesLuhnCheck(digits = '') {
  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return digits.length > 0 && sum % 10 === 0;
}

function validateCreditCardDemoForm(form) {
  const cardholder = String(form.cardholder?.value || '').trim();
  let cardNumber = getCardDigits(form.cardNumber?.value || '');
  let expiry = String(form.expiry?.value || '').trim();
  let cvv = getCardDigits(form.cvv?.value || '');

  if (!cardholder) return 'Vui lòng nhập tên chủ thẻ thử nghiệm.';
  if (!/^\d{13,19}$/.test(cardNumber)) return 'Số thẻ thử nghiệm phải gồm 13–19 chữ số.';
  if (!passesLuhnCheck(cardNumber)) return 'Số thẻ thử nghiệm không đúng định dạng kiểm tra.';
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'Ngày hết hạn phải có định dạng MM/YY.';
  const [monthText, yearText] = expiry.split('/');
  const month = Number(monthText);
  const year = 2000 + Number(yearText);
  if (month < 1 || month > 12) return 'Tháng hết hạn phải từ 01 đến 12.';
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const expiryMonthStart = new Date(year, month - 1, 1).getTime();
  if (expiryMonthStart < currentMonthStart) return 'Ngày hết hạn không được nhỏ hơn tháng hiện tại.';
  if (!/^\d{3,4}$/.test(cvv)) return 'CVV thử nghiệm phải gồm 3–4 chữ số.';
  if (!form.confirmDemo?.checked) return 'Vui lòng xác nhận bạn đang sử dụng dữ liệu thẻ thử nghiệm.';

  cardNumber = '';
  expiry = '';
  cvv = '';
  return '';
}

function bindCreditCardDemoForm(root) {
  const form = root?.querySelector?.('[data-credit-card-demo-form]');
  if (!form) return;
  const message = form.querySelector('[data-card-demo-message]');
  const setMessage = (text, type = 'error') => {
    if (!message) return;
    message.textContent = text;
    message.dataset.state = type;
  };

  form.cardNumber?.addEventListener('input', () => {
    const digits = getCardDigits(form.cardNumber.value).slice(0, 19);
    form.cardNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
  });

  form.expiry?.addEventListener('input', () => {
    const digits = getCardDigits(form.expiry.value).slice(0, 4);
    form.expiry.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  });

  form.cvv?.addEventListener('input', () => {
    form.cvv.value = getCardDigits(form.cvv.value).slice(0, 4);
  });

  form.querySelector('[data-toggle-card-cvv]')?.addEventListener('click', (event) => {
    const input = form.cvv;
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.querySelector('i')?.classList.toggle('fa-eye-slash', input.type === 'text');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const error = validateCreditCardDemoForm(form);
    if (error) {
      setMessage(error, 'error');
      return;
    }
    clearCreditCardDemoData(root);
    setMessage('Đã hoàn tất mô phỏng nhập thông tin thẻ. Chưa có giao dịch thanh toán thật được thực hiện.', 'success');
    notifySuccess('Đã hoàn tất mô phỏng nhập thông tin thẻ. Chưa có giao dịch thanh toán thật được thực hiện.');
  });
}
function normalizePaymentActionError(error) {
  const message = String(error?.message || "").trim();
  if (!message || /Payment status is invalid/i.test(message)) return "Không thể ghi nhận báo thanh toán. Vui lòng thử lại.";
  return message;
}

function bindPaymentGuideActions(root) {
  if (!root) return;
  renderDeferredPaymentQr(root);
  bindCreditCardDemoForm(root);
  const transactionId = root.querySelector("[data-payment-status-check]")?.dataset.paymentStatusCheck || "";
  if (transactionId) startPaymentPolling(transactionId);
  root.querySelector("[data-save-payment-qr]")?.addEventListener("click", (event) => savePaymentQr(root, event.currentTarget.dataset.savePaymentQr || "ORDER", event.currentTarget.dataset.paymentQrFilename || ""));
  root.querySelector("[data-report-payment]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const id = button.dataset.reportPayment || "";
    if (!id || button.disabled) return;
    button.disabled = true;
    try {
      await customerApi(`/payments/transactions/${encodeURIComponent(id)}/customer-report`, { method: "POST" });
      notifySuccess("Đã ghi nhận thanh toán – đang chờ cửa hàng xác nhận.");
      button.textContent = "Đang chờ xác nhận";
    } catch (error) {
      button.disabled = false;
      notifyError(normalizePaymentActionError(error));
    }
  });
  root.querySelector("[data-payment-status-check]")?.addEventListener("click", async (event) => {
    const id = event.currentTarget.dataset.paymentStatusCheck || "";
    const shouldCloseSuccessModal = root?.dataset?.orderSuccessModal === "true";
    if (shouldCloseSuccessModal) closeOrderSuccessModal({ clearTimer: true });
    if (!id) return;
    const response = await customerApi(`/payments/transactions/${encodeURIComponent(id)}/status`);
    const payment = response?.data?.payment || {};
    const status = getPaymentStatusLabel(getPaymentGuideStatus(payment, payment.paymentGuide || {}));
    notifySuccess(`Trạng thái thanh toán: ${status}`);
  });
  root.querySelectorAll("[data-copy-payment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copyPayment || "";
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const originalText = button.dataset.originalText || button.textContent;
        button.dataset.originalText = originalText;
        button.textContent = "Đã sao chép";
        window.setTimeout(() => { button.textContent = button.dataset.originalText || originalText; }, 1200);
        notifySuccess("Đã sao chép");
      } catch {
        notifyError("Không thể sao chép tự động.");
      }
    });
  });
}

window.addEventListener("hashchange", () => {
  closeOrderSuccessModal({ clearTimer: true });
  clearCreditCardDemoData(document);
  stopPaymentPolling();
});
window.addEventListener("beforeunload", stopPaymentPolling);

function isMomoPersonalGuide(paymentMethod, guide = {}) {
  return normalizePaymentMethodValue(paymentMethod) === "momo" && String(guide?.provider || guide?.paymentProvider || "").toUpperCase() === "MOMO_PERSONAL_QR";
}

function isBankPersonalGuide(paymentMethod, guide = {}) {
  return normalizePaymentMethodValue(paymentMethod) === "bank_transfer" && String(guide?.provider || guide?.paymentProvider || "").toUpperCase() === "BANK_PERSONAL_QR";
}

function isCustomerReportableGuide(paymentMethod, guide = {}) {
  return isMomoPersonalGuide(paymentMethod, guide) || isBankPersonalGuide(paymentMethod, guide);
}
function orderSafeCode(value) {
  return String(value || "ORDER").replace(/[^a-zA-Z0-9]/g, "").slice(-18).toUpperCase();
}

function validateCheckoutForm(form) {
  const errors = {};
  const formData = new FormData(form);
  const customerName = String(formData.get("customerName") || "").trim();
  const customerEmail = String(formData.get("customerEmail") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const line1 = String(formData.get("line1") || "").trim();
  const provinceCode = String(formData.get("provinceCode") || "").trim();
  const wardCode = String(formData.get("wardCode") || "").trim();
  const paymentMethod = String(formData.get("paymentMethod") || "cod");

  if (!customerName) {
    errors.customerName = "Vui lòng nhập họ tên người nhận.";
  }

  if (!customerPhone) {
    errors.customerPhone = "Vui lòng nhập số điện thoại.";
  } else if (!/^[0-9]{9,11}$/.test(customerPhone.replace(/\D/g, ''))) {
    errors.customerPhone = "Số điện thoại không hợp lệ.";
  }

  if (!customerEmail) {
    errors.customerEmail = "Vui lòng nhập email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    errors.customerEmail = "Email không đúng định dạng.";
  }

  if (!line1) {
    errors.line1 = "Vui lòng nhập địa chỉ chi tiết.";
  }

  if (!provinceCode) {
    errors.provinceCode = "Vui lòng chọn tỉnh/thành phố.";
  }

  if (!wardCode) {
    errors.wardCode = "Vui lòng chọn phường/xã/thị trấn.";
  }

  if (!paymentMethod) {
    errors.paymentMethod = "Vui lòng chọn phương thức thanh toán.";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}


function bindCheckoutVoucherEvents(container, checkoutSummary) {
  const applyButton = container.querySelector("[data-checkout-voucher-apply]");
  const input = container.querySelector("[data-checkout-voucher-input]");
  const removeButton = container.querySelector("[data-checkout-voucher-remove]");

  applyButton?.addEventListener("click", async () => {
    if (applyButton.disabled) return;
    const code = String(input?.value || "").trim().toUpperCase();

    if (!code) {
      layoutState.cartVoucher = { code: "", discountAmount: 0, status: "error", message: "Vui l\u00f2ng nh\u1eadp m\u00e3 gi\u1ea3m gi\u00e1." };
      await renderCheckoutPage();
      return;
    }

    applyButton.disabled = true;
    applyButton.textContent = "\u0110ang ki\u1ec3m tra...";

    try {
      const response = await customerApi("/vouchers/validate", {
        method: "POST",
        auth: false,
        body: { code, orderTotal: Number(checkoutSummary.selectedSubtotal || 0) }
      });
      const result = response.data || {};
      layoutState.cartVoucher = {
        code: result.code || code,
        discountAmount: Number(result.discountAmount || 0),
        status: "success",
        message: `\u00c1p d\u1ee5ng th\u00e0nh c\u00f4ng! Gi\u1ea3m ${formatCurrency(result.discountAmount || 0)}.`
      };
      notifySuccess(layoutState.cartVoucher.message);
    } catch (error) {
      layoutState.cartVoucher = { code, discountAmount: 0, status: "error", message: getVoucherErrorMessage(error) };
      notifyError(layoutState.cartVoucher.message);
    }

    await renderCheckoutPage();
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyButton?.click();
    }
  });

  removeButton?.addEventListener("click", async () => {
    layoutState.cartVoucher = { code: "", discountAmount: 0, status: "idle", message: "" };
    await renderCheckoutPage();
  });
}
function renderCheckoutFieldErrors(form) {
  form.querySelectorAll("[data-field-error]").forEach((element) => {
    element.textContent = "";
  });

  const errors = form.dataset.checkoutErrors ? JSON.parse(form.dataset.checkoutErrors) : {};
  Object.entries(errors).forEach(([field, message]) => {
    const node = form.querySelector(`[data-field-error="${field}"]`);
    if (node) {
      node.textContent = message;
    }
  });
}

async function renderCheckoutPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Thanh toán", `<div class="customer-cart-empty-state"><div class="customer-cart-empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để tiếp tục thanh toán.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  layoutState.main.innerHTML = renderPageShell("Thanh toán", renderCheckoutSkeleton());

  try {
    const buyNowCheckout = readBuyNowCheckout();
    const isBuyNow = buyNowCheckout?.mode === "buy_now" && buyNowCheckout.items.length > 0;
    let buyNowItems = buyNowCheckout?.items || [];
    let items;
    if (isBuyNow) {
      const originalItem = buyNowCheckout.items[0] || {};
      const productId = originalItem.product_id ?? originalItem.productId;
      try {
        const validatedItem = await createValidatedBuyNowItemFromPending({
          ...createPendingCheckoutFromBuyNowItem(originalItem),
          productId,
          variantId: originalItem.variant_id ?? originalItem.variantId,
          quantity: originalItem.quantity,
          sourceRoute: productId ? `#product-detail/${encodeURIComponent(productId)}` : "#home"
        });
        const oldPrice = Number(originalItem.unit_price ?? originalItem.sale_price ?? originalItem.price ?? 0);
        if (oldPrice && Number(validatedItem.unit_price || 0) !== oldPrice) {
          notifySuccess("Giá sản phẩm đã được cập nhật theo dữ liệu mới nhất.");
        }
        buyNowItems = [validatedItem];
        sessionStorage.setItem(BUY_NOW_CHECKOUT_KEY, JSON.stringify({ mode: "buy_now", items: buyNowItems, created_at: Date.now() }));
        items = buyNowItems.map(mapBuyNowItemForCheckout);
      } catch (error) {
        clearBuyNowCheckout();
        notifyError(error?.message || "Phiên mua hàng trước đó không còn hợp lệ. Vui lòng chọn lại màu sắc và kích thước.");
        navigateToRoute(productId ? `product-detail/${encodeURIComponent(productId)}` : "home");
        return;
      }
    } else {
      const cart = await customerCart.load();
      layoutState.cart = cart;
      items = Array.isArray(cart?.items) ? cart.items : [];
    }
    const checkoutSummary = getCheckoutSummary(items, layoutState.cartVoucher.code);
    checkoutSummary.checkoutMode = isBuyNow ? "buy_now" : "cart";
    checkoutSummary.buyNowItems = isBuyNow ? buyNowItems : [];

    if (!checkoutSummary.items.length) {
      layoutState.main.innerHTML = renderPageShell("Thanh toán", renderCheckoutEmptyState());
      return;
    }

    const user = customerAuth.getUser();

    layoutState.main.innerHTML = renderPageShell("Thanh toán", `
      <div class="customer-checkout-shell">
        <header class="customer-checkout-hero">
          <div class="customer-checkout-hero-top">
            <div>
              <span class="customer-checkout-eyebrow"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Thanh toán an toàn</span>
              <h1>Thanh toán</h1>
              <p>Kiểm tra thông tin giao hàng và chọn phương thức thanh toán phù hợp.</p>
            </div>
            <div class="customer-checkout-secure-badge"><i class="fa-solid fa-lock" aria-hidden="true"></i><span><strong>Bảo mật thông tin</strong><small>Dữ liệu được bảo vệ</small></span></div>
          </div>
          <div class="customer-checkout-steps" aria-label="Tiến trình thanh toán">
            <div class="customer-checkout-step is-complete"><span><i class="fa-solid fa-check" aria-hidden="true"></i></span><div><strong>Giỏ hàng</strong><small>Đã kiểm tra</small></div></div>
            <div class="customer-checkout-step is-active" aria-current="step"><span>2</span><div><strong>Thông tin giao hàng</strong><small>Điền thông tin nhận hàng</small></div></div>
            <div class="customer-checkout-step"><span>3</span><div><strong>Thanh toán</strong><small>Chọn phương thức</small></div></div>
            <div class="customer-checkout-step"><span>4</span><div><strong>Hoàn tất</strong><small>Xác nhận đơn hàng</small></div></div>
          </div>
        </header>

        <div class="customer-checkout-layout">
          <div class="customer-checkout-form-card">
            <div class="customer-checkout-section-title">Thông tin giao hàng</div>
            <form data-checkout-form class="customer-checkout-form" novalidate>
              <div class="customer-checkout-grid">
                <label class="customer-checkout-field">
                  <span>Họ tên người nhận</span>
                  <input type="text" name="customerName" placeholder="Nguyễn Văn A" value="${escapeHtml(user?.fullName || "")}">
                  <small data-field-error="customerName"></small>
                </label>
                <label class="customer-checkout-field">
                  <span>Số điện thoại</span>
                  <input type="tel" name="customerPhone" placeholder="0901234567">
                  <small data-field-error="customerPhone"></small>
                </label>
              </div>
              <div class="customer-checkout-grid">
                <label class="customer-checkout-field">
                  <span>Email</span>
                  <input type="email" name="customerEmail" placeholder="ví dụ: ban@duongdan.com" value="${escapeHtml(user?.email || "")}">
                  <small data-field-error="customerEmail"></small>
                </label>
                <label class="customer-checkout-field">
                  <span>Địa chỉ chi tiết</span>
                  <input type="text" name="line1" placeholder="123 Nguyễn Huệ, hẻm 1" data-map-trigger>
                  <small data-field-error="line1"></small>
                </label>
              </div>
              <div class="customer-checkout-grid">
                <label class="customer-checkout-field">
                  <span>Tỉnh / Thành phố</span>
                  <select name="provinceCode" data-province-select required>
                    <option value="">Chọn tỉnh/thành</option>
                  </select>
                  <small data-field-error="provinceCode"></small>
                </label>
                <label class="customer-checkout-field">
                  <span>Phường / Xã</span>
                  <input type="search" name="wardSearch" data-ward-search placeholder="Tìm phường/xã..." autocomplete="off">
                  <select name="wardCode" data-ward-select required disabled>
                    <option value="">Chọn phường/xã/thị trấn</option>
                  </select>
                  <small data-field-error="wardCode"></small>
                </label>
              </div>
              <label class="customer-checkout-field">
                <span>Ghi chú đơn hàng</span>
                <textarea name="note" rows="3" placeholder="Giao hàng vào buổi chiều, gọi trước khi đến"></textarea>
              </label>

              <div class="customer-checkout-map-section">
                <div class="customer-checkout-section-title">Vị trí trên bản đồ</div>
                <iframe class="customer-checkout-map" data-checkout-map width="100%" height="280" style="border:0;border-radius:12px;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=Vi%E1%BB%87t%20Nam&output=embed"></iframe>
              </div>

              <div class="customer-checkout-section-title">Phương thức thanh toán</div>
              <div class="customer-payment-options">
                ${SUPPORTED_CHECKOUT_PAYMENT_METHODS.map((method, index) => {
                  const normalizedMethod = normalizePaymentMethodValue(method.code);
                  const config = CHECKOUT_PAYMENT_ICON_MAP[normalizedMethod] || CHECKOUT_PAYMENT_ICON_MAP.cod;
                  return `<label class="customer-payment-card ${index === 0 ? "is-active" : ""}">
                    <input type="radio" name="paymentMethod" value="${escapeHtml(method.code)}" ${index === 0 ? "checked" : ""}>
                    <span class="customer-payment-icon" aria-hidden="true"><i class="fa-solid ${config.icon}"></i></span>
                    <div>
                      <strong>${escapeHtml(method.label)}</strong>
                      <p>${escapeHtml(getCheckoutPaymentDescription(normalizedMethod))}</p>
                    </div>
                  </label>`;
                }).join("")}
              </div>
              ${renderCheckoutPaymentDetails(checkoutSummary)}
            </form>
          </div>

          <aside class="customer-checkout-summary-card">
            <div class="customer-checkout-summary-header">
              <h2>Tóm tắt đơn hàng</h2>
              <span class="customer-checkout-summary-badge">${checkoutSummary.items.length} sản phẩm</span>
            </div>
            <div class="customer-checkout-items">
              ${checkoutSummary.items.map((item) => `
                <div class="customer-checkout-item">
                  <img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveProductImageUrl(item.productImageUrl))}" alt="${escapeHtml(item.productName || "Sản phẩm")}" loading="lazy" decoding="async" data-product-image>
                  <div class="customer-checkout-item-details">
                    <strong>${escapeHtml(item.productName || "Sản phẩm")}</strong>
                    <div class="customer-checkout-item-meta">
                      ${item.size ? `<span>Size ${escapeHtml(item.size)}</span>` : ""}
                      ${item.color ? `<span>${escapeHtml(item.color)}</span>` : ""}
                      <span>x${Number(item.quantity || 0)}</span>
                    </div>
                  </div>
                  <div class="customer-checkout-item-price">${formatCurrency(Number(item.totalPrice || 0))}</div>
                </div>
              `).join("")}
            </div>
            ${renderCheckoutVoucherSection(checkoutSummary)}
            <div class="customer-checkout-summary-lines">
              <div><span>Tạm tính</span><strong>${formatCurrency(checkoutSummary.selectedSubtotal)}</strong></div>
              <div><span>Giảm giá</span><strong>${formatCurrency(checkoutSummary.discountAmount)}</strong></div>
              <div><span>Thu&#7871; VAT (10%)</span><strong>&#272;&#227; g&#7891;m ${formatCurrency(checkoutSummary.vatAmount)}</strong></div>
              <div><span>Phí vận chuyển</span><strong>${formatShippingFee(checkoutSummary.shippingFee)}</strong></div>
              ${checkoutSummary.freeShippingRemaining > 0 ? `<div class="customer-checkout-free-shipping-hint"><span>Mua thêm ${formatCurrency(checkoutSummary.freeShippingRemaining)} để được miễn phí vận chuyển</span></div>` : ""}
            </div>
            <div class="customer-checkout-total">
              <span>Tổng thanh toán</span>
              <strong>${formatCurrency(checkoutSummary.grandTotal)}</strong>
            </div>
            <button class="customer-button customer-checkout-submit" type="submit" data-checkout-submit form="checkout-form" disabled>Đặt hàng và thanh toán</button>
          </aside>
        </div>
      </div>
    `);

    initCheckoutForm(layoutState.main, checkoutSummary);
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Thanh toán", `
      <div class="customer-cart-empty-state">
        <div class="customer-cart-empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
        <h2>Không thể tải checkout</h2>
        <p>${escapeHtml(error?.message || "Đã xảy ra lỗi khi tải dữ liệu checkout.")}</p>
        <button class="customer-button" type="button" data-checkout-retry>Thử lại</button>
      </div>
    `);
    layoutState.main.querySelector("[data-checkout-retry]")?.addEventListener("click", () => {
      renderCheckoutPage();
    });
  }
}

function renderCheckoutPaymentDetails(summary) {
  const total = formatCurrency(summary?.grandTotal || 0);
  return `
    <div class="customer-payment-detail-panels" data-payment-detail-panels>
      <section class="customer-payment-detail-panel is-active" data-payment-detail="cod">
        <p>Thanh to&aacute;n khi nh&aacute;n h&agrave;ng. Cua hang se xac nhan don truoc khi giao.</p>
      </section>
      <section class="customer-payment-detail-panel" data-payment-detail="bank_transfer" hidden>
        <div class="customer-payment-detail-head"><strong>Chuyen khoan ngan hang bang QR</strong><span>15 phut</span></div>
        <div class="customer-payment-preview-grid">
          <div class="customer-payment-qr-placeholder"><i class="fa-solid fa-qrcode" aria-hidden="true"></i><span>QR se duoc tao sau khi dat hang</span></div>
          <div class="customer-payment-preview-copy">
            <p><span>So tien</span><strong>${total}</strong></p>
            <p><span>Noi dung goi y</span><strong>NL + ma don hang</strong></p>
            <small>Khong danh dau da thanh toan chi vi ban bam da chuyen khoan.</small>
          </div>
        </div>
      </section>
      <section class="customer-payment-detail-panel" data-payment-detail="credit_card" hidden>
        <div class="customer-payment-detail-head"><strong>Thẻ tín dụng</strong><span>Đang hoàn thiện</span></div>
        <div class="customer-card-hosted-shell" aria-disabled="true">
          <div class="customer-payment-card-brands"><span>Thẻ tín dụng</span><span>3D Secure</span></div>
          <div class="customer-hosted-field is-disabled">So the - truong bao mat cua provider</div>
          <div class="customer-hosted-field-row"><div class="customer-hosted-field is-disabled">Ngay het han</div><div class="customer-hosted-field is-disabled">Ma bao mat</div></div>
          <button type="button" disabled>Thanh toan ${total}</button>
          <small>Thanh toan the dang duoc hoan thien. N&L Store khong thu thap so the, CVC, PIN hoac OTP.</small>
        </div>
      </section>
      <section class="customer-payment-detail-panel" data-payment-detail="momo" hidden>
        <div class="customer-payment-detail-head"><strong>MoMo QR</strong><span>Sandbox</span></div>
        <div class="customer-payment-preview-grid">
          <div class="customer-payment-qr-placeholder is-momo"><i class="fa-solid fa-wallet" aria-hidden="true"></i><span>Ma QR se hien sau khi don hang duoc tao thanh cong</span></div>
          <ol><li>Mo ung dung MoMo Test</li><li>Quet ma QR Sandbox</li><li>Kiem tra so tien</li><li>Xac nhan thanh toan</li></ol>
        </div>
      </section>
    </div>`;
}


function renderCheckoutVoucherSection(checkoutSummary) {
  const voucherSummary = checkoutSummary?.voucherSummary || getCartVoucherSummary(checkoutSummary?.selectedSubtotal || 0);
  const isApplied = voucherSummary.status === "success" && voucherSummary.code;
  const messageClass = voucherSummary.status === "success" ? "is-success" : voucherSummary.status === "error" ? "is-error" : "";

  return `
    <div class="customer-cart-voucher customer-checkout-voucher" data-checkout-voucher>
      <div class="customer-cart-voucher-title">M&#227; gi&#7843;m gi&#225;</div>
      ${isApplied ? `
        <div class="customer-checkout-voucher-applied">
          <strong>[${escapeHtml(voucherSummary.code)}]</strong>
          <span>&#272;&#227; &#225;p d&#7909;ng</span>
          <button type="button" aria-label="G&#7905; m&#227; gi&#7843;m gi&#225;" data-checkout-voucher-remove>&times;</button>
        </div>
      ` : `
        <div class="customer-cart-voucher-input-row">
          <input type="text" name="checkoutVoucher" value="${escapeHtml(layoutState.cartVoucher.code || "")}" placeholder="Nh&#7853;p m&#227; gi&#7843;m gi&#225;" data-checkout-voucher-input>
          <button class="customer-button secondary customer-cart-voucher-button" type="button" data-checkout-voucher-apply>&#193;p d&#7909;ng</button>
        </div>
      `}
      <div class="customer-cart-voucher-message ${messageClass}" data-checkout-voucher-message>${escapeHtml(voucherSummary.message || "Nh\u1eadp m\u00e3 \u0111\u1ec3 nh\u1eadn \u01b0u \u0111\u00e3i")}</div>
    </div>
  `;
}
function initCheckoutForm(container, checkoutSummary) {
  const form = container.querySelector("[data-checkout-form]");
  const submitButton = container.querySelector("[data-checkout-submit]");
  const paymentCards = container.querySelectorAll(".customer-payment-card");
  const provinceSelect = container.querySelector("[data-province-select]");
  const wardSelect = container.querySelector("[data-ward-select]");
  const wardSearchInput = container.querySelector("[data-ward-search]");
  const mapIframe = container.querySelector("[data-checkout-map]");
  const detailAddressInput = container.querySelector("[data-map-trigger]");
  let currentWardList = [];

  function refreshWardOptions(filterText = "") {
    const terms = String(filterText || "").trim().toLowerCase();
    const visibleWards = currentWardList.filter((ward) => {
      if (!terms) return true;
      return ward.name.toLowerCase().includes(terms);
    });

    const options = visibleWards
      .map((ward) => `<option value="${escapeHtml(ward.code)}">${escapeHtml(ward.name)}</option>`)
      .join("");

    wardSelect.innerHTML = `<option value="">Chọn phường/xã/thị trấn</option>${options}`;
    wardSelect.disabled = visibleWards.length === 0;
    wardSearchInput.disabled = currentWardList.length === 0;

    if (!currentWardList.length) {
      wardSearchInput.value = "";
      wardSelect.value = "";
      return;
    }

    if (visibleWards.length === 0) {
      wardSelect.innerHTML = `<option value="">Không tìm thấy phường/xã</option>`;
      wardSelect.value = "";
    }
  }

  function setProvinceWards(provinceCode) {
    currentWardList = getWardsByProvince(provinceCode);
    wardSearchInput.value = "";
    refreshWardOptions();
  }

  loadProvinces(provinceSelect);
  refreshWardOptions();

  // Payment method selection
  const syncPaymentDetails = () => {
    const selected = normalizePaymentMethodValue(form?.querySelector("input[name='paymentMethod']:checked")?.value || "cod");
    container.querySelectorAll("[data-payment-detail]").forEach((panel) => {
      const isActive = panel.dataset.paymentDetail === selected;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });
  };

  paymentCards.forEach((card) => {
    card.addEventListener("click", () => {
      paymentCards.forEach((item) => item.classList.remove("is-active"));
      card.classList.add("is-active");
      const input = card.querySelector("input");
      if (input) input.checked = true;
      syncPaymentDetails();
    });
  });
  syncPaymentDetails();
  bindCheckoutVoucherEvents(container, checkoutSummary);
  // Province selection - update wards and map
  provinceSelect?.addEventListener("change", () => {
    const provinceCode = provinceSelect.value;
    layoutState.checkoutAddress.provinceCode = provinceCode;
    layoutState.checkoutAddress.wardCode = "";
    wardSelect.value = "";

    setProvinceWards(provinceCode);
    updateMapByAddress(mapIframe, layoutState.checkoutAddress.detailAddress, provinceCode, "");
  });

  // Ward selection - update map
  wardSelect?.addEventListener("change", () => {
    layoutState.checkoutAddress.wardCode = wardSelect.value;
    updateMapByAddress(mapIframe, layoutState.checkoutAddress.detailAddress, layoutState.checkoutAddress.provinceCode, layoutState.checkoutAddress.wardCode);
  });

  wardSearchInput?.addEventListener("input", () => {
    refreshWardOptions(wardSearchInput.value);
  });

  // Detail address - update map with debounce
  detailAddressInput?.addEventListener("input", () => {
    layoutState.checkoutAddress.detailAddress = detailAddressInput.value;

    if (layoutState.checkoutAddress.mapUpdateTimer) {
      clearTimeout(layoutState.checkoutAddress.mapUpdateTimer);
    }

    layoutState.checkoutAddress.mapUpdateTimer = setTimeout(() => {
      updateMapByAddress(mapIframe, layoutState.checkoutAddress.detailAddress, layoutState.checkoutAddress.provinceCode, layoutState.checkoutAddress.wardCode);
    }, 500);
  });

  // Form submission
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.orderSubmitted === "true" || form.dataset.isSubmitting === "true") return;
    const validation = validateCheckoutForm(form);

    if (!validation.isValid) {
      form.dataset.checkoutErrors = JSON.stringify(validation.errors);
      renderCheckoutFieldErrors(form);
      notifyError("Vui lòng kiểm tra lại thông tin trước khi đặt hàng.");
      return;
    }

    const formData = new FormData(form);
    const customerName = String(formData.get("customerName") || "").trim();
    const customerEmail = String(formData.get("customerEmail") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const line1 = String(formData.get("line1") || "").trim();
    const provinceCode = String(formData.get("provinceCode") || "").trim();
    const wardCode = String(formData.get("wardCode") || "").trim();
    const note = String(formData.get("note") || "").trim();
    const paymentMethod = String(formData.get("paymentMethod") || "cod");

    if (!checkoutSummary.items.length) {
      notifyError("Giỏ hàng đang trống.");
      return;
    }

    const province = VIETNAM_ADMINISTRATIVE_2025.find((p) => p.code === provinceCode);
    const ward = province?.wards.find((w) => w.code === wardCode);
    const fullAddress = [line1, ward?.name || "", province?.name || "", "Việt Nam"].filter(Boolean).join(", ").replace(/,\s*,/g, ",").trim();

    form.dataset.isSubmitting = "true";
    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    submitButton.innerHTML = `<span class="customer-button-spinner"></span>Đang xử lý...`;

    try {
      const response = await customerCart.checkout({
        checkoutMode: checkoutSummary.checkoutMode,
        ...(checkoutSummary.checkoutMode === "buy_now" ? { items: checkoutSummary.buyNowItems } : {}),
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress: {
          receiver_name: customerName,
          receiver_phone: customerPhone,
          detail_address: line1,
          province_code: provinceCode,
          province_name: province?.name || "",
          ward_code: wardCode,
          ward_name: ward?.name || "",
          full_address: fullAddress,
          country: "Vietnam"
        },
        paymentMethod,
        voucherCode: checkoutSummary.voucherSummary?.status === "success" ? checkoutSummary.voucherSummary.code : null,
        note
      });
      form.dataset.orderSubmitted = "true";
      if (checkoutSummary.checkoutMode === "buy_now") {
        clearBuyNowCheckout();
      } else {
        layoutState.cart = createEmptyCart();
        renderHeader();
      }
      openOrderSuccessModal({ order: response?.order || null, orderCode: response?.order?.orderCode || response?.order?.id || "DON HANG", paymentMethod, paymentGuide: response?.payment_guide || response?.paymentGuide || null, payment: response?.payment || null });
      notifySuccess("Đặt hàng thành công.");
    } catch (error) {
      notifyError(error?.message || "Đặt hàng thất bại.");
    } finally {
      form.dataset.isSubmitting = "false";
      submitButton.classList.remove("is-loading");
      if (form.dataset.orderSubmitted === "true") {
        submitButton.disabled = true;
        submitButton.textContent = "Đã đặt hàng";
      } else {
        submitButton.disabled = false;
        submitButton.textContent = "Đặt hàng";
      }
    }
  });

  form?.setAttribute("id", "checkout-form");
  submitButton?.addEventListener("click", () => {
    form?.requestSubmit();
  });

  form?.addEventListener("input", () => {
    if (submitButton) {
      submitButton.disabled = false;
    }
  });
}

function isPaymentActionable(status) {
  return ["pending", "unpaid", "processing", "expired", "failed"].includes(String(status || "").toLowerCase());
}

function bindOrderPaymentButtons(root) {
  root.querySelectorAll("[data-order-payment-open]").forEach((button) => {
    button.addEventListener("click", () => openOrderPaymentModal(button.dataset.orderPaymentOpen));
  });
}

async function openOrderPaymentModal(orderId, options = {}) {
  if (!orderId) return;
  let payment;
  try {
    const url = "/orders/my/" + encodeURIComponent(orderId) + (options.retry ? "/payment/retry" : "/payment");
    const response = await customerApi(url, options.retry ? { method: "POST" } : undefined);
    payment = response?.data?.payment || null;
  } catch (error) {
    notifyError(normalizePaymentActionError(error) || "Không thể mở thanh toán cho đơn hàng.");
    return;
  }
  if (!payment) {
    notifyError("Chưa có thông tin thanh toán cho đơn hàng.");
    return;
  }

  const guide = payment.paymentGuide || {};
  const isCreditCardDemo = isCreditCardPaymentMethod(payment.paymentMethod);
  const isPersonalMomo = isMomoPersonalGuide(payment.paymentMethod, guide);
  const isPersonalBank = isBankPersonalGuide(payment.paymentMethod, guide);
  const isReportablePayment = isCustomerReportableGuide(payment.paymentMethod, guide);
  const canSaveQr = isPersonalMomo || isPersonalBank;
  const statusLabel = isCreditCardDemo ? "Chưa thanh toán – Chế độ mô phỏng" : getPaymentStatusLabel(getPaymentGuideStatus(payment, guide));
  const saveFilename = isPersonalBank ? `NL-Store-Bank-QR-${orderSafeCode(payment.orderCode || payment.orderId)}.png` : isPersonalMomo ? `NL-Store-MoMo-${orderSafeCode(payment.orderCode || payment.orderId)}.png` : `NL-Store-QR-${orderSafeCode(payment.orderCode || payment.orderId)}.png`;
  const actionHtml = [
    canSaveQr ? '<button class="customer-button secondary" type="button" data-save-payment-qr="' + escapeHtml(payment.orderCode || payment.orderId || "ORDER") + '" data-payment-qr-filename="' + escapeHtml(saveFilename) + '">Lưu mã QR</button>' : '',
    !isReportablePayment ? '<button class="customer-button secondary" type="button" data-payment-status-check="' + escapeHtml(payment.paymentTransactionId || "") + '">Kiểm tra trạng thái</button>' : '',
    isReportablePayment ? '<button class="customer-button" type="button" data-report-payment="' + escapeHtml(payment.paymentTransactionId || "") + '">' + (isPersonalBank ? "Tôi đã chuyển khoản" : "Tôi đã thanh toán") + '</button>' : '',
    !isCreditCardDemo && !isReportablePayment && payment.canRetry ? '<button class="customer-button secondary" type="button" data-payment-retry-order="' + escapeHtml(payment.orderId || orderId) + '">Tạo lại mã QR</button>' : '',
    !isCreditCardDemo && !isReportablePayment && guide?.deeplink ? '<a class="customer-button secondary" href="' + escapeHtml(guide.deeplink) + '">Mở MoMo</a>' : '',
    !isCreditCardDemo && !isReportablePayment && (guide?.payUrl || guide?.pay_url) ? '<a class="customer-button" href="' + escapeHtml(guide.payUrl || guide.pay_url) + '">Thanh toán trên MoMo</a>' : '',
    '<a class="customer-button secondary" href="#orders/' + encodeURIComponent(payment.orderId || orderId) + '">Xem đơn hàng</a>'
  ].filter(Boolean).join('');

  const overlay = document.createElement("div");
  overlay.className = "customer-checkout-modal-backdrop";
  overlay.innerHTML = '<div class="customer-checkout-modal customer-payment-result-modal" role="dialog" aria-modal="true">'
    + '<button class="customer-payment-modal-close" type="button" aria-label="Đóng cửa sổ thanh toán" data-payment-modal-close>&times;</button>'
    + '<div class="customer-checkout-modal-icon"><i class="fa-solid ' + (isCreditCardDemo ? 'fa-credit-card' : 'fa-qrcode') + '" aria-hidden="true"></i></div>'
    + '<h3>Đơn hàng chưa hoàn tất thanh toán</h3>'
    + '<p>Mã đơn hàng của bạn là <strong>' + escapeHtml(payment.orderCode || payment.orderId || "") + '</strong>.</p>'
    + '<p>' + escapeHtml(getPaymentMethodLabel(payment.paymentMethod)) + ' · ' + escapeHtml(statusLabel) + '</p>'
    + renderPaymentGuideModal(payment.paymentMethod, guide, { payment, orderCode: payment.orderCode || payment.orderId || "" })
    + '<div class="customer-checkout-modal-actions">' + actionHtml + '</div>'
    + '</div>';
  document.body.appendChild(overlay);
  bindPaymentGuideActions(overlay);
  bindPaymentModalClose(overlay, payment.orderId || orderId);
  overlay.querySelector("[data-payment-retry-order]")?.addEventListener("click", async (event) => {
    stopPaymentPolling();
    overlay.remove();
    await openOrderPaymentModal(event.currentTarget.dataset.paymentRetryOrder, { retry: true });
  });
}
async function renderOrdersPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Đơn hàng", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem lịch sử đơn hàng.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  layoutState.main.innerHTML = renderPageShell("Đơn hàng", `
    <div class="customer-order-detail-loading" aria-live="polite">
      <div class="customer-order-detail-skeleton"></div>
      <div class="customer-order-detail-skeleton"></div>
      <div class="customer-order-detail-skeleton"></div>
    </div>
  `);

  try {
    const response = await customerApi("/orders/my");
    const orders = Array.isArray(response?.data?.orders) ? response.data.orders : [];

    if (!orders.length) {
      layoutState.main.innerHTML = renderPageShell("Đơn hàng", `
        <div class="customer-empty-state">
          <div class="customer-empty-icon"><i class="fa-solid fa-receipt" aria-hidden="true"></i></div>
          <h2>Chưa có đơn hàng nào</h2>
          <p>Bạn vẫn chưa đặt đơn nào. Hãy khám phá bộ sưu tập mới hôm nay.</p>
          <div class="customer-order-actions">
            <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
          </div>
        </div>
      `);
      return;
    }

    const orderCards = orders.map((order) => {
      const orderCode = escapeHtml(order.orderCode || order.id || "");
      const status = normalizeOrderStatus(order.status);
      const paymentStatus = normalizePaymentStatus(order.paymentStatus);
      const statusBadge = createStatusBadge(status.label, status.variant);
      const paymentBadge = createStatusBadge(paymentStatus.label, paymentStatus.variant);
      const detailHref = `#orders/${encodeURIComponent(order.id || "")}`;

      return `
        <article class="customer-order-history-card">
          <div class="customer-order-history-card-top">
            <div>
              <p class="customer-order-history-code">${orderCode}</p>
              <p class="customer-order-history-date">${escapeHtml(formatDate(order.createdAt))}</p>
            </div>
            <div class="customer-order-history-badges">
              ${statusBadge}
              ${paymentBadge}
            </div>
          </div>
          <div class="customer-order-history-summary">
            <div>
              <span class="customer-order-history-label">Tổng tiền</span>
              <strong>${formatCurrency(order.grandTotal || order.total || 0)}</strong>
            </div>
            <div>
              <span class="customer-order-history-label">Phương thức</span>
              <strong>${escapeHtml(order.paymentMethod || "—")}</strong>
            </div>
          </div>
          <div class="customer-order-history-actions">
            <a class="customer-button secondary" href="${detailHref}">Xem chi tiết</a>
            <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
          </div>
        </article>
      `;
    }).join("");

    layoutState.main.innerHTML = renderPageShell("Đơn hàng", `
      <div class="customer-order-history-list">
        <div class="customer-order-history-header">
          <div>
            <h2>Lịch sử đơn hàng</h2>
            <p>Theo dõi và quản lý tất cả đơn hàng của bạn.</p>
          </div>
          <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
        </div>
        ${orderCards}
      </div>
    `);
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Đơn hàng", `
      <div class="customer-empty-state">
        <div class="customer-empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
        <h2>Không thể tải đơn hàng</h2>
        <p>${escapeHtml(error?.message || "Đã xảy ra lỗi khi tải lịch sử đơn hàng.")}</p>
        <div class="customer-order-actions">
          <button class="customer-button" type="button" data-order-retry>Thử lại</button>
        </div>
      </div>
    `);
    layoutState.main.querySelector("[data-order-retry]")?.addEventListener("click", () => {
      renderOrdersPage();
    });
  }
}

async function renderOrderDetailPage(orderId) {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem chi tiết đơn hàng.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  if (!orderId) {
    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-receipt" aria-hidden="true"></i></div><h2>Không tìm thấy đơn hàng</h2><p>Vui lòng quay lại danh sách đơn hàng để chọn mã đơn.</p><a class="customer-button secondary" href="#orders">Quay lại đơn hàng</a></div>`);
    return;
  }

  layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `
    <div class="customer-order-detail-loading" aria-live="polite">
      <div class="customer-order-detail-skeleton"></div>
      <div class="customer-order-detail-skeleton"></div>
      <div class="customer-order-detail-skeleton"></div>
    </div>
  `);

  try {
    const response = await customerApi(`/orders/my/${orderId}`);
    const order = response?.data?.order || null;

    if (!order) {
      throw new Error("Không tìm thấy đơn hàng.");
    }

    const status = normalizeOrderStatus(order.status);
    const paymentStatus = normalizePaymentStatus(order.paymentStatus);
    const shippingAddress = order.shippingAddress || {};
    const addressText = formatAddress(shippingAddress);
    const items = Array.isArray(order.items) ? order.items : [];
    const history = Array.isArray(order.history) ? order.history : [];
    const transactions = Array.isArray(order.transactions) ? order.transactions : [];
    const transaction = transactions[0] || null;
    const transactionStatus = transaction ? normalizePaymentTransactionStatus(transaction.status) : null;
    const timelineItems = history.length ? history : [{ status: order.status, note: "Đơn hàng đã được tạo", createdAt: order.createdAt }];
    const canCancel = canCustomerCancelOrder(order);

    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `
      <div class="customer-order-detail-shell">
        <section class="customer-order-detail-hero">
          <div>
            <p class="customer-order-history-label">Mã đơn hàng</p>
            <h2>${escapeHtml(order.orderCode || order.id || "")}</h2>
            <p class="customer-order-detail-subtitle">Đặt lúc ${escapeHtml(formatDate(order.createdAt))}</p>
          </div>
          <div class="customer-order-history-badges">
            ${createStatusBadge(status.label, status.variant)}
            ${createStatusBadge(paymentStatus.label, paymentStatus.variant)}
          </div>
        </section>

        <div class="customer-order-detail-grid">
          <div class="customer-order-detail-main">
            <section class="customer-order-panel">
              <div class="customer-order-actions">
                <a class="customer-button secondary" href="#orders">Quay lại</a>
                <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
                ${canCancel ? `<button class="customer-button secondary" type="button" data-order-cancel="${escapeHtml(order.id || orderId)}">H&#7911;y &#273;&#417;n</button>` : ""}
              </div>
              <div class="customer-order-panel-title">Tiến trình đơn hàng</div>
              <ul class="customer-order-timeline">
                ${timelineItems.map((entry, index) => {
                  const entryStatus = normalizeOrderStatus(entry.status);
                  return `
                    <li class="customer-order-timeline-item ${index === 0 ? "is-active" : ""}">
                      <strong>${escapeHtml(entryStatus.label)}</strong>
                      <div>${escapeHtml(entry.note || "Cập nhật trạng thái đơn hàng")}</div>
                      <small>${escapeHtml(formatDate(entry.createdAt))}</small>
                    </li>
                  `;
                }).join("")}
              </ul>
            </section>

            <section class="customer-order-panel">
              <div class="customer-order-panel-title">Sản phẩm đã đặt</div>
              ${items.length ? items.map((item) => `
                <article class="customer-order-item">
                  <img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveProductImageUrl(item.productImageUrl))}" alt="${escapeHtml(item.productName || "Sản phẩm")}" loading="lazy" decoding="async" data-product-image>
                  <div>
                    <strong>${escapeHtml(item.productName || "Sản phẩm")}</strong>
                    <div class="customer-order-item-meta">
                      <span>SKU ${escapeHtml(item.productSku || "—")}</span>
                      <span>${item.quantity || 0} × ${formatCurrency(item.unitPrice || 0)}</span>
                    </div>
                    <div class="customer-order-item-meta">
                      <span>${formatCurrency(item.totalPrice || 0)}</span>
                    </div>
                  </div>
                </article>
              `).join("") : `<div class="customer-empty-state"><p>Không có sản phẩm nào trong đơn hàng này.</p></div>`}
            </section>
          </div>

          <aside class="customer-order-detail-side">
            <section class="customer-order-panel">
              <div class="customer-order-panel-title">Thông tin giao nhận</div>
              <div class="customer-order-summary-list">
                <div class="customer-order-summary-row"><span>Người nhận</span><strong>${escapeHtml(order.customerName || shippingAddress.fullName || "—")}</strong></div>
                <div class="customer-order-summary-row"><span>Điện thoại</span><strong>${escapeHtml(order.customerPhone || shippingAddress.phone || "—")}</strong></div>
                <div class="customer-order-summary-row"><span>Địa chỉ</span><strong>${escapeHtml(addressText)}</strong></div>
                <div class="customer-order-summary-row"><span>Email</span><strong>${escapeHtml(order.customerEmail || "—")}</strong></div>
              </div>
            </section>

            <section class="customer-order-panel">
              <div class="customer-order-panel-title">Tóm tắt thanh toán</div>
              <div class="customer-order-summary-list">
                <div class="customer-order-summary-row"><span>Tạm tính</span><strong>${formatCurrency(order.subtotal || 0)}</strong></div>
                <div class="customer-order-summary-row"><span>Giảm giá</span><strong>${formatCurrency(order.discountTotal || 0)}</strong></div>
                <div class="customer-order-summary-row"><span>Phí vận chuyển</span><strong>${formatCurrency(order.shippingFee || 0)}</strong></div>
                <div class="customer-order-summary-row"><span>Thu&#7871; VAT (10%)</span><strong>&#272;&#227; g&#7891;m ${formatCurrency(order.taxTotal || 0)}</strong></div>
                <div class="customer-order-summary-row"><span>Phương thức thanh toán</span><strong>${escapeHtml(getPaymentMethodLabel(order.paymentMethod || transaction?.method))}</strong></div>
                <div class="customer-order-summary-row"><span>Trạng thái thanh toán</span><strong>${createStatusBadge(paymentStatus.label, paymentStatus.variant)}</strong></div>
                <div class="customer-order-summary-row customer-order-summary-total"><span>Tổng thanh toán</span><strong>${formatCurrency(order.grandTotal || 0)}</strong></div>
              </div>
            </section>

            <section class="customer-order-panel">
              <div class="customer-order-panel-title">Giao dịch thanh toán</div>
              ${transaction ? `
                <div class="customer-order-summary-list">
                  <div class="customer-order-summary-row"><span>Trạng thái giao dịch</span><strong>${createStatusBadge(transactionStatus.label, transactionStatus.variant)}</strong></div>
                  <div class="customer-order-summary-row"><span>Mã giao dịch</span><strong>${escapeHtml(transaction.transactionCode || "—")}</strong></div>
                  <div class="customer-order-summary-row"><span>Số tiền thanh toán</span><strong>${formatCurrency(transaction.amount || 0)}</strong></div>
                  ${["paid", "success"].includes(String(transaction.status || "").toLowerCase())
                    ? `<div class="customer-order-summary-row"><span>Ngày thanh toán</span><strong>${escapeHtml(formatDate(transaction.paidAt))}</strong></div>`
                    : ""}
                </div>
              ` : '<div class="customer-empty-state"><p>Chưa có giao dịch thanh toán</p></div>'}
            </section>
          </aside>
        </div>
      </div>
    `);
    bindCustomerOrderCancel(layoutState.main, order.id || orderId);
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `
      <div class="customer-empty-state">
        <div class="customer-empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
        <h2>Không thể tải đơn hàng</h2>
        <p>${escapeHtml(error?.message || "Đã xảy ra lỗi khi tải chi tiết đơn hàng.")}</p>
        <div class="customer-order-actions">
          <a class="customer-button secondary" href="#orders">Quay lại đơn hàng</a>
        </div>
      </div>
    `);
  }
}


function canCustomerCancelOrder(order = {}) {
  const orderStatus = String(order.status || "").trim().toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").trim().toLowerCase();
  const paidAmount = Number(order.paidAmount || 0);
  const transactions = Array.isArray(order.transactions) ? order.transactions : [];
  const hasSuccessfulPayment = transactions.some((transaction) => ["paid", "success", "completed", "succeeded"].includes(String(transaction.status || "").trim().toLowerCase()));
  const allowedStatuses = new Set([
    "pending",
    "pending_confirmation",
    "waiting_for_confirmation",
    "awaiting_confirmation",
    "pending_payment",
    "waiting_payment",
    "chờ xác nhận",
    "chờ thanh toán"
  ]);
  const paidStatuses = new Set(["paid", "success", "completed", "succeeded", "thanh toán thành công", "đã thanh toán"]);

  return allowedStatuses.has(orderStatus) && !paidStatuses.has(paymentStatus) && paidAmount <= 0 && !hasSuccessfulPayment;
}

function bindCustomerOrderCancel(root, orderId) {
  const trigger = root?.querySelector("[data-order-cancel]");
  if (!trigger || trigger.dataset.customerCancelBound === "true") return;

  trigger.dataset.customerCancelBound = "true";
  trigger.addEventListener("click", (event) => {
    const id = event.currentTarget.dataset.orderCancel || orderId;
    openCustomerOrderCancelModal(id);
  });
}

function openCustomerOrderCancelModal(orderId) {
  if (!orderId) return;
  closeCustomerOrderCancelModal();
  const overlay = document.createElement("div");
  overlay.className = "customer-checkout-modal-backdrop";
  overlay.dataset.orderCancelModal = "true";
  overlay.innerHTML = `
    <div class="customer-cart-modal" role="dialog" aria-modal="true" aria-labelledby="customer-order-cancel-title">
      <h3 id="customer-order-cancel-title">H&#7911;y &#273;&#417;n h&#224;ng</h3>
      <p>B&#7841;n c&#243; ch&#7855;c mu&#7889;n h&#7911;y &#273;&#417;n h&#224;ng n&#224;y?</p>
      <div class="customer-cart-modal-actions">
        <button class="customer-button secondary" type="button" data-order-cancel-close>Kh&#244;ng</button>
        <button class="customer-button" type="button" data-order-cancel-confirm="${escapeHtml(orderId)}">X&#225;c nh&#7853;n h&#7911;y</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open", "customer-modal-open");
  document.body.style.overflow = "hidden";
  overlay.querySelector("[data-order-cancel-close]")?.addEventListener("click", closeCustomerOrderCancelModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeCustomerOrderCancelModal();
  });

  const confirmButton = overlay.querySelector("[data-order-cancel-confirm]");
  if (!confirmButton || confirmButton.dataset.customerCancelHandlerBound === "true") return;

  confirmButton.dataset.customerCancelHandlerBound = "true";
  confirmButton.addEventListener("click", handleCustomerOrderCancelConfirm);
}

function closeCustomerOrderCancelModal() {
  document.querySelectorAll(".customer-checkout-modal-backdrop[data-order-cancel-modal]").forEach((node) => node.remove());
  document.body.classList.remove("modal-open", "customer-modal-open");
  document.body.style.overflow = "";
}

async function handleCustomerOrderCancelConfirm(event) {
  const button = event.currentTarget;
  const orderId = button.dataset.orderCancelConfirm || "";
  if (!orderId || button.disabled) return;

  button.disabled = true;
  const previousText = button.innerHTML;
  button.innerHTML = `<span class="customer-button-spinner"></span>Đang hủy...`;

  try {
    await customerApi(`/orders/my/${encodeURIComponent(orderId)}/cancel`, {
      method: "PATCH",
      body: { reason: "Customer cancelled order." }
    });
    closeCustomerOrderCancelModal();
    notifySuccess("Hủy đơn hàng thành công");
    await renderOrderDetailPage(orderId);
    document.querySelector(".customer-order-detail-shell")?.scrollIntoView({ block: "start" });
  } catch (error) {
    button.disabled = false;
    button.innerHTML = previousText;
    const status = Number(error?.status || error?.statusCode || 0);
    if (status === 401 || status === 403) {
      notifyError("Bạn không có quyền hủy đơn hàng này.");
      return;
    }
    if (status === 409) {
      notifyError("Đơn hàng đã đổi trạng thái nên không thể hủy.");
      await renderOrderDetailPage(orderId);
      return;
    }
    notifyError(error?.message || "Không thể hủy đơn hàng. Vui lòng thử lại.");
  }
}
async function renderProfilePage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Hồ sơ", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để quản lý hồ sơ của bạn.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  layoutState.main.innerHTML = renderPageShell("Hồ sơ", `<div class="customer-profile-loading">Đang tải hồ sơ...</div>`);

  try {
    const profileResponse = await customerApi("/users/profile");
    const [socialResult, paymentResult] = await Promise.allSettled([
      customerApi("/users/profile/social-connections"),
      customerApi("/users/profile/payment-methods")
    ]);
    const user = profileResponse?.data?.user || customerAuth.getUser() || {};
    const socialState = socialResult.status === "fulfilled"
      ? { ...(socialResult.value?.data || {}), error: "" }
      : { connections: [], error: socialResult.reason?.message || "Không thể tải tài khoản liên kết." };
    const paymentState = paymentResult.status === "fulfilled"
      ? { paymentMethods: paymentResult.value?.data?.paymentMethods || [], error: "" }
      : { paymentMethods: [], error: paymentResult.reason?.message || "Không thể tải phương thức thanh toán." };
    customerAuth.setUser(user);
    layoutState.profilePaymentMethods = paymentState.paymentMethods || [];
    renderHeader();
    layoutState.main.innerHTML = renderPageShell("Hồ sơ", createProfilePageHtml(
      user,
      socialState,
      paymentState
    ));
    bindProfilePage(user);

    if (layoutState.pendingRouteSection === "address") {
      layoutState.pendingRouteSection = "";
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          scrollToCustomerSection("profile-address", true);
        });
      });
    }
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Hồ sơ", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i></div><h2>Không thể tải hồ sơ</h2><p>${escapeHtml(error?.message || "Vui lòng thử lại sau.")}</p></div>`);
    notifyError(error?.message || "Không thể tải hồ sơ.");
  }
}

function createProfilePageHtml(user = {}, social = {}, paymentState = {}) {
  const avatar = user.avatarUrl || user.avatar_url || user.picture || "";
  const name = user.fullName || user.name || "Khách hàng N&L";
  const addressText = formatAddress(user.address || {});
  const connections = Array.isArray(social.connections) ? social.connections : [];
  const connectionMap = new Map(connections.map((connection) => [connection.provider, connection]));
  const paymentMethods = Array.isArray(paymentState) ? paymentState : (paymentState.paymentMethods || []);
  const socialError = social.error || "";
  const paymentError = !Array.isArray(paymentState) ? (paymentState.error || "") : "";
  const hasPassword = getUserHasPassword(user);

  return `
    <div class="customer-profile-shell">
      <section class="customer-profile-hero">
        <div class="customer-profile-avatar">
          ${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" onerror="this.remove();this.parentElement.classList.add('is-fallback');">` : ""}
          <i class="fa-solid fa-user" aria-hidden="true"></i>
        </div>
        <div class="customer-profile-identity">
          <h2>${escapeHtml(name)}</h2>
          <p>${escapeHtml(user.email || "Chưa cập nhật email")}</p>
          <span>${escapeHtml(addressText)}</span>
        </div>
        <div class="customer-profile-actions">
          <button class="customer-button" type="button" data-profile-edit><i class="fa-solid fa-pen" aria-hidden="true"></i> Chỉnh sửa thông tin</button>
          <button class="customer-button secondary" type="button" data-profile-password><i class="fa-solid fa-key" aria-hidden="true"></i> ${hasPassword ? "Đổi mật khẩu" : "Thiết lập mật khẩu"}</button>
          <button class="customer-button secondary" type="button" data-profile-orders><i class="fa-solid fa-box" aria-hidden="true"></i> Xem đơn hàng</button>
        </div>
      </section>

      <div class="customer-profile-grid">
        <section class="customer-profile-card" id="profile-address">
          <h3>Thông tin liên hệ</h3>
          <div class="customer-profile-info">
            ${createProfileInfoRow("Họ tên", name)}
            ${createProfileInfoRow("Email", user.email || "Chưa cập nhật")}
            ${createProfileInfoRow("Số điện thoại", user.phone || "Chưa cập nhật")}
            ${createProfileInfoRow("Địa chỉ", addressText)}
          </div>
        </section>

        <section class="customer-profile-card">
          <h3>Tài khoản liên kết</h3>
          ${socialError ? `<div class="customer-profile-inline-error">${escapeHtml(socialError)} <button type="button" data-profile-retry>Thử lại</button></div>` : ""}
          <div class="customer-profile-list">
            ${["google", "facebook"].map((provider) => createSocialConnectionRow(provider, connectionMap.get(provider))).join("")}
          </div>
        </section>

        <section class="customer-profile-card customer-profile-card-wide">
          <div class="customer-profile-card-title">
            <h3>Phương thức thanh toán</h3>
            <button class="customer-button secondary" type="button" data-payment-add><i class="fa-solid fa-plus" aria-hidden="true"></i> Thêm</button>
          </div>
          <p class="customer-profile-note">Chức năng đang thử nghiệm. N&L Store chỉ lưu thông tin đã che, không lưu PIN, OTP, CVV hoặc token bí mật.</p>
          ${paymentError ? `<div class="customer-profile-inline-error">${escapeHtml(paymentError)} <button type="button" data-profile-retry>Thử lại</button></div>` : ""}
          <div class="customer-profile-payment-list">
            ${paymentMethods.length ? paymentMethods.map(createPaymentMethodRow).join("") : '<div class="customer-profile-muted">Chưa có phương thức thanh toán đã lưu.</div>'}
          </div>
        </section>
      </div>
    </div>
  `;
}

function createProfileInfoRow(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Chưa cập nhật")}</strong></div>`;
}

function createSocialConnectionRow(provider, connection = {}) {
  const label = provider === "google" ? "Google" : "Facebook";
  const linked = Boolean(connection?.linked);
  return `
    <div class="customer-profile-linked-row">
      <div><strong>${label}</strong><span class="customer-profile-link-badge ${linked ? "is-linked" : ""}">${linked ? "Đã liên kết" : "Chưa liên kết"}</span>${connection?.email ? `<small>${escapeHtml(connection.email)}</small>` : ""}</div>
      <button class="customer-button secondary" type="button" data-social-provider="${provider}" data-social-action="${linked ? "unlink" : "link"}">${linked ? "Hủy liên kết" : "Liên kết"}</button>
    </div>
  `;
}

function createPaymentMethodRow(method = {}) {
  const type = method.type === "momo" ? "Ví MoMo" : "Tài khoản ngân hàng";
  return `
    <div class="customer-profile-payment-row">
      <div><strong>${escapeHtml(type)}${method.isDefault ? " - Mặc định" : ""}</strong><span>${escapeHtml(method.providerName || "Nhà cung cấp")} - ${escapeHtml(method.accountHolderName || "")} - ${escapeHtml(method.maskedAccountIdentifier || "")}</span></div>
      <div class="customer-profile-payment-actions">
        <span>${escapeHtml(getPaymentVerificationLabel(method.verificationStatus))}</span>
        ${method.isDefault ? "" : `<button type="button" data-payment-default="${escapeHtml(method.id)}">Đặt mặc định</button>`}
        <button type="button" data-payment-edit="${escapeHtml(method.id)}">Chỉnh sửa</button>
        <button type="button" data-payment-delete="${escapeHtml(method.id)}">Xóa</button>
      </div>
    </div>
  `;
}

function getPaymentVerificationLabel(status) {
  return { verified: "Đã xác minh", pending: "Đang xác minh", failed: "Xác minh thất bại", unverified: "Chưa xác minh" }[String(status || "").toLowerCase()] || "Chưa xác minh";
}

function getUserHasPassword(user = {}) {
  return Boolean(user.has_password ?? user.hasPassword);
}

function createPasswordField(label, name, autocomplete, required = false) {
  return `
    <label class="customer-password-field">${escapeHtml(label)}
      <span class="customer-password-input">
        <input name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" autocapitalize="none" spellcheck="false" ${required ? "required" : ""}>
        <button type="button" data-password-eye="${escapeHtml(name)}" aria-label="Hiện mật khẩu"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
      </span>
    </label>
  `;
}

function bindPasswordTools(root) {
  root.querySelectorAll("[data-password-eye]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = root.querySelector(`[name="${CSS.escape(button.dataset.passwordEye)}"]`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
      button.innerHTML = `<i class="fa-regular ${show ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i>`;
    });
  });

  const password = root.querySelector("[name='newPassword']");
  const confirm = root.querySelector("[name='confirmPassword']");
  const strength = root.querySelector("[data-password-strength]");
  const update = () => {
    if (strength && password) {
      const score = calculatePasswordScore(password.value);
      strength.dataset.level = String(score);
      strength.querySelector("span").textContent = ["Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"][score] || "Rất yếu";
    }
    if (confirm) confirm.setCustomValidity(password && confirm.value && password.value !== confirm.value ? "Xác nhận mật khẩu không khớp." : "");
  };
  password?.addEventListener("input", update);
  confirm?.addEventListener("input", update);
  update();
}

function calculatePasswordScore(value = "") {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.max(0, Math.min(4, score));
}

function normalizeProfilePhone(value) {
  const text = String(value || "").trim();
  return text ? text.replace(/[\s.-]/g, "") : "";
}

function setChangedField(payload, field, nextValue, currentValue) {
  if (String(nextValue ?? "") !== String(currentValue ?? "")) {
    payload[field] = nextValue;
  }
}

function bindProfilePage(user = {}) {
  layoutState.main.querySelector("[data-profile-orders]")?.addEventListener("click", () => navigateToRoute("orders"));
  layoutState.main.querySelectorAll("[data-profile-retry]").forEach((button) => button.addEventListener("click", renderProfilePage));
  layoutState.main.querySelector("[data-profile-edit]")?.addEventListener("click", async () => openProfileEditModal(await fetchFreshProfile(user)));
  layoutState.main.querySelector("[data-profile-password]")?.addEventListener("click", async () => openPasswordModal(await fetchFreshProfile(user)));
  layoutState.main.querySelector("[data-payment-add]")?.addEventListener("click", openPaymentModal);
  layoutState.main.querySelectorAll("[data-social-provider]").forEach((button) => {
    button.addEventListener("click", () => handleSocialAction(button.dataset.socialProvider, button.dataset.socialAction));
  });
  layoutState.main.querySelectorAll("[data-payment-default]").forEach((button) => {
    button.addEventListener("click", () => updatePaymentDefault(button.dataset.paymentDefault));
  });
  layoutState.main.querySelectorAll("[data-payment-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const method = (layoutState.profilePaymentMethods || []).find((item) => String(item.id) === String(button.dataset.paymentEdit));
      openPaymentModal(method);
    });
  });
  layoutState.main.querySelectorAll("[data-payment-delete]").forEach((button) => {
    button.addEventListener("click", () => deletePaymentMethod(button.dataset.paymentDelete));
  });
}

function openProfileEditModal(user = {}) {
  const address = user.address || {};
  const hasPassword = getUserHasPassword(user);
  const modal = createProfileModal("Chỉnh sửa thông tin", `
    <form class="customer-profile-form" data-profile-edit-form>
      <label>Ảnh đại diện<input type="file" name="avatar" accept="image/*"></label>
      <div class="customer-profile-preview">${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="Avatar">` : '<i class="fa-solid fa-user" aria-hidden="true"></i>'}</div>
      <label>Họ tên<input name="fullName" value="${escapeHtml(user.fullName || "")}" required maxlength="120"></label>
      <label>Email<input name="email" type="email" value="${escapeHtml(user.email || "")}" required></label>
      <label>Số điện thoại<input name="phone" value="${escapeHtml(user.phone || "")}"></label>
      <label>Địa chỉ chi tiết<input name="line1" value="${escapeHtml(address.line1 || address.detailAddress || "")}" maxlength="120"></label>
      <div class="customer-profile-form-grid">
        <label>Tỉnh/thành phố<select name="provinceCode" data-profile-province></select></label>
        <label>Phường/xã<select name="wardCode" data-profile-ward></select></label>
      </div>
      ${hasPassword
        ? `${createPasswordField("Mật khẩu hiện tại", "current_password", "current-password", false)}`
        : `<div class="customer-profile-inline-error">Tài khoản này chưa có mật khẩu. Bạn vẫn có thể sửa họ tên, avatar và địa chỉ. Nếu muốn đổi email hoặc số điện thoại, hãy thiết lập mật khẩu trước. <button type="button" data-open-set-password>Thiết lập mật khẩu</button></div>`}
      <div data-auth-message hidden></div>
      <div class="customer-profile-modal-actions">
        <button class="customer-button secondary" type="button" data-modal-close>Hủy</button>
        <button class="customer-button" type="submit">Lưu thay đổi</button>
      </div>
    </form>
  `);
  const form = modal.querySelector("[data-profile-edit-form]");
  bindPasswordTools(form);
  const provinceSelect = form.querySelector("[data-profile-province]");
  const wardSelect = form.querySelector("[data-profile-ward]");
  loadProvinces(provinceSelect);
  provinceSelect.value = address.provinceCode || "";
  loadWardsByProvince(wardSelect, provinceSelect.value);
  wardSelect.value = address.wardCode || "";
  provinceSelect.addEventListener("change", () => loadWardsByProvince(wardSelect, provinceSelect.value));
  modal.querySelector("[data-open-set-password]")?.addEventListener("click", () => {
    closeProfileModal(modal);
    openPasswordModal(user);
  });
  form.avatar.addEventListener("change", () => {
    const file = form.avatar.files?.[0];
    if (file) modal.querySelector(".customer-profile-preview").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Avatar">`;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitProfileEdit(form, user, modal);
  });
}

async function submitProfileEdit(form, currentUser, modal) {
  const data = new FormData(form);
  const province = VIETNAM_ADMINISTRATIVE_2025.find((item) => item.code === String(data.get("provinceCode") || ""));
  const ward = province?.wards.find((item) => item.code === String(data.get("wardCode") || ""));
  const nextAddress = {
    line1: String(data.get("line1") || "").trim(),
    provinceCode: province?.code || null,
    provinceName: province?.name || null,
    province: province?.name || null,
    wardCode: ward?.code || null,
    wardName: ward?.name || null,
    ward: ward?.name || null,
    country: "Vietnam"
  };
  const currentAddress = currentUser.address || {};
  const nextEmail = String(data.get("email") || "").trim().toLowerCase();
  const nextPhone = normalizeProfilePhone(data.get("phone"));
  const currentPhone = normalizeProfilePhone(currentUser.phone);
  const emailChanged = nextEmail !== String(currentUser.email || "").trim().toLowerCase();
  const phoneChanged = nextPhone !== currentPhone;
  const payload = {};

  setChangedField(payload, "fullName", String(data.get("fullName") || "").trim(), currentUser.fullName || "");
  if (emailChanged) payload.email = nextEmail;
  if (phoneChanged) payload.phone = nextPhone;
  if (JSON.stringify(nextAddress) !== JSON.stringify({
    line1: currentAddress.line1 || currentAddress.detailAddress || "",
    provinceCode: currentAddress.provinceCode || null,
    provinceName: currentAddress.provinceName || currentAddress.province || null,
    province: currentAddress.province || currentAddress.provinceName || null,
    wardCode: currentAddress.wardCode || null,
    wardName: currentAddress.wardName || currentAddress.ward || null,
    ward: currentAddress.ward || currentAddress.wardName || null,
    country: currentAddress.country || "Vietnam"
  })) {
    payload.address = nextAddress;
  }

  if ((emailChanged || phoneChanged) && !getUserHasPassword(currentUser)) {
    showCustomerMessage(form, "Vui lòng thiết lập mật khẩu trước khi đổi email hoặc số điện thoại.");
    return;
  }

  const current_password = String(data.get("current_password") || "");
  if (emailChanged || phoneChanged) {
    if (!current_password) {
      showCustomerMessage(form, "Vui lòng nhập mật khẩu hiện tại để đổi email hoặc số điện thoại.");
      return;
    }
    payload.current_password = current_password;
  }

  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    const response = Object.keys(payload).length
      ? await customerApi("/users/profile", { method: "PATCH", body: payload })
      : { data: { user: currentUser } };
    let user = response?.data?.user || currentUser;
    const avatarFile = form.avatar.files?.[0];
    if (avatarFile) {
      const avatarData = new FormData();
      avatarData.append("avatar", avatarFile);
      const avatarResponse = await customerApi("/users/profile/avatar", { method: "POST", body: avatarData });
      user = avatarResponse?.data?.user || user;
    }
    customerAuth.setUser(user);
    closeProfileModal(modal);
    notifySuccess("Đã cập nhật hồ sơ.");
    renderHeader();
    renderProfilePage();
  } catch (error) {
    showCustomerMessage(form, error?.message || "Không thể cập nhật hồ sơ.");
  } finally {
    if (button) button.disabled = false;
  }
}

function openPasswordModal(userOverride = null) {
  const user = userOverride || customerAuth.getUser() || {};
  const hasPassword = getUserHasPassword(user);
  const modal = createProfileModal(hasPassword ? "Đổi mật khẩu" : "Thiết lập mật khẩu", `
    <form class="customer-profile-form" data-password-form>
      ${hasPassword ? createPasswordField("Mật khẩu hiện tại", "current_password", "current-password", true) : `<p class="customer-profile-note">Tạo mật khẩu cho tài khoản Google/Facebook để bảo vệ thay đổi email hoặc số điện thoại về sau.</p>`}
      ${createPasswordField("Mật khẩu mới", "newPassword", "new-password", true)}
      <div class="customer-password-strength" data-password-strength><span></span></div>
      ${createPasswordField("Xác nhận mật khẩu mới", "confirmPassword", "new-password", true)}
      <div data-auth-message hidden></div>
      <div class="customer-profile-modal-actions">
        <button class="customer-button secondary" type="button" data-modal-close>Hủy</button>
        <button class="customer-button" type="submit">Lưu thay đổi</button>
      </div>
    </form>
  `);
  const form = modal.querySelector("[data-password-form]");
  bindPasswordTools(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      const body = {
        newPassword: String(data.get("newPassword") || ""),
        confirmPassword: String(data.get("confirmPassword") || "")
      };
      if (body.newPassword.length < 8) {
        showCustomerMessage(form, "Mật khẩu mới phải có ít nhất 8 ký tự.");
        return;
      }
      if (body.newPassword !== body.confirmPassword) {
        showCustomerMessage(form, "Xác nhận mật khẩu không khớp.");
        return;
      }
      if (hasPassword) body.current_password = String(data.get("current_password") || "");
      const response = await customerApi(hasPassword ? "/users/profile/password" : "/users/profile/set-password", {
        method: hasPassword ? "PUT" : "POST",
        body
      });
      closeProfileModal(modal);
      notifySuccess(hasPassword ? "Đã đổi mật khẩu." : "Đã thiết lập mật khẩu.");
      const latestUser = await refreshCurrentCustomerUser(response?.data?.user);
      customerAuth.setUser({ ...(latestUser || customerAuth.getUser() || {}), hasPassword: true, has_password: true });
      renderHeader();
      await renderProfilePage();
    } catch (error) {
      showCustomerMessage(form, error?.message || (hasPassword ? "Không thể đổi mật khẩu." : "Không thể thiết lập mật khẩu."));
    } finally {
      if (button) button.disabled = false;
    }
  });
}

async function fetchFreshProfile(fallbackUser = {}) {
  try {
    const response = await customerApi("/users/profile");
    const user = response?.data?.user || fallbackUser || {};
    customerAuth.setUser(user);
    renderHeader();
    return user;
  } catch {
    return fallbackUser || customerAuth.getUser() || {};
  }
}

async function refreshCurrentCustomerUser(fallbackUser = null) {
  try {
    const user = await customerAuth.loadCurrentUser();
    if (user) return user;
  } catch {
    // Keep the successful profile response as the source of truth for this save.
  }
  try {
    const response = await customerApi("/users/profile");
    return response?.data?.user || fallbackUser;
  } catch {
    return fallbackUser;
  }
}

function openPaymentModal(method = null) {
  const editing = Boolean(method?.id);
  const selectedType = method?.type || "bank_account";
  const modal = createProfileModal(editing ? "Chỉnh sửa phương thức thanh toán" : "Thêm phương thức thanh toán", `
    <form class="customer-profile-form" data-payment-form>
      <p class="customer-profile-note">Phương thức thanh toán đã lưu - chưa xác minh. N&L Store không lưu PIN, OTP, mật khẩu, CVV hoặc token bí mật.</p>
      <label>Loại phương thức<select name="type" data-payment-type><option value="bank_account">Tài khoản ngân hàng</option><option value="momo">Ví MoMo</option></select></label>
      <div data-payment-fields></div>
      <label class="customer-profile-check"><input name="isDefault" type="checkbox" ${method?.isDefault ? "checked" : ""}> Đặt làm mặc định</label>
      <div data-auth-message hidden></div>
      <div class="customer-profile-modal-actions">
        <button class="customer-button secondary" type="button" data-modal-close>Hủy</button>
        <button class="customer-button" type="submit">Lưu</button>
      </div>
    </form>
  `);
  const form = modal.querySelector("[data-payment-form]");
  const typeSelect = form.querySelector("[data-payment-type]");
  const fieldsRoot = form.querySelector("[data-payment-fields]");
  typeSelect.value = selectedType;
  const renderFields = () => {
    const type = typeSelect.value;
    fieldsRoot.innerHTML = type === "momo"
      ? `<input type="hidden" name="providerName" value="MoMo"><label>Tên chủ ví<input name="accountHolderName" required maxlength="120" value="${escapeHtml(method?.accountHolderName || "")}"></label><label>Số điện thoại MoMo<input name="phone" inputmode="tel" required placeholder="0901234567"></label>`
      : `<label>Tên ngân hàng<select name="providerName" required>${PROFILE_BANKS.map((bank) => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`).join("")}</select></label><label>Tên chủ tài khoản<input name="accountHolderName" required maxlength="120" value="${escapeHtml(method?.accountHolderName || "")}"></label><label>Số tài khoản<input name="accountNumber" inputmode="numeric" required placeholder="Nhập 6-30 chữ số"></label>`;
    if (type !== "momo") fieldsRoot.querySelector("[name='providerName']").value = method?.providerName || PROFILE_BANKS[0];
  };
  renderFields();
  typeSelect.addEventListener("change", renderFields);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const type = String(data.get("type") || "");
    const accountNumber = String(data.get("accountNumber") || "").replace(/\D/g, "");
    const phone = normalizeProfilePhone(data.get("phone"));
    if (type === "momo" && !/^((0|\+84)(3|5|7|8|9)\d{8})$/.test(phone)) {
      showCustomerMessage(form, "Số điện thoại MoMo không hợp lệ.");
      return;
    }
    if (type === "bank_account" && !/^\d{6,30}$/.test(accountNumber)) {
      showCustomerMessage(form, "Số tài khoản ngân hàng phải gồm 6-30 chữ số.");
      return;
    }
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      const response = await customerApi(editing ? `/users/profile/payment-methods/${encodeURIComponent(method.id)}` : "/users/profile/payment-methods", {
        method: editing ? "PUT" : "POST",
        body: {
          type,
          providerName: String(data.get("providerName") || "").trim(),
          accountHolderName: String(data.get("accountHolderName") || "").trim(),
          phone,
          accountNumber,
          isDefault: Boolean(data.get("isDefault"))
        }
      });
      closeProfileModal(modal);
      notifySuccess(response?.message || "Đã lưu phương thức thanh toán.");
      renderProfilePage();
    } catch (error) {
      showCustomerMessage(form, error?.message || "Không thể lưu phương thức thanh toán.");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

async function handleSocialAction(provider, action) {
  try {
    if (action === "unlink") {
      await customerApi(`/users/profile/social-connections/${encodeURIComponent(provider)}`, { method: "DELETE" });
      notifySuccess("Đã hủy liên kết tài khoản.");
      renderProfilePage();
      return;
    }
    const response = await customerApi(`/users/profile/social-connections/${encodeURIComponent(provider)}/link-intent`, { method: "POST" });
    notifyWarning(response?.message || "Chức năng liên kết đang thử nghiệm.");
  } catch (error) {
    notifyError(error?.message || "Không thể cập nhật liên kết.");
  }
}

async function updatePaymentDefault(id) {
  try {
    await customerApi(`/users/profile/payment-methods/${encodeURIComponent(id)}/default`, { method: "PATCH" });
    notifySuccess("Đã cập nhật phương thức mặc định.");
    renderProfilePage();
  } catch (error) {
    notifyError(error?.message || "Không thể cập nhật phương thức mặc định.");
  }
}

async function deletePaymentMethod(id) {
  try {
    await customerApi(`/users/profile/payment-methods/${encodeURIComponent(id)}`, { method: "DELETE" });
    notifySuccess("Đã xóa phương thức thanh toán.");
    renderProfilePage();
  } catch (error) {
    notifyError(error?.message || "Không thể xóa phương thức thanh toán.");
  }
}

function createProfileModal(title, content) {
  const modal = document.createElement("div");
  modal.className = "customer-profile-modal";
  modal.innerHTML = `<div class="customer-profile-modal-backdrop" data-modal-close></div><section class="customer-profile-modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="customer-profile-modal-header"><h3>${escapeHtml(title)}</h3><button type="button" data-modal-close aria-label="Đóng"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>${content}</section>`;
  document.body.append(modal);
  modal.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", () => closeProfileModal(modal)));
  const onKeydown = (event) => {
    if (event.key === "Escape") closeProfileModal(modal);
  };
  modal._profileKeydown = onKeydown;
  document.addEventListener("keydown", onKeydown);
  return modal;
}

function closeProfileModal(modal) {
  if (!modal) return;
  if (modal._profileKeydown) document.removeEventListener("keydown", modal._profileKeydown);
  modal.remove();
}

async function renderWishlistPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Yêu thích", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem danh sách yêu thích của bạn.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  try {
    await refreshWishlist({ throwOnError: true });
  } catch (error) {
    const message = error?.message || "Không thể tải danh sách yêu thích.";
    layoutState.main.innerHTML = renderPageShell(
      "Yêu thích",
      '<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i></div><h2>Không thể tải danh sách yêu thích</h2><p>'
        + escapeHtml(message)
        + '</p><button class="customer-button" type="button" onclick="window.location.reload()">Thử lại</button></div>'
    );
    notifyError(message);
    return;
  }
  renderHeader();

  const wishlistItems = Array.isArray(layoutState.wishlistItems) ? layoutState.wishlistItems : [];
  if (!wishlistItems.length) {
    layoutState.main.innerHTML = renderPageShell("Yêu thích", `<div class="customer-empty-state"><div class="customer-empty-icon"><i class="fa-solid fa-heart" aria-hidden="true"></i></div><h2>Danh sách yêu thích trống</h2><p>Chọn sản phẩm bạn yêu thích để lưu lại và xem sau.</p><a class="customer-button" href="#home">Tiếp tục mua sắm</a></div>`);
    return;
  }

  const cardsHtml = wishlistItems.map((item) => createProductCard(mapWishlistProductForCard(item))).join("");
  layoutState.main.innerHTML = renderPageShell("Yêu thích", `
    <div class="customer-wishlist-shell">
      <div class="customer-wishlist-header" style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
        <div>
          <h2>Yêu thích của bạn</h2>
          <p>${wishlistItems.length} sản phẩm trong danh sách yêu thích</p>
        </div>
        <a class="customer-button secondary" href="#home">Tiếp tục mua sắm</a>
      </div>
      <div class="product-grid">
        ${cardsHtml}
      </div>
    </div>
  `);

  initProductCard(layoutState.main);
  syncWishlistToggleButtons();
}

function mapWishlistProductForCard(product = {}) {
  const price = Number(product.salePrice ?? product.sale_price ?? product.price ?? product.unitPrice ?? 0);
  const originalPrice = Number(product.price ?? product.unitPrice ?? product.comparePrice ?? product.sale_price ?? 0);
  const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  return {
    id: product.id || product.product_id || product.productId || "",
    name: product.name || product.productName || product.product_name || "",
    category: product.categoryName || product.category || product.category_name || "Sản phẩm",
    image: resolveProductImageUrl(product.thumbnailUrl || product.thumbnail_url || product.imageUrl || product.productImageUrl || ""),
    hoverImage: "",
    price,
    comparePrice: discount > 0 ? originalPrice : null,
    discount,
    rating: Number(product.ratingAverage ?? product.rating_average ?? product.rating ?? 4.8),
    sold: Number(product.sold || 0),
    badge: discount > 0 ? "GIẢM GIÁ" : "YÊU THÍCH",
    inStock: Number(product.stock || product.stock_qty || product.quantity || 0) > 0,
    isWishlist: true
  };
}

async function handleWishlistToggle(productId, button) {
  if (!productId) return;

  if (!customerAuth.isAuthenticated()) {
    notifyError("Vui lòng đăng nhập để lưu sản phẩm yêu thích.");
    return;
  }

  const isActive = layoutState.wishlistProductIds.has(String(productId));
  try {
    const url = `/wishlist/${encodeURIComponent(productId)}`;
    if (isActive) {
      await customerApi(url, { method: "DELETE" });
      notifySuccess("Đã bỏ khỏi yêu thích");
    } else {
      await customerApi(url, { method: "POST" });
      notifySuccess("Đã thêm vào yêu thích");
    }
    await refreshWishlist();
    renderHeader();
    syncWishlistToggleButtons();
    if (currentRoute === 'wishlist') {
      await renderWishlistPage();
    }
  } catch (error) {
    notifyError(error?.message || "Đã xảy ra lỗi khi cập nhật yêu thích.");
  }
}

async function refreshWishlist({ throwOnError = false } = {}) {
  if (!customerAuth.isAuthenticated()) {
    layoutState.wishlistItems = [];
    layoutState.wishlistProductIds = new Set();
    layoutState.wishlistTotal = 0;
    syncWishlistToggleButtons();
    return { items: [], total: 0 };
  }

  try {
    const response = await customerApi("/wishlist");
    const items = Array.isArray(response?.data?.wishlist) ? response.data.wishlist : [];
    const total = Number(response?.data?.total || items.length || 0);
    layoutState.wishlistItems = items;
    layoutState.wishlistProductIds = new Set(items.map((item) => String(item.id || item.productId || item.product_id || "")));
    layoutState.wishlistTotal = total;
    syncWishlistToggleButtons();
    renderHeader();
    return { items: layoutState.wishlistItems, total: layoutState.wishlistTotal };
  } catch (error) {
    layoutState.wishlistItems = [];
    layoutState.wishlistProductIds = new Set();
    layoutState.wishlistTotal = 0;
    if (error?.status === 401) {
      customerAuth.clearExternalLogin?.("wishlist-unauthorized");
    }
    syncWishlistToggleButtons();
    renderHeader();
    if (throwOnError) throw error;
    return { items: [], total: 0 };
  }
}

function syncWishlistToggleButtons() {
  document.querySelectorAll("[data-wishlist-toggle]").forEach((button) => {
    const productId = String(button.dataset.wishlistToggle || "");
    const isActive = layoutState.wishlistProductIds.has(productId);
    button.classList.toggle("is-active", isActive);
    const icon = button.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-solid", isActive);
      icon.classList.toggle("fa-regular", !isActive);
    }
  });
}

async function handleAddToCart(productId) {
  if (!productId) return;
  await handleAddToCartPayload({
    productId,
    quantity: 1
  });
}

async function handleProductCardBuyNow(button) {
  const productId = button?.dataset?.productId;
  if (!productId) return;

  button.disabled = true;
  try {
    const detail = await getProductForBuyNow(button);
    const variantCount = Number(detail.variantCount ?? detail.variant_count ?? (Array.isArray(detail.variants) ? detail.variants.length : 0));

    if (variantCount > 0) {
      notifyWarning("Vui lòng chọn size/màu trước khi mua ngay.");
      navigateToRoute(`product-detail/${encodeURIComponent(productId)}`);
      return;
    }

    const stock = Number(detail.stock ?? button.dataset.productStock ?? 0);
    if (stock <= 0) {
      notifyWarning("Sản phẩm này đã hết hàng.");
      return;
    }

    startBuyNowCheckout(createProductCardBuyNowItem(detail, button));
  } catch (error) {
    notifyError(error?.message || "Không thể mua ngay sản phẩm này. Vui lòng thử lại.");
  } finally {
    button.disabled = false;
  }
}

async function getProductForBuyNow(button) {
  const productId = button?.dataset?.productId;
  const hasKnownVariants = button.dataset.productHasVariants === "true" || Number(button.dataset.productVariantCount || 0) > 0;
  if (hasKnownVariants) {
    return { ...button.dataset, id: productId, variantCount: Number(button.dataset.productVariantCount || 1) };
  }

  try {
    const response = await customerApi(`/products/${encodeURIComponent(productId)}`, { auth: false });
    return response?.data?.product || response?.product || response?.data || createProductFromBuyNowDataset(button);
  } catch {
    return createProductFromBuyNowDataset(button);
  }
}

function createProductFromBuyNowDataset(button) {
  return {
    id: button.dataset.productId,
    name: button.dataset.productName,
    price: Number(button.dataset.productPrice || 0),
    salePrice: button.dataset.productSalePrice ? Number(button.dataset.productSalePrice) : null,
    finalPrice: Number(button.dataset.productFinalPrice || button.dataset.productSalePrice || button.dataset.productPrice || 0),
    thumbnailUrl: button.dataset.productThumbnailUrl || button.dataset.productImageUrl || null,
    imageUrl: button.dataset.productImageUrl || button.dataset.productThumbnailUrl || null,
    selectedImageUrl: button.dataset.productSelectedImageUrl || button.dataset.productImageUrl || button.dataset.productThumbnailUrl || null,
    stock: Number(button.dataset.productStock || 0),
    variantCount: Number(button.dataset.productVariantCount || 0),
    variants: []
  };
}

function createProductCardBuyNowItem(product, button) {
  const productId = product.id ?? product.productId ?? button.dataset.productId;
  const price = Number(product.price ?? button.dataset.productPrice ?? 0);
  const salePrice = product.salePrice ?? product.sale_price ?? (button.dataset.productSalePrice ? Number(button.dataset.productSalePrice) : null);
  const finalPrice = Number(product.finalPrice ?? product.final_price ?? salePrice ?? button.dataset.productFinalPrice ?? price);
  const imageUrl = resolveProductImageUrl(
    product.selectedImageUrl || product.selected_image_url || product.thumbnailUrl || product.thumbnail_url || product.imageUrl || product.image_url || button.dataset.productSelectedImageUrl || button.dataset.productImageUrl || button.dataset.productThumbnailUrl || ""
  );

  return {
    product_id: Number(productId),
    product_name: product.name || button.dataset.productName || "Sản phẩm",
    product_sku: product.sku || null,
    price,
    sale_price: salePrice !== null && salePrice !== undefined && salePrice !== "" ? Number(salePrice) : null,
    final_price: finalPrice,
    quantity: 1,
    unit_price: finalPrice,
    thumbnail_url: imageUrl,
    image_url: imageUrl,
    product_image_url: imageUrl,
    selected_image_url: imageUrl,
    variant_id: null,
    variant_key: `${productId}|base`,
    size: null,
    color: null
  };
}

const PENDING_CHECKOUT_KEY = "pending_checkout_intent";
const BUY_NOW_CHECKOUT_KEY = "buy_now_checkout";
const PENDING_CHECKOUT_TTL_MS = 30 * 60 * 1000;

function savePendingCheckout(data = {}) {
  try {
    const payload = { version: 1, ...data, createdAt: Date.now() };
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.debug("[checkout] Unable to save pending checkout", error?.message || error);
    return null;
  }
}

function getPendingCheckout() {
  try {
    const payload = JSON.parse(sessionStorage.getItem(PENDING_CHECKOUT_KEY) || "null");
    if (!payload || payload.version !== 1 || !payload.action) return null;
    if (isPendingCheckoutExpired(payload)) {
      clearPendingCheckout();
      return null;
    }
    return payload;
  } catch {
    clearPendingCheckout();
    return null;
  }
}

function clearPendingCheckout() {
  try { sessionStorage.removeItem(PENDING_CHECKOUT_KEY); } catch {}
}

function isPendingCheckoutExpired(data = {}) {
  const createdAt = Number(data.createdAt || data.created_at || 0);
  return !createdAt || Date.now() - createdAt > PENDING_CHECKOUT_TTL_MS;
}

function createPendingCheckoutFromBuyNowItem(item = {}) {
  return {
    action: "BUY_NOW",
    productId: Number(item.product_id ?? item.productId ?? 0),
    variantId: item.variant_id ?? item.variantId ?? null,
    colorName: item.color || null,
    sizeName: item.size || null,
    quantity: Number(item.quantity || 1),
    selectedImageUrl: item.selected_image_url || item.product_image_url || item.productImageUrl || null,
    sourceRoute: window.location.hash || "#home",
    returnRoute: "#checkout?mode=buy-now"
  };
}

function startBuyNowCheckout(item) {
  try {
    if (!customerAuth.isAuthenticated()) {
      savePendingCheckout(createPendingCheckoutFromBuyNowItem(item));
      layoutState.pendingRoute = "checkout?mode=buy-now";
      notifySuccess("Vui lòng đăng nhập để tiếp tục thanh toán. Lựa chọn của bạn đã được lưu.");
      navigateToRoute("login");
      return;
    }

    const payload = { mode: "buy_now", items: [item], created_at: Date.now() };
    sessionStorage.setItem(BUY_NOW_CHECKOUT_KEY, JSON.stringify(payload));
    navigateToRoute("checkout?mode=buy-now");
  } catch {
    notifyError("Không thể khởi tạo thanh toán ngay. Vui lòng thử lại.");
  }
}

async function continuePendingCheckoutAfterLogin() {
  const pending = getPendingCheckout();
  if (!pending) return false;

  if (pending.action === "CART_CHECKOUT") {
    clearPendingCheckout();
    clearBuyNowCheckout();
    navigateToRoute("checkout");
    return true;
  }

  if (pending.action !== "BUY_NOW") {
    clearPendingCheckout();
    return false;
  }

  try {
    const item = await createValidatedBuyNowItemFromPending(pending);
    sessionStorage.setItem(BUY_NOW_CHECKOUT_KEY, JSON.stringify({ mode: "buy_now", items: [item], created_at: Date.now() }));
    clearPendingCheckout();
    notifySuccess("Đã khôi phục sản phẩm bạn vừa chọn.");
    navigateToRoute("checkout?mode=buy-now");
    return true;
  } catch (error) {
    const sourceRoute = pending.sourceRoute || "#home";
    clearPendingCheckout();
    clearBuyNowCheckout();
    notifyError(error?.message || "Phiên mua hàng trước đó không còn hợp lệ. Vui lòng chọn lại màu sắc và kích thước.");
    navigateToRoute(String(sourceRoute).replace(/^#/, "") || "home");
    return true;
  }
}

async function createValidatedBuyNowItemFromPending(pending = {}) {
  const productId = Number(pending.productId || pending.product_id || 0);
  const quantity = Number(pending.quantity || 0);
  if (!productId || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Phiên mua hàng đã hết hạn. Vui lòng chọn lại sản phẩm.");
  }

  const response = await customerApi(`/products/${encodeURIComponent(productId)}`, { auth: false });
  const product = response?.data?.product || response?.product || response?.data;
  if (!product) throw new Error("Sản phẩm không còn khả dụng.");
  const productStatus = String(product.status || "active").toLowerCase();
  if (!["active", "published", "available"].includes(productStatus)) {
    throw new Error("Sản phẩm đã ngừng bán. Vui lòng chọn sản phẩm khác.");
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variantId = pending.variantId ?? pending.variant_id ?? null;
  let variant = null;
  if (variants.length) {
    variant = variants.find((item) => String(item.id) === String(variantId)) || null;
    if (!variant) throw new Error("Phiên mua hàng trước đó không còn hợp lệ. Vui lòng chọn lại màu sắc và kích thước.");
    if (String(variant.status || "active").toLowerCase() !== "active") throw new Error("Biến thể bạn chọn vừa hết hàng. Vui lòng chọn sản phẩm khác.");
  }

  const stock = Number(variant?.stock ?? product.stock ?? 0);
  if (stock <= 0) throw new Error("Biến thể bạn chọn vừa hết hàng. Vui lòng chọn sản phẩm khác.");
  if (quantity > stock) throw new Error(`Chỉ còn ${stock} sản phẩm trong kho. Vui lòng điều chỉnh lại số lượng.`);

  const unitPrice = variant
    ? Number(variant.salePrice ?? variant.sale_price ?? variant.price ?? product.salePrice ?? product.sale_price ?? product.price ?? 0)
    : Number(product.salePrice ?? product.sale_price ?? product.finalPrice ?? product.final_price ?? product.price ?? 0);
  const imageUrl = resolveProductImageUrl(pending.selectedImageUrl || pending.selected_image_url || product.thumbnailUrl || product.thumbnail_url || product.imageUrl || product.image_url || "");

  return {
    product_id: Number(product.id ?? productId),
    variant_id: variant?.id || null,
    variant_key: variant ? `${productId}|${variant.id}|${variant.size}|${variant.color}` : `${productId}|base`,
    product_name: product.name || "Sản phẩm",
    product_sku: variant?.sku || product.sku || null,
    quantity,
    unit_price: unitPrice,
    size: variant?.size || pending.sizeName || pending.size || null,
    color: variant?.color || pending.colorName || pending.color || null,
    product_image_url: imageUrl,
    selected_image_url: !variant ? imageUrl : null
  };
}

function readBuyNowCheckout() {
  try {
    const payload = JSON.parse(sessionStorage.getItem(BUY_NOW_CHECKOUT_KEY) || "null");
    if (payload?.mode !== "buy_now" || !Array.isArray(payload.items) || payload.items.length !== 1) return null;
    if (isPendingCheckoutExpired({ createdAt: payload.created_at })) {
      clearBuyNowCheckout();
      return null;
    }
    return payload;
  } catch {
    clearBuyNowCheckout();
    return null;
  }
}

function clearBuyNowCheckout() {
  try { sessionStorage.removeItem(BUY_NOW_CHECKOUT_KEY); } catch {}
}

function mapBuyNowItemForCheckout(item = {}) {
  const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0);
  const quantity = Number(item.quantity || 0);
  return {
    productId: item.product_id ?? item.productId,
    variantId: item.variant_id ?? item.variantId ?? null,
    variantKey: item.variant_key ?? item.variantKey ?? null,
    productName: item.product_name ?? item.productName ?? "",
    productSku: item.product_sku ?? item.productSku ?? null,
    productImageUrl: item.product_image_url ?? item.productImageUrl ?? item.selected_image_url ?? null,
    size: item.size || null,
    color: item.color || null,
    quantity,
    unitPrice,
    totalPrice: unitPrice * quantity,
    isSelected: true
  };
}

async function handleAddToCartPayload(payload) {
  if (!customerAuth.isAuthenticated()) {
    notifyError("Vui lòng đăng nhập trước khi thêm vào giỏ hàng.");
    navigateToRoute('login');
    return;
  }

  try {
    await customerCart.addItem(payload);
    await refreshCart();
    renderHeader();
    notifySuccess("Đã thêm vào giỏ hàng.");
  } catch (error) {
    notifyError(getCartErrorMessage(error));
  }
}

async function refreshCart() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.cart = createEmptyCart();
    return layoutState.cart;
  }

  try {
    layoutState.cart = await customerCart.load();
  } catch (error) {
    layoutState.cart = createEmptyCart();
    if (error?.status === 401) {
      customerAuth.clearExternalLogin?.("cart-unauthorized");
    }
  }

  return layoutState.cart;
}

function normalizeRoute(hash = '') {
  return (hash || '').replace(/^#\/?/, '').split('?')[0].toLowerCase() || 'home';
}

function getRouteParam(hash = '') {
  const parts = (hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
  return decodeURIComponent(parts[1] || '');
}

function isAppRoute(route) {
  return ['home','login','register','phone-login','forgot-password','auth-callback','profile','orders','checkout','cart','wishlist','product-detail'].includes(route) || route.startsWith('orders/');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}


function formatShippingFee(value) {
  return Number(value || 0) === 0 ? "Miễn phí" : formatCurrency(value);
}
function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function resolveAssetUrl(url) {
  if (!url) return FALLBACK_PRODUCT_IMAGE;
  return globalThis.normalizeImageUrl?.(url) ?? url;
}


const CHECKOUT_PAYMENT_ICON_MAP = Object.freeze({
  cod: { icon: "fa-box-open", label: "COD" },
  bank_transfer: { icon: "fa-building-columns", label: "Chuyển khoản ngân hàng" },
  momo: { icon: "fa-wallet", label: "MoMo" },
  credit_card: { icon: "fa-credit-card", label: "Thẻ tín dụng" }
});

function getCheckoutPaymentDescription(method = "") {
  return ({
    cod: "Thanh toán trực tiếp khi nhận hàng.",
    bank_transfer: "Chuyển khoản ngân hàng trước khi giao hàng.",
    momo: "Thanh toán bằng ví điện tử MoMo.",
    credit_card: "Thanh toán bằng thẻ tín dụng khi cổng thanh toán khả dụng."
  })[normalizePaymentMethodValue(method)] || "Phương thức thanh toán được hỗ trợ.";
}

function observeCheckoutPaymentCards() {
  try {
    normalizeCheckoutPaymentCards(document);
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0)) {
        normalizeCheckoutPaymentCards(document);
      }
    });
    observer.observe(layoutState.main || document.body, { childList: true, subtree: true });
  } catch (error) {
    console.debug("[checkout-payment] normalization skipped", error?.message);
  }
}

function normalizeCheckoutPaymentCards(root = document) {
  const radios = Array.from(root.querySelectorAll("input[type='radio']")).filter((input) => {
    const value = normalizePaymentMethodValue(input.value);
    return Boolean(CHECKOUT_PAYMENT_ICON_MAP[value]);
  });

  radios.forEach((radio) => {
    const method = normalizePaymentMethodValue(radio.value);
    const config = CHECKOUT_PAYMENT_ICON_MAP[method];
    const card = findPaymentCard(radio);
    if (!card || card.dataset.paymentCardNormalized === "true") {
      syncPaymentCardState(radio, card);
      return;
    }

    card.dataset.paymentCardNormalized = "true";
    card.dataset.paymentMethodCard = method;
    card.classList.add("checkout-payment-card", "nl-payment-card-normalized");

    removeBrokenPaymentEmoji(card);
    insertPaymentIcon(card, config);
    ensurePaymentLabel(card, radio, config.label);
    syncPaymentCardState(radio, card);

    card.addEventListener("click", (event) => {
      if (event.target.closest("a,button,input,select,textarea")) return;
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
      syncAllPaymentCardStates();
    });

    radio.addEventListener("change", syncAllPaymentCardStates);
  });
}

function findPaymentCard(radio) {
  return radio.closest("[data-payment-method-card], .payment-method-card, .checkout-payment-card, label, .form-check, .customer-payment-option") || radio.parentElement;
}

function insertPaymentIcon(card, config) {
  if (card.querySelector(".checkout-payment-card-icon, .customer-payment-icon i, .customer-payment-icon svg")) return;
  const icon = document.createElement("span");
  icon.className = "checkout-payment-card-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = `<i class="fa-solid ${config.icon}"></i>`;
  card.prepend(icon);
}

function ensurePaymentLabel(card, radio, fallbackLabel) {
  const textNodes = getDirectTextNodes(card).filter((node) => node.textContent.trim());
  textNodes.forEach((node) => {
    node.textContent = sanitizeBrokenPaymentText(node.textContent);
  });

  const hasReadableText = String(card.textContent || "").replace(/\s+/g, " ").trim().length > 0;
  if (hasReadableText) return;

  const label = document.createElement("span");
  label.className = "checkout-payment-card-title";
  label.textContent = fallbackLabel;
  radio.insertAdjacentElement("afterend", label);
}

function removeBrokenPaymentEmoji(card) {
  getDirectTextNodes(card).forEach((node) => {
    node.textContent = sanitizeBrokenPaymentText(node.textContent);
  });
  card.querySelectorAll("span, strong, small, p, div").forEach((element) => {
    if (element.children.length === 0) {
      element.textContent = sanitizeBrokenPaymentText(element.textContent);
    }
  });
}

function sanitizeBrokenPaymentText(value) {
  return String(value || "")
    .replace(/\u00f0\u0178[\s\S]?/g, "")
    .replace(/[📦💵🏦💳👛💰]/gu, "")
    .replace(/\s{2,}/g, " ");
}

function getDirectTextNodes(element) {
  return Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
}

function syncAllPaymentCardStates() {
  document.querySelectorAll("input[type='radio']").forEach((radio) => {
    const method = normalizePaymentMethodValue(radio.value);
    if (CHECKOUT_PAYMENT_ICON_MAP[method]) {
      syncPaymentCardState(radio, findPaymentCard(radio));
    }
  });
}

function syncPaymentCardState(radio, card) {
  if (!card) return;
  card.classList.toggle("is-selected", Boolean(radio.checked));
}

function normalizePaymentMethodValue(value) {
  return String(value || "").trim().toLowerCase().replace(/-/g, "_");
}
// Password visibility toggle: inject styles and attach toggles to inputs[type=password]
function injectPasswordToggleStyles() {
  if (document.getElementById('password-toggle-styles')) return;
  const style = document.createElement('style');
  style.id = 'password-toggle-styles';
  style.textContent = `
    .password-input-wrapper{position:relative;display:block;width:100%}
    .password-input-wrapper input{padding-right:94px;box-sizing:border-box}
    .password-toggle-button{position:absolute;right:8px;top:50%;height:38px;transform:translateY(-50%);border:0;background:transparent;color:#0b173d;cursor:pointer;font:700 .9rem/1 inherit;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:999px}
    .password-toggle-button:hover{background:rgba(196,143,46,.10);color:#8f5f12}
    .password-toggle-button:focus{outline:2px solid rgba(196,143,46,.35);border-radius:999px}
  `;
  document.head.appendChild(style);
}

function initPasswordToggles(root = document) {
  injectPasswordToggleStyles();

  const inputs = Array.from((root || document).querySelectorAll('input[type="password"]'));
  inputs.forEach((input) => {
    if (input.dataset.hasPasswordToggle) return;
    input.dataset.hasPasswordToggle = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'password-input-wrapper';

    // Move input into wrapper while preserving reference
    const parent = input.parentNode;
    if (!parent) return;
    parent.replaceChild(wrapper, input);
    wrapper.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle-button';
    btn.title = 'Hiện mật khẩu';
    btn.setAttribute('aria-label', 'Hiện mật khẩu');
    btn.innerHTML = '<i class="fa-regular fa-eye" aria-hidden="true"></i><span>Hiện</span>';
    wrapper.appendChild(btn);

    btn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i><span>Ẩn</span>';
        btn.title = 'Ẩn mật khẩu';
        btn.setAttribute('aria-label', 'Ẩn mật khẩu');
      } else {
        input.type = 'password';
        btn.innerHTML = '<i class="fa-regular fa-eye" aria-hidden="true"></i><span>Hiện</span>';
        btn.title = 'Hiện mật khẩu';
        btn.setAttribute('aria-label', 'Hiện mật khẩu');
      }
      input.focus();
    });
  });
}

// Observe main area and initialize toggles when content changes (SPA support)
function observePasswordTogglesOnMain() {
  try {
    const root = layoutState.main || document.body;
    initPasswordToggles(root);
    const observer = new MutationObserver(() => initPasswordToggles(root));
    observer.observe(root, { childList: true, subtree: true });
  } catch (e) {
    // fail silently
  }
}

function resolveProductImageUrl(url) {
  const resolvedUrl = resolveAssetUrl(url);
  return resolvedUrl === FALLBACK_PRODUCT_IMAGE ? resolvedUrl : resolvedUrl;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapCustomerWebsite, { once: true });
} else {
  bootstrapCustomerWebsite();
}
