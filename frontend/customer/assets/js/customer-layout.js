import { createCustomerFooter } from "../../components/footer/footer.js";
import { createCustomerHeader, initCustomerHeader } from "../../components/header/header.js";
import { initCustomerChatbot } from "../../components/chatbot/chatbot.js";
import { createProductDetailPage, initProductDetailPage } from "../../components/product-detail/product-detail.js";
import { createProductCard, initProductCard } from "../../components/product-card/product-card.js";
import { createHomePage, initHomePage } from "../../home/home.js";
import { customerApi, customerAuth, showCustomerMessage } from "./customer-auth.js?v=20260717-cloudflare-pages";
import { createEmptyCart, customerCart, getCartErrorMessage, showCustomerToast } from "./customer-cart.js";
import { VIETNAM_ADMINISTRATIVE_2025, getWardsByProvince } from "../../../assets/data/vietnam-administrative-2025.js";

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
  }
};

const protectedRoutes = new Set(["checkout", "orders", "profile", "cart", "wishlist"]);
const homeSectionRoutes = new Set(["flash-sale", "featured-product", "new-arrival", "best-seller", "categories", "jewelry", "brands", "reviews", "newsletter", "promotion", "collections", "story", "products"]);
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

function normalizeOrderStatus(status = "") {
  const value = String(status || "").toLowerCase();
  const map = {
    pending: { label: "Đang chờ xác nhận", variant: "warning" },
    confirmed: { label: "Đã xác nhận", variant: "info" },
    processing: { label: "Đang chuẩn bị", variant: "primary" },
    shipped: { label: "Đang giao hàng", variant: "accent" },
    delivered: { label: "Đã giao hàng", variant: "success" },
    cancelled: { label: "Đã hủy", variant: "danger" },
    refunded: { label: "Đã hoàn tiền", variant: "neutral" }
  };

  return map[value] || { label: status || "Đang xử lý", variant: "neutral" };
}

function normalizePaymentStatus(status = "") {
  const value = String(status || "").toLowerCase();
  const map = {
    unpaid: { label: "Chưa thanh toán", variant: "warning" },
    partial: { label: "Thanh toán một phần", variant: "info" },
    paid: { label: "Đã thanh toán", variant: "success" },
    failed: { label: "Thanh toán lỗi", variant: "danger" },
    refunded: { label: "Đã hoàn tiền", variant: "neutral" }
  };

  return map[value] || { label: status || "Chưa cập nhật", variant: "neutral" };
}

function normalizePaymentTransactionStatus(status = "") {
  const value = String(status || "").toLowerCase();
  const map = {
    pending: { label: "Chờ thanh toán", variant: "warning" },
    paid: { label: "Đã thanh toán", variant: "success" },
    success: { label: "Đã thanh toán", variant: "success" },
    failed: { label: "Thanh toán thất bại", variant: "danger" },
    refunded: { label: "Đã hoàn tiền", variant: "neutral" }
  };

  return map[value] || { label: status || "Chưa cập nhật", variant: "neutral" };
}

function getPaymentMethodLabel(method = "") {
  const value = String(method || "").toLowerCase();
  const labels = {
    cod: "Thanh toán khi nhận hàng",
    bank_transfer: "Chuyển khoản ngân hàng",
    vnpay: "VNPay",
    momo: "MoMo"
  };

  return labels[value] || method || "Chưa cập nhật";
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
      setNewsletterPopupFeedback(feedback, response.message || "Dang ky thanh cong. Ma uu dai cua ban da san sang.", "success");
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
  if (window.location.hash === normalized) {
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
      navigateToRoute(redirect, true);
      return;
    }

    if ((protectedRoutes.has(nextRoute) || isOrdersRoute) && !customerAuth.isAuthenticated()) {
      layoutState.pendingRoute = nextRoute;
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
    if (route === 'login') {
      if (customerAuth.isAuthenticated()) {
        const redirect = layoutState.pendingRoute || 'home';
        layoutState.pendingRoute = '';
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
    window.requestAnimationFrame(() => {
      if (sectionId) {
        const target = document.getElementById(sectionId);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
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
  const legacyFilter = PRODUCT_MENU_FILTERS[keywordKey];
  let category = null;
  let title = legacyFilter?.label || "Tất cả sản phẩm";

  layoutState.main.innerHTML = renderPageShell(title, `
    <div class="customer-empty-state">
      <div class="customer-button-spinner"></div>
      <p>Đang tải sản phẩm...</p>
    </div>
  `);

  try {
    if (categorySlug) {
      category = await getCustomerCategoryBySlug(categorySlug);
      title = category?.name || categorySlug;
    }

    const query = new URLSearchParams({ status: "active", limit: "100" });
    if (category?.id) {
      query.set("categoryId", String(category.id));
    } else if (legacyFilter) {
      query.set("search", [...legacyFilter.keywords, keywordKey].join("|"));
    }

    const response = await customerApi(`/products?${query.toString()}`, { auth: false });
    const apiProducts = getListFromApiPayload(response, "products");
    const products = categorySlug
      ? apiProducts.filter((product) => isProductInCategory(product, categorySlug, category))
      : legacyFilter
        ? apiProducts.filter((product) => matchesProductMenuFilter(product, legacyFilter))
        : apiProducts;

    if (!products.length) {
      layoutState.main.innerHTML = renderPageShell(title, `
        <div class="customer-empty-state">
          <div class="customer-empty-icon"><i class="fa-solid fa-box-open" aria-hidden="true"></i></div>
          <h2>Danh mục: ${escapeHtml(title)}</h2>
          <p>Chưa có sản phẩm phù hợp.</p>
          <a class="customer-button secondary" href="#home">Quay lại trang chủ</a>
        </div>
      `);
      return;
    }

    const cards = products.map((product) => createProductCard(mapApiProductForCard(product))).join("");
    layoutState.main.innerHTML = renderPageShell(title, `
      <section class="customer-product-results">
        <div class="section-heading">
          <div>
            <span class="ds-tag">DANH MỤC SẢN PHẨM</span>
            <h1>Danh mục: ${escapeHtml(title)}</h1>
            <p>Tìm thấy ${products.length} sản phẩm phù hợp.</p>
          </div>
        </div>
        <div class="product-grid">${cards}</div>
      </section>
    `);
    initProductCard(layoutState.main);
    syncWishlistToggleButtons();
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell(title, `
      <div class="customer-empty-state">
        <div class="customer-empty-icon"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i></div>
        <h2>Không thể tải sản phẩm</h2>
        <p>${escapeHtml(error?.message || "Đã xảy ra lỗi khi tải danh sách sản phẩm.")}</p>
        <button class="customer-button" type="button" data-products-retry>Thử lại</button>
      </div>
    `);
    layoutState.main.querySelector("[data-products-retry]")?.addEventListener("click", renderProductListPage);
  }
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

function renderPageShell(title, content) {
  return `
    <section class="customer-section">
      <div class="customer-container customer-page-shell">
        <article class="customer-card" style="padding:24px;">
          <h1 style="margin-bottom:12px;">${escapeHtml(title)}</h1>
          ${content}
        </article>
      </div>
    </section>
  `;
}

function renderSocialButtons(label = "đăng nhập") {
  return `<div class="auth-divider"><span>Hoặc ${label} với</span></div>
    <div class="auth-social-grid">
      <button class="auth-social-button" type="button" data-oauth="google"><span class="auth-social-icon google">G</span>Đăng nhập bằng Google</button>
      <button class="auth-social-button" type="button" data-oauth="facebook"><span class="auth-social-icon facebook">f</span>Đăng nhập bằng Facebook</button>
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
    showCustomerToast(`Vui lòng cho phép popup để đăng nhập ${providerLabel}.`, "error");
    return;
  }

  layoutState.oauthPopup = popup;
  layoutState.oauthPopupProvider = provider;
  popup.focus?.();

}

async function handleOAuthMessage(event) {
  const allowedOrigins = [
    "https://nl-store.pages.dev",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ];
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
    showCustomerToast(event.data.message || "Đăng nhập thất bại", "error");
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
    layoutState.pendingRoute = "";
    window.history.replaceState(null, "", "index.html#home");
    currentRoute = "";
    renderRoute();
    await Promise.all([refreshCart(), refreshWishlist()]);
    renderHeader();
    showCustomerToast("Đăng nhập thành công", "success");
  } catch (error) {
    console.debug(`[auth] ${providerLabel} popup login failed`, error?.message || error);
    customerAuth.clearExternalLogin(`${provider}-popup-token-invalid`);
    window.history.replaceState(null, "", "index.html#login");
    currentRoute = "";
    renderHeader();
    renderRoute();
    showCustomerToast(error?.message || "Đăng nhập thất bại", "error");
  } finally {
    layoutState.isCompletingOAuth = false;
  }
}
function renderLoginPage() {
  layoutState.main.innerHTML = `<section class="customer-section auth-page"><div class="customer-container"><article class="auth-card">
    <a class="auth-back" href="#home">← Quay lại trang trước</a><div class="auth-heading"><span class="auth-kicker">N&L SHOP</span><h1>Đăng nhập</h1><p>Chào mừng bạn quay lại với trải nghiệm mua sắm riêng của mình.</p></div>
    <form data-login-form class="auth-form"><div data-auth-message hidden></div>
      <label><span>Email hoặc số điện thoại</span><input name="email" required autocomplete="username" placeholder="email@example.com hoặc 0901234567"></label>
      <label><span>Mật khẩu</span><input type="password" name="password" required autocomplete="current-password" placeholder="Nhập mật khẩu"></label>
      <div class="auth-row"><label class="auth-check"><input type="checkbox" name="remember"><span>Ghi nhớ đăng nhập</span></label><a href="#forgot-password">Quên mật khẩu?</a></div>
      <button class="customer-button auth-primary" type="submit">Đăng nhập</button>
      ${renderSocialButtons("đăng nhập")}
      <a class="auth-phone-button" href="#phone-login">Đăng nhập bằng số điện thoại</a>
      <p class="auth-switch">Chưa có tài khoản? <a href="#register">Đăng ký</a></p>
    </form></article></div></section>`;
  const root = layoutState.main; bindOAuthButtons(root);
  root.querySelector("[data-login-form]")?.addEventListener("submit", async event => {
    event.preventDefault(); const form=event.currentTarget; const data=new FormData(form); const button=form.querySelector("button[type=submit]");
    if(customerAuth.isLoginSubmitting)return; customerAuth.isLoginSubmitting=true; button.disabled=true; button.textContent="Đang đăng nhập...";
    try { await customerAuth.login({ email:String(data.get("email")||"").trim(), password:String(data.get("password")||""), remember:Boolean(data.get("remember")) }); showCustomerToast("Đăng nhập thành công.","success"); const redirect=layoutState.pendingRoute||"home"; layoutState.pendingRoute=""; navigateToRoute(redirect); }
    catch(error){ showCustomerMessage(form,error?.message||"Đăng nhập thất bại."); }
    finally{ customerAuth.isLoginSubmitting=false; button.disabled=false; button.textContent="Đăng nhập"; }
  });
}

function renderRegisterPage() {
  layoutState.main.innerHTML = `<section class="customer-section auth-page"><div class="customer-container"><article class="auth-card auth-card-wide">
    <a class="auth-back" href="#home">← Quay lại trang trước</a><div class="auth-heading"><span class="auth-kicker">N&L SHOP</span><h1>Đăng ký</h1><p>Đăng ký để mua sắm cùng N&L Shop</p></div>
    <form data-register-form class="auth-form"><div data-auth-message hidden></div><div class="auth-grid">
      <label><span>Họ và tên</span><input name="fullName" required autocomplete="name" placeholder="Nguyễn Văn A"></label>
      <label><span>Số điện thoại</span><input type="tel" name="phone" required autocomplete="tel" placeholder="0901234567"></label>
      <label class="auth-full"><span>Địa chỉ</span><input name="address" required autocomplete="street-address" placeholder="Số nhà, đường, phường/xã, tỉnh/thành"></label>
      <label class="auth-full"><span>Email</span><input type="email" name="email" required autocomplete="email" placeholder="email@example.com"></label>
      <label><span>Mật khẩu</span><input type="password" name="password" required autocomplete="new-password" placeholder="Ít nhất 8 ký tự"></label>
      <label><span>Xác nhận mật khẩu</span><input type="password" name="confirmPassword" required autocomplete="new-password" placeholder="Nhập lại mật khẩu"></label>
    </div><label class="auth-check auth-terms"><input type="checkbox" name="acceptTerms" required><span>Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư</span></label>
      <button class="customer-button auth-primary" type="submit">Đăng ký</button>${renderSocialButtons("tiếp tục")}
      <p class="auth-switch">Đã có tài khoản? <a href="#login">Đăng nhập</a></p>
    </form></article></div></section>`;
  const root=layoutState.main; bindOAuthButtons(root);
  root.querySelector("[data-register-form]")?.addEventListener("submit",async event=>{ event.preventDefault(); const form=event.currentTarget,data=new FormData(form),button=form.querySelector("button[type=submit]"); button.disabled=true; button.textContent="Đang đăng ký...";
    const payload={fullName:String(data.get("fullName")||"").trim(),phone:String(data.get("phone")||"").trim(),address:String(data.get("address")||"").trim(),email:String(data.get("email")||"").trim(),password:String(data.get("password")||""),confirmPassword:String(data.get("confirmPassword")||""),acceptTerms:Boolean(data.get("acceptTerms"))};
    try{await customerAuth.register(payload);showCustomerToast("Đăng ký thành công. Vui lòng đăng nhập.","success");navigateToRoute("login");}catch(error){showCustomerMessage(form,error?.message||"Đăng ký thất bại.");}finally{button.disabled=false;button.textContent="Đăng ký";}
  });
}

function renderPhoneLoginPage() {
  layoutState.main.innerHTML=`<section class="customer-section auth-page"><div class="customer-container"><article class="auth-card">
    <a class="auth-back" href="#login">← Quay lại trang trước</a><div class="auth-heading"><span class="auth-kicker">BẢO MẬT OTP</span><h1>Đăng nhập bằng số điện thoại</h1><p>Mã xác thực có hiệu lực trong 5 phút.</p></div>
    <form data-phone-form class="auth-form"><div data-auth-message hidden></div><label><span>Số điện thoại</span><input type="tel" name="phone" required placeholder="0901234567"></label>
      <button class="auth-phone-button" type="button" data-send-otp>Gửi mã OTP</button>
      <div data-otp-fields hidden><div class="otp-status">Mã đã gửi. Có thể gửi lại sau <strong data-countdown>60</strong> giây.</div><label><span>Mã OTP</span><input name="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="000000"></label>
        <label data-new-password><span>Mật khẩu mới <small>(nếu tài khoản chưa có mật khẩu)</small></span><input type="password" name="password" autocomplete="new-password"></label>
        <label data-confirm-password><span>Xác nhận mật khẩu</span><input type="password" name="confirmPassword" autocomplete="new-password"></label>
        <button class="customer-button auth-primary" type="submit">Xác thực và đăng nhập</button></div>
    </form></article></div></section>`;
  const form=layoutState.main.querySelector("[data-phone-form]"),send=form.querySelector("[data-send-otp]"),fields=form.querySelector("[data-otp-fields]"); let timer;
  send.addEventListener("click",async()=>{send.disabled=true;try{const result=await customerAuth.sendPhoneOtp(form.phone.value);fields.hidden=false;fields.querySelector("[name=otp]").required=true;const passwordField=fields.querySelector("[data-new-password]"),confirmField=fields.querySelector("[data-confirm-password]");passwordField.hidden=!result.requiresPassword;confirmField.hidden=!result.requiresPassword;passwordField.querySelector("input").required=Boolean(result.requiresPassword);confirmField.querySelector("input").required=Boolean(result.requiresPassword);let left=result.resendAfter||60;const counter=fields.querySelector("[data-countdown]");counter.textContent=left;clearInterval(timer);timer=setInterval(()=>{left-=1;counter.textContent=Math.max(left,0);if(left<=0){clearInterval(timer);send.disabled=false;send.textContent="Gửi lại mã OTP";}},1000);showCustomerMessage(form,"Mã OTP đã được gửi.","success");}catch(error){showCustomerMessage(form,error?.message||"Không thể gửi OTP.");send.disabled=false;}});
  form.addEventListener("submit",async event=>{event.preventDefault();const data=new FormData(form),button=form.querySelector("button[type=submit]");button.disabled=true;try{await customerAuth.verifyPhoneOtp({phone:String(data.get("phone")||"").trim(),otp:String(data.get("otp")||"").trim(),password:String(data.get("password")||""),confirmPassword:String(data.get("confirmPassword")||"")});showCustomerToast("Đăng nhập thành công.","success");navigateToRoute(layoutState.pendingRoute||"home");}catch(error){showCustomerMessage(form,error?.message||"Xác thực OTP thất bại.");}finally{button.disabled=false;}});
}

async function renderAuthCallbackPage() {
  currentRoute = "auth-callback";
  const callback = readOAuthCallback();
  if (callback.provider === "google") {
    console.info("[Google OAuth] callback URL =", redactOAuthCallbackUrl(window.location.href));
    console.info("[Google OAuth] token found =", Boolean(callback.token));
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
    window.history.replaceState(null, "", "index.html#home");
    currentRoute = "";
    renderHeader();
    renderRoute();
    await Promise.all([refreshCart(), refreshWishlist()]);
    renderHeader();
    showCustomerToast("Đăng nhập thành công", "success");
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
    console.info("[Google OAuth] token found =", Boolean(callback.token));
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

  const targetOrigins = [...new Set([
    window.location.origin,
    "https://nl-store.pages.dev",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ])];
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
  showCustomerToast(message || "Đăng nhập thất bại", "error");
  window.history.replaceState(null, "", "index.html#login");
  currentRoute = "";
  renderHeader();
  renderRoute();
}
async function renderCartPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Giỏ hàng", `<div class="customer-cart-empty-state"><div class="customer-cart-empty-icon">ðŸ‘œ</div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem và quản lý giỏ hàng của bạn.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
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
    const shippingFee = selectedSubtotal > 0 ? (voucherSummary.code === "SHIPFREE" ? 0 : 30000) : 0;
    const vatAmount = Math.max(Math.round((selectedSubtotal - voucherSummary.discountAmount) * 0.1), 0);
    const grandTotal = Math.max(selectedSubtotal - voucherSummary.discountAmount + shippingFee + vatAmount, 0);
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
              <div class="customer-cart-toolbar-meta">${selectedCount}/${items.length} đang chọn</div>
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
              <div><span>Giảm giá</span><strong>${formatCurrency(voucherSummary.discountAmount)}</strong></div>
              <div><span>Thuế VAT (10%)</span><strong>${formatCurrency(vatAmount)}</strong></div>
              <div><span>Phí vận chuyển</span><strong>${formatCurrency(shippingFee)}</strong></div>
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
        <div class="customer-cart-empty-icon">⚠️</div>
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
      <div class="customer-cart-empty-icon">ðŸ›ï¸</div>
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
      if (maxStock <= 0) { showCustomerToast("Sản phẩm này đã hết hàng", "error"); return; }
      if (current >= maxStock) { showCustomerToast(`Chỉ còn ${maxStock} sản phẩm trong kho`, "warning"); return; }
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
      showCustomerToast(layoutState.cartVoucher.message, "success");
    } catch (error) {
      layoutState.cartVoucher = { code, discountAmount: 0, status: "error", message: getVoucherErrorMessage(error) };
      showCustomerToast(layoutState.cartVoucher.message, "error");
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
      showCustomerToast("Vui lòng chọn ít nhất một sản phẩm để thanh toán.", "error");
      return;
    }
    clearBuyNowCheckout();
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
      showCustomerToast("Đã xóa sản phẩm khỏi giỏ hàng.", "success");
    }
  });
}

function showCartConfirmModal({ title, message, onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "customer-cart-modal-backdrop";
  overlay.innerHTML = `
    <div class="customer-cart-modal">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="customer-cart-modal-actions">
        <button class="customer-button secondary" type="button" data-cart-modal-cancel>Hủy</button>
        <button class="customer-button" type="button" data-cart-modal-confirm>Xóa</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("[data-cart-modal-cancel]")?.addEventListener("click", () => overlay.remove());
  overlay.querySelector("[data-cart-modal-confirm]")?.addEventListener("click", async () => {
    overlay.remove();
    await onConfirm?.();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
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
      <div class="customer-cart-empty-icon">ðŸ›ï¸</div>
      <h2>Giỏ hàng của bạn đang trống</h2>
      <p>Vui lòng quay lại sau khi thêm sản phẩm để đặt hàng.</p>
      <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
    </div>
  `;
}

function getCheckoutSummary(items, voucherCode = "") {
  const selectedItems = Array.isArray(items) ? items.filter((item) => item.isSelected) : [];
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const voucherSummary = getCartVoucherSummary(selectedSubtotal);
  const shippingFee = selectedSubtotal > 0 ? (voucherSummary.code === "SHIPFREE" ? 0 : 30000) : 0;
  const vatAmount = Math.max(Math.round((selectedSubtotal - voucherSummary.discountAmount) * 0.1), 0);
  const grandTotal = Math.max(selectedSubtotal - voucherSummary.discountAmount + shippingFee + vatAmount, 0);

  return {
    items: selectedItems,
    selectedSubtotal,
    discountAmount: voucherSummary.discountAmount,
    shippingFee,
    vatAmount,
    grandTotal,
    voucherSummary
  };
}

function showCheckoutSuccessModal(orderCode, paymentMethod = "cod") {
  const overlay = document.createElement("div");
  overlay.className = "customer-checkout-modal-backdrop";
  overlay.innerHTML = `
    <div class="customer-checkout-modal">
      <div class="customer-checkout-modal-icon">✓</div>
      <h3>Đặt hàng thành công</h3>
      <p>Mã đơn hàng của bạn là <strong>${escapeHtml(orderCode || "")}</strong>.</p>
      <p>${escapeHtml(getPaymentMethodLabel(paymentMethod))} · Chờ thanh toán</p>
      <div class="customer-checkout-modal-actions">
        <a class="customer-button secondary" href="#orders">Xem đơn hàng</a>
        <a class="customer-button" href="#home">Tiếp tục mua sắm</a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
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
    layoutState.main.innerHTML = renderPageShell("Thanh toán", `<div class="customer-cart-empty-state"><div class="customer-cart-empty-icon">ðŸ”</div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để tiếp tục thanh toán.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  layoutState.main.innerHTML = renderPageShell("Thanh toán", renderCheckoutSkeleton());

  try {
    const buyNowCheckout = readBuyNowCheckout();
    const isBuyNow = buyNowCheckout?.mode === "buy_now" && buyNowCheckout.items.length > 0;
    let items;
    if (isBuyNow) {
      items = buyNowCheckout.items.map(mapBuyNowItemForCheckout);
    } else {
      const cart = await customerCart.load();
      layoutState.cart = cart;
      items = Array.isArray(cart?.items) ? cart.items : [];
    }
    const checkoutSummary = getCheckoutSummary(items, layoutState.cartVoucher.code);
    checkoutSummary.checkoutMode = isBuyNow ? "buy_now" : "cart";
    checkoutSummary.buyNowItems = isBuyNow ? buyNowCheckout.items : [];

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
                <label class="customer-payment-card is-active">
                  <input type="radio" name="paymentMethod" value="cod" checked>
                  <div class="customer-payment-icon">ðŸšš</div>
                  <div>
                    <strong>Thanh toán khi nhận hàng (COD)</strong>
                    <p>Thanh toán trực tiếp khi nhận hàng.</p>
                  </div>
                </label>
                <label class="customer-payment-card">
                  <input type="radio" name="paymentMethod" value="bank_transfer">
                  <div class="customer-payment-icon">ðŸ¦</div>
                  <div>
                    <strong>Chuyển khoản ngân hàng</strong>
                    <p>Chuyển khoản trước khi giao hàng.</p>
                  </div>
                </label>
                <label class="customer-payment-card">
                  <input type="radio" name="paymentMethod" value="vnpay">
                  <div class="customer-payment-icon">ðŸ’³</div>
                  <div>
                    <strong>VNPay</strong>
                    <p>Thanh toán nhanh bằng cổng VNPay.</p>
                  </div>
                </label>
                <label class="customer-payment-card">
                  <input type="radio" name="paymentMethod" value="momo">
                  <div class="customer-payment-icon">ðŸ“±</div>
                  <div>
                    <strong>MoMo</strong>
                    <p>Thanh toán bằng ví điện tử MoMo.</p>
                  </div>
                </label>
              </div>
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
            <div class="customer-checkout-summary-lines">
              <div><span>Tạm tính</span><strong>${formatCurrency(checkoutSummary.selectedSubtotal)}</strong></div>
              <div><span>Giảm giá</span><strong>${formatCurrency(checkoutSummary.discountAmount)}</strong></div>
              <div><span>Thuế VAT (10%)</span><strong>${formatCurrency(checkoutSummary.vatAmount)}</strong></div>
              <div><span>Phí vận chuyển</span><strong>${formatCurrency(checkoutSummary.shippingFee)}</strong></div>
            </div>
            <div class="customer-checkout-total">
              <span>Tổng thanh toán</span>
              <strong>${formatCurrency(checkoutSummary.grandTotal)}</strong>
            </div>
            <button class="customer-button customer-checkout-submit" type="submit" data-checkout-submit form="checkout-form" disabled>Đặt hàng</button>
          </aside>
        </div>
      </div>
    `);

    initCheckoutForm(layoutState.main, checkoutSummary);
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Thanh toán", `
      <div class="customer-cart-empty-state">
        <div class="customer-cart-empty-icon">⚠️</div>
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
  paymentCards.forEach((card) => {
    card.addEventListener("click", () => {
      paymentCards.forEach((item) => item.classList.remove("is-active"));
      card.classList.add("is-active");
      card.querySelector("input")?.click();
    });
  });

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
    const validation = validateCheckoutForm(form);

    if (!validation.isValid) {
      form.dataset.checkoutErrors = JSON.stringify(validation.errors);
      renderCheckoutFieldErrors(form);
      showCustomerToast("Vui lòng kiểm tra lại thông tin trước khi đặt hàng.", "error");
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
      showCustomerToast("Giỏ hàng đang trống.", "error");
      return;
    }

    const province = VIETNAM_ADMINISTRATIVE_2025.find((p) => p.code === provinceCode);
    const ward = province?.wards.find((w) => w.code === wardCode);
    const fullAddress = [line1, ward?.name || "", province?.name || "", "Việt Nam"].filter(Boolean).join(", ").replace(/,\s*,/g, ",").trim();

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
        shippingFee: checkoutSummary.shippingFee,
        voucherCode: checkoutSummary.voucherSummary?.status === "success" ? checkoutSummary.voucherSummary.code : null,
        note
      });

      if (checkoutSummary.checkoutMode === "buy_now") {
        clearBuyNowCheckout();
      } else {
        layoutState.cart = createEmptyCart();
        renderHeader();
      }
      showCheckoutSuccessModal(response?.order?.orderCode || response?.order?.id || "ĐƠN HÀNG", paymentMethod);
      showCustomerToast("Đặt hàng thành công.", "success");
    } catch (error) {
      showCustomerToast(error?.message || "Đặt hàng thất bại.", "error");
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      submitButton.textContent = "Đặt hàng";
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

async function renderOrdersPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Đơn hàng", `<div class="customer-empty-state"><div class="customer-empty-icon">ðŸ”</div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem lịch sử đơn hàng.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
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
          <div class="customer-empty-icon">ðŸ§¾</div>
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
        <div class="customer-empty-icon">⚠️</div>
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
    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `<div class="customer-empty-state"><div class="customer-empty-icon">ðŸ”</div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem chi tiết đơn hàng.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
    return;
  }

  if (!orderId) {
    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `<div class="customer-empty-state"><div class="customer-empty-icon">ðŸ§¾</div><h2>Không tìm thấy đơn hàng</h2><p>Vui lòng quay lại danh sách đơn hàng để chọn mã đơn.</p><a class="customer-button secondary" href="#orders">Quay lại đơn hàng</a></div>`);
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
    const canCancel = ["pending", "confirmed", "processing"].includes(String(order.status || "").toLowerCase());

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
                ${canCancel ? '<button class="customer-button secondary" type="button" disabled>Hủy đơn</button>' : ""}
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
                <div class="customer-order-summary-row"><span>Thuế</span><strong>${formatCurrency(order.taxTotal || 0)}</strong></div>
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
  } catch (error) {
    layoutState.main.innerHTML = renderPageShell("Chi tiết đơn hàng", `
      <div class="customer-empty-state">
        <div class="customer-empty-icon">⚠️</div>
        <h2>Không thể tải đơn hàng</h2>
        <p>${escapeHtml(error?.message || "Đã xảy ra lỗi khi tải chi tiết đơn hàng.")}</p>
        <div class="customer-order-actions">
          <a class="customer-button secondary" href="#orders">Quay lại đơn hàng</a>
        </div>
      </div>
    `);
  }
}

function renderProfilePage() {
  const user = customerAuth.getUser();
  layoutState.main.innerHTML = renderPageShell("Hồ sơ", `
    <div style="display:grid;gap:8px;max-width:420px;">
      <p><strong>Họ tên:</strong> ${escapeHtml(user?.fullName || user?.name || "")}</p>
      <p><strong>Email:</strong> ${escapeHtml(user?.email || "")}</p>
      <p><strong>Số điện thoại:</strong> ${escapeHtml(user?.phone || "")}</p>
      <a class="customer-button secondary" href="#orders">Xem đơn hàng</a>
    </div>
  `);
}

async function renderWishlistPage() {
  if (!customerAuth.isAuthenticated()) {
    layoutState.main.innerHTML = renderPageShell("Yêu thích", `<div class="customer-empty-state"><div class="customer-empty-icon">ðŸ”</div><h2>Vui lòng đăng nhập</h2><p>Đăng nhập để xem danh sách yêu thích của bạn.</p><a class="customer-button" href="#login">Đăng nhập</a></div>`);
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
    showCustomerToast(message, "error");
    return;
  }
  renderHeader();

  const wishlistItems = Array.isArray(layoutState.wishlistItems) ? layoutState.wishlistItems : [];
  if (!wishlistItems.length) {
    layoutState.main.innerHTML = renderPageShell("Yêu thích", `<div class="customer-empty-state"><div class="customer-empty-icon">ðŸ’–</div><h2>Danh sách yêu thích trống</h2><p>Chọn sản phẩm bạn yêu thích để lưu lại và xem sau.</p><a class="customer-button" href="#home">Tiếp tục mua sắm</a></div>`);
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
    showCustomerToast("Vui lòng đăng nhập để lưu sản phẩm yêu thích.", "error");
    return;
  }

  const isActive = layoutState.wishlistProductIds.has(String(productId));
  try {
    const url = `/wishlist/${encodeURIComponent(productId)}`;
    if (isActive) {
      await customerApi(url, { method: "DELETE" });
      showCustomerToast("Đã bỏ khỏi yêu thích", "success");
    } else {
      await customerApi(url, { method: "POST" });
      showCustomerToast("Đã thêm vào yêu thích", "success");
    }
    await refreshWishlist();
    renderHeader();
    syncWishlistToggleButtons();
    if (currentRoute === 'wishlist') {
      await renderWishlistPage();
    }
  } catch (error) {
    showCustomerToast(error?.message || "Đã xảy ra lỗi khi cập nhật yêu thích.", "error");
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
      showCustomerToast("Vui lòng chọn size/màu trước khi mua ngay.", "warning");
      navigateToRoute(`product-detail/${encodeURIComponent(productId)}`);
      return;
    }

    const stock = Number(detail.stock ?? button.dataset.productStock ?? 0);
    if (stock <= 0) {
      showCustomerToast("Sản phẩm này đã hết hàng.", "warning");
      return;
    }

    startBuyNowCheckout(createProductCardBuyNowItem(detail, button));
  } catch (error) {
    showCustomerToast(error?.message || "Không thể mua ngay sản phẩm này. Vui lòng thử lại.", "error");
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

function startBuyNowCheckout(item) {
  try {
    const payload = { mode: "buy_now", items: [item], created_at: Date.now() };
    sessionStorage.setItem("buy_now_checkout", JSON.stringify(payload));
    navigateToRoute("checkout?mode=buy-now");
  } catch {
    showCustomerToast("Không thể khởi tạo thanh toán ngay. Vui lòng thử lại.", "error");
  }
}

function readBuyNowCheckout() {
  try {
    const payload = JSON.parse(sessionStorage.getItem("buy_now_checkout") || "null");
    if (payload?.mode !== "buy_now" || !Array.isArray(payload.items) || payload.items.length !== 1) return null;
    return payload;
  } catch {
    clearBuyNowCheckout();
    return null;
  }
}

function clearBuyNowCheckout() {
  try { sessionStorage.removeItem("buy_now_checkout"); } catch {}
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
    showCustomerToast("Vui lòng đăng nhập trước khi thêm vào giỏ hàng.", "error");
    navigateToRoute('login');
    return;
  }

  try {
    await customerCart.addItem(payload);
    await refreshCart();
    renderHeader();
    showCustomerToast("Đã thêm vào giỏ hàng.", "success");
  } catch (error) {
    showCustomerToast(getCartErrorMessage(error), "error");
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
  return ['home','login','register','phone-login','auth-callback','profile','orders','checkout','cart','wishlist','product-detail'].includes(route) || route.startsWith('orders/');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function resolveAssetUrl(url) {
  if (!url) return FALLBACK_PRODUCT_IMAGE;
  return globalThis.normalizeImageUrl?.(url) ?? url;
}


const CHECKOUT_PAYMENT_ICON_MAP = Object.freeze({
  cod: { icon: "fa-box-open", label: "Thanh toán khi nhận hàng" },
  bank_transfer: { icon: "fa-building-columns", label: "Chuyển khoản ngân hàng" },
  vnpay: { icon: "fa-credit-card", label: "VNPay" },
  momo: { icon: "fa-wallet", label: "MoMo" }
});

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
  if (card.querySelector(".checkout-payment-card-icon")) return;
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
    .replace(/ðŸ[\s\S]?/g, "")
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
    .password-input-wrapper{position:relative;display:inline-block;width:100%}
    .password-input-wrapper input{padding-right:44px;box-sizing:border-box}
    .password-toggle-button{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;font-size:16px;padding:6px;line-height:1}
    .password-toggle-button:focus{outline:2px solid rgba(59,130,246,0.25);border-radius:6px}
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
    btn.textContent = 'Hiện';
    wrapper.appendChild(btn);

    btn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Ẩn';
        btn.title = 'Ẩn mật khẩu';
        btn.setAttribute('aria-label', 'Ẩn mật khẩu');
      } else {
        input.type = 'password';
        btn.textContent = 'Hiện';
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
    console.debug('[password-toggle] observer setup failed', e?.message);
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













