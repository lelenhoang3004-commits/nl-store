import { toast } from "../components/toast/toast.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { apiClient } from "../services/api/index.js";
import { API_CONFIG } from "../services/api/api.config.js";
import { orderService } from "../services/order.service.js";
import { refreshAdminSidebarCounts } from "../components/sidebar/sidebar.js";

const API_ORIGIN = new URL(API_CONFIG.baseURL).origin;
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23eef2f7'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%2364748b' font-size='13'%3EKhÃ´ng cÃ³ áº£nh%3C/text%3E%3C/svg%3E";
const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortDirection: "desc" });
const STATUS_TRANSITIONS = Object.freeze({
  pending: ["confirmed"],
  confirmed: ["processing"],
  processing: ["shipping"],
  shipping: ["completed"],
  completed: [],
  cancelled: [],
  refunded: []
});

let listState = { orders: [], pagination: null, query: { ...DEFAULT_QUERY }, error: null };
let detailState = null;
let detailLoadError = null;

export async function createOrdersPage({ route }) {
  const orderId = route.params?.id;
  if (orderId) {
    try {
      detailLoadError = null;
      detailState = await loadOrderDetail(orderId);
      return renderOrderDetail(detailState);
    } catch (error) {
      detailLoadError = error;
      return renderErrorState(error);
    }
  }

  const template = await loadTemplate(new URL("./index.html", import.meta.url));
  try {
    await fetchOrders();
  } catch (error) {
    listState.error = error;
  }
  return template;
}

export function initOrdersPage(root, route) {
  if (route.params?.id) {
    if (detailLoadError) return bindErrorRetry(root, () => refreshOrderDetail(root, route.params.id));
    return initOrderDetail(root, route.params.id);
  }
  hydrateFilters(root);
  renderOrderRows(root);
  bindListEvents(root);
}

function hydrateFilters(root) {
  const form = root.querySelector("[data-order-filters]");
  if (!form) return;
  ["search", "status", "paymentStatus", "paymentMethod"].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = listState.query[name] || "";
  });
}

async function loadOrderDetail(orderId) {
  const [detailResponse, paymentsResponse] = await Promise.all([
    orderService.getById(orderId, silentErrors()),
    orderService.getPayments(orderId, silentErrors())
  ]);
  const detail = detailResponse.data || {};
  const payments = paymentsResponse.data?.payments || detail.payments || (detail.payment ? [detail.payment] : []);
  return { ...detail, payments, payment: payments[0] || detail.payment || null };
}

function bindListEvents(root) {
  const form = root.querySelector("[data-order-filters]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    listState.query = {
      ...listState.query,
      page: 1,
      search: String(data.get("search") || "").trim(),
      status: data.get("status"),
      paymentStatus: data.get("paymentStatus"),
      paymentMethod: data.get("paymentMethod")
    };
    await reloadList(root);
  });

  root.querySelector("[data-order-reset]")?.addEventListener("click", async () => {
    form?.reset();
    listState.query = { ...DEFAULT_QUERY };
    await reloadList(root);
  });

  root.addEventListener("click", async (event) => {
    const pageButton = event.target.closest("[data-order-page]");
    if (pageButton && !pageButton.disabled) {
      listState.query.page = Number(pageButton.dataset.orderPage);
      await reloadList(root);
      return;
    }
    if (event.target.closest("[data-order-retry]")) {
      await reloadList(root);
      return;
    }
    const cancelButton = event.target.closest("[data-order-cancel]");
    if (cancelButton) openCancelModal(cancelButton.dataset.orderCancel, () => reloadList(root));
  });
}

async function fetchOrders() {
  const response = await orderService.list(listState.query, silentErrors());
  listState.orders = response.data?.orders || [];
  listState.pagination = response.meta?.pagination || response.data?.pagination || null;
  listState.error = null;
}

async function reloadList(root) {
  setBusy(root, true);
  try {
    await fetchOrders();
  } catch (error) {
    listState.error = error;
    toast.error(getErrorMessage(error));
  } finally {
    renderOrderRows(root);
    setBusy(root, false);
  }
}

function renderOrderRows(root) {
  const body = root.querySelector("[data-order-rows]");
  if (!body) return;
  if (listState.error) {
    body.innerHTML = `<tr><td colspan="9">${renderInlineError(listState.error)}</td></tr>`;
    renderPagination(root);
    return;
  }

  body.innerHTML = listState.orders.length
    ? listState.orders.map((order) => `
      <tr>
        <td><a href="#orders/${order.id}" data-page="orders/${order.id}"><strong>${escapeHtml(order.orderCode)}</strong></a></td>
        <td>${escapeHtml(order.customerName || "â€”")}</td>
        <td>${escapeHtml(order.customerPhone || "â€”")}</td>
        <td><strong>${formatCurrency(order.grandTotal)}</strong></td>
        <td>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</td>
        <td>${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</td>
        <td>${badge(orderStatusLabel(order.status), order.status)}</td>
        <td>${formatDate(order.createdAt)}</td>
        <td><div class="admin-order-actions">
          <a href="#orders/${order.id}" data-page="orders/${order.id}">Xem chi tiáº¿t</a>
          ${hasPermission(PERMISSIONS.ORDER_MANAGE) && STATUS_TRANSITIONS[order.status]?.length ? `<a href="#orders/${order.id}" data-page="orders/${order.id}">Cáº­p nháº­t tráº¡ng thÃ¡i</a>` : ""}
          ${canCancel(order) && hasPermission(PERMISSIONS.ORDER_CANCEL) ? `<button type="button" data-order-cancel="${order.id}">Há»§y Ä‘Æ¡n</button>` : ""}
        </div></td>
      </tr>`).join("")
    : '<tr><td colspan="9" class="admin-order-empty">KhÃ´ng cÃ³ Ä‘Æ¡n hÃ ng phÃ¹ há»£p.</td></tr>';
  renderPagination(root);
}

function renderPagination(root) {
  const target = root.querySelector("[data-order-pagination]");
  const pagination = listState.pagination;
  if (!target) return;
  if (!pagination || listState.error) {
    target.innerHTML = "";
    return;
  }
  const page = Number(pagination.page || pagination.currentPage || 1);
  const totalPages = Math.max(Number(pagination.totalPages || 1), 1);
  const hasPrevious = pagination.hasPreviousPage ?? page > 1;
  const hasNext = pagination.hasNextPage ?? page < totalPages;
  target.innerHTML = `<span>Trang ${page}/${totalPages} Â· ${Number(pagination.totalItems || 0)} Ä‘Æ¡n hÃ ng</span><div><button type="button" data-order-page="${page - 1}" ${hasPrevious ? "" : "disabled"}>TrÆ°á»›c</button><button type="button" data-order-page="${page + 1}" ${hasNext ? "" : "disabled"}>Sau</button></div>`;
}

function renderOrderDetail(detail) {
  const { order, items = [], payments = [], histories = [] } = detail;
  const shipping = order.shippingAddress || {};
  const allowedNext = STATUS_TRANSITIONS[order.status] || [];
  const canManage = hasPermission(PERMISSIONS.ORDER_MANAGE);
  return `
    <section class="admin-order-detail" data-admin-order-detail="${order.id}">
      <div class="admin-orders-hero admin-order-detail-header">
        <div><p class="admin-orders-eyebrow">Chi tiáº¿t Ä‘Æ¡n hÃ ng</p><h1>${escapeHtml(order.orderCode)}</h1><p>Táº¡o lÃºc ${formatDate(order.createdAt)}</p><div class="admin-order-header-badges">${badge(orderStatusLabel(order.status), order.status)}${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</div></div>
        <a class="admin-order-back" href="#orders" data-page="orders"><i class="fa-solid fa-arrow-left"></i> Danh sÃ¡ch</a>
      </div>
      <div class="admin-order-detail-grid">
        <div class="admin-order-detail-main">
          <article class="admin-order-card admin-order-info"><h2>ThÃ´ng tin khÃ¡ch hÃ ng</h2><div class="admin-order-info-grid"><p><span>TÃªn khÃ¡ch hÃ ng</span><strong>${escapeHtml(order.customerName || "â€”")}</strong></p><p><span>Email</span><strong>${escapeHtml(order.customerEmail || "â€”")}</strong></p><p><span>Sá»‘ Ä‘iá»‡n thoáº¡i</span><strong>${escapeHtml(order.customerPhone || "â€”")}</strong></p></div></article>
          ${renderShippingCard(shipping, order)}
          <article class="admin-order-card"><h2>Sáº£n pháº©m trong Ä‘Æ¡n</h2><div class="admin-order-items">${items.length ? items.map(renderOrderItem).join("") : '<p class="admin-order-empty">ÄÆ¡n hÃ ng chÆ°a cÃ³ sáº£n pháº©m.</p>'}</div></article>
          <article class="admin-order-card"><h2>Lá»‹ch sá»­ Ä‘Æ¡n hÃ ng</h2><div class="admin-order-history">${histories.length ? histories.map(renderHistory).join("") : '<p class="admin-order-empty">ChÆ°a cÃ³ lá»‹ch sá»­ tráº¡ng thÃ¡i.</p>'}</div></article>
        </div>
        <aside class="admin-order-detail-side">
          <article class="admin-order-card" id="order-status-actions"><h2>Cáº­p nháº­t tráº¡ng thÃ¡i</h2>${canManage && allowedNext.length ? `<form data-order-status-form><select name="status" aria-label="Tráº¡ng thÃ¡i tiáº¿p theo">${allowedNext.map((status) => `<option value="${status}">${orderStatusLabel(status)}</option>`).join("")}</select><textarea name="note" maxlength="500" placeholder="Ghi chÃº cáº­p nháº­t"></textarea><button type="submit">Cáº­p nháº­t</button></form>` : '<p>KhÃ´ng cÃ²n bÆ°á»›c chuyá»ƒn tráº¡ng thÃ¡i há»£p lá»‡.</p>'}${canCancel(order) && hasPermission(PERMISSIONS.ORDER_CANCEL) ? '<button class="admin-order-danger" type="button" data-detail-cancel>Há»§y Ä‘Æ¡n hÃ ng</button>' : ""}</article>
          ${renderPaymentSummary(order)}
          <article class="admin-order-card"><h2>Giao dá»‹ch thanh toÃ¡n</h2>${payments.length ? payments.map((payment) => renderPayment(payment, order.paymentStatus)).join("") : '<p>ChÆ°a cÃ³ giao dá»‹ch thanh toÃ¡n</p>'}</article>
        </aside>
      </div>
    </section>`;
}

function renderShippingCard(shipping, order) {
  const receiverName = shipping.receiver_name || shipping.receiverName || shipping.fullName || order.customerName || "â€”";
  const receiverPhone = shipping.receiver_phone || shipping.receiverPhone || shipping.phone || order.customerPhone || "â€”";
  const detailAddress = shipping.detail_address || shipping.detailAddress || shipping.address || shipping.line1 || "â€”";
  const ward = shipping.ward_name || shipping.wardName || shipping.ward || "â€”";
  const province = shipping.province_name || shipping.provinceName || shipping.province || shipping.city || "â€”";
  return `<article class="admin-order-card admin-order-info"><h2>ThÃ´ng tin giao hÃ ng</h2><div class="admin-order-info-grid"><p><span>NgÆ°á»i nháº­n</span><strong>${escapeHtml(receiverName)}</strong></p><p><span>Äiá»‡n thoáº¡i nháº­n hÃ ng</span><strong>${escapeHtml(receiverPhone)}</strong></p><p><span>Äá»‹a chá»‰ chi tiáº¿t</span><strong>${escapeHtml(detailAddress)}</strong></p><p><span>PhÆ°á»ng/XÃ£</span><strong>${escapeHtml(ward)}</strong></p><p><span>Tá»‰nh/ThÃ nh phá»‘</span><strong>${escapeHtml(province)}</strong></p></div><p class="admin-order-address"><span>Äá»‹a chá»‰ Ä‘áº§y Ä‘á»§</span><strong>${escapeHtml(formatAddress(shipping))}</strong></p></article>`;
}

function renderOrderItem(item) {
  const variants = [item.size || item.variantSize, item.color || item.variantColor].filter(Boolean);
  return `<div class="admin-order-item"><img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveImageUrl(item.productImageUrl))}" alt="${escapeHtml(item.productName || "Sáº£n pháº©m")}" loading="lazy" decoding="async" data-product-image data-order-product-image><div><strong>${escapeHtml(item.productName || "â€”")}</strong><span>SKU: ${escapeHtml(item.productSku || "â€”")}</span>${variants.length ? `<span>Size / MÃ u: ${escapeHtml(variants.join(" / "))}</span>` : ""}<span>Sá»‘ lÆ°á»£ng: ${Number(item.quantity || 0)}</span><span>ÄÆ¡n giÃ¡: ${formatCurrency(item.unitPrice)}</span></div><strong>${formatCurrency(item.totalPrice)}</strong></div>`;
}

function renderHistory(entry) {
  return `<div><span></span><p><strong>${escapeHtml(orderStatusLabel(entry.status))}</strong><small>${escapeHtml(entry.note || "Cáº­p nháº­t tráº¡ng thÃ¡i")}</small><small>NgÆ°á»i cáº­p nháº­t: ${entry.changedBy ? `#${escapeHtml(entry.changedBy)}` : "Há»‡ thá»‘ng"}</small><time>${formatDate(entry.createdAt)}</time></p></div>`;
}

function renderPaymentSummary(order) {
  return `<article class="admin-order-card"><h2>TÃ³m táº¯t thanh toÃ¡n</h2><div class="admin-order-money"><p><span>Táº¡m tÃ­nh</span><strong>${formatCurrency(order.subtotal)}</strong></p><p><span>Giáº£m giÃ¡</span><strong>${formatCurrency(order.discountTotal)}</strong></p><p><span>PhÃ­ váº­n chuyá»ƒn</span><strong>${formatCurrency(order.shippingFee)}</strong></p><p><span>Thuáº¿</span><strong>${formatCurrency(order.taxTotal)}</strong></p><p><span>PhÆ°Æ¡ng thá»©c</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></p><p><span>Tráº¡ng thÃ¡i</span>${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</p><p><span>ÄÃ£ thanh toÃ¡n</span><strong>${formatCurrency(order.paidAmount)}</strong></p><p class="total"><span>Tá»•ng tiá»n</span><strong>${formatCurrency(order.grandTotal)}</strong></p></div></article>`;
}

function renderPayment(payment, orderPaymentStatus) {
  const method = String(payment.method || "").toLowerCase();
  const guide = payment.metadata?.paymentGuide || {};
  const providerCode = String(payment.provider || guide.provider || "").toUpperCase();
  const isPersonalMomo = providerCode === "MOMO_PERSONAL_QR";
  const isPersonalBank = providerCode === "BANK_PERSONAL_QR";
  const isManualConfirmable = method === "bank_transfer" || isPersonalMomo || isPersonalBank;
  const canConfirm = hasPermission(PERMISSIONS.PAYMENT_MANAGE) && isManualConfirmable && payment.status !== "paid" && orderPaymentStatus !== "paid";
  const extra = method === "bank_transfer"
    ? `<p><span>Noi dung chuyen khoan</span><strong>${escapeHtml(guide.transferContent || "?")}</strong></p><p><span>Khach bao luc</span><strong>${escapeHtml(payment.metadata?.customerReportedPaymentAt || "?")}</strong></p>`
    : isPersonalMomo
      ? `<p><span>Noi dung MoMo</span><strong>${escapeHtml(guide.transferContent || "?")}</strong></p>`
      : method === "credit_card"
        ? `<p><span>Card brand / last4</span><strong>${escapeHtml([guide.cardBrand, guide.cardLast4].filter(Boolean).join(" / ") || "?")}</strong></p>`
        : "";
  return `<div class="admin-order-payment"><p><span>Ma giao dich</span><strong>${escapeHtml(payment.transactionCode || "?")}</strong></p><p><span>Provider</span><strong>${escapeHtml(payment.provider || "?")}</strong></p><p><span>Phuong thuc</span><strong>${escapeHtml(paymentMethodLabel(payment.method))}</strong></p>${extra}<p><span>So tien</span><strong>${formatCurrency(payment.amount)}</strong></p><p><span>Trang thai</span>${badge(paymentStatusLabel(payment.status), payment.status)}</p><p><span>Ngay thanh toan</span><strong>${payment.paidAt ? formatDate(payment.paidAt) : "?"}</strong></p>${canConfirm ? `<button type="button" data-confirm-payment="${payment.id}">${isPersonalMomo || isPersonalBank ? "Xac nhan da nhan tien" : "Xac nhan chuyen khoan"}</button>` : ""}</div>`;
}

function initOrderDetail(root, orderId) {
  bindProductImageFallback(root);
  root.querySelector("[data-order-status-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(form, true);
    try {
      await orderService.updateStatus(orderId, { status: data.get("status"), note: String(data.get("note") || "").trim() }, silentErrors());
      toast.success("ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng.");
      await refreshOrderDetail(root, orderId);
      refreshAdminSidebarCounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBusy(form, false);
    }
  });

  root.querySelector("[data-detail-cancel]")?.addEventListener("click", () => openCancelModal(orderId, () => refreshOrderDetail(root, orderId)));
  root.querySelectorAll("[data-confirm-payment]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await apiClient.patch(`/payments/${button.dataset.confirmPayment}/status`, { status: "paid" }, silentErrors());
      toast.success("ÄÃ£ xÃ¡c nháº­n thanh toÃ¡n.");
      await refreshOrderDetail(root, orderId);
      refreshAdminSidebarCounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
      button.disabled = false;
    }
  }));
}

async function refreshOrderDetail(root, orderId) {
  setBusy(root, true);
  try {
    detailState = await loadOrderDetail(orderId);
    detailLoadError = null;
    root.innerHTML = renderOrderDetail(detailState);
    initOrderDetail(root, orderId);
  } catch (error) {
    detailLoadError = error;
    root.innerHTML = renderErrorState(error);
    bindErrorRetry(root, () => refreshOrderDetail(root, orderId));
    toast.error(getErrorMessage(error));
  } finally {
    setBusy(root, false);
  }
}

function openCancelModal(orderId, onSuccess) {
  closeCancelModal();
  const overlay = document.createElement("div");
  overlay.className = "admin-order-modal";
  overlay.dataset.orderCancelModal = "";
  overlay.innerHTML = `<section class="admin-order-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title"><header><div><p class="admin-orders-eyebrow">Order Management</p><h2 id="cancel-order-title">Há»§y Ä‘Æ¡n hÃ ng</h2></div><button type="button" aria-label="ÄÃ³ng" data-cancel-close>Ã—</button></header><form data-cancel-form><label><span>LÃ½ do há»§y</span><textarea name="reason" maxlength="500" required placeholder="Nháº­p lÃ½ do há»§y Ä‘Æ¡n...">KhÃ¡ch yÃªu cáº§u há»§y</textarea></label><small>Tá»‘i Ä‘a 500 kÃ½ tá»±. Tá»“n kho sáº½ Ä‘Æ°á»£c backend hoÃ n láº¡i trong transaction.</small><footer><button type="button" data-cancel-close>ÄÃ³ng</button><button type="submit" class="admin-order-danger">XÃ¡c nháº­n há»§y</button></footer></form></section>`;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  overlay.querySelectorAll("[data-cancel-close]").forEach((button) => button.addEventListener("click", closeCancelModal));
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeCancelModal(); });
  overlay.querySelector("[data-cancel-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") || "").trim();
    if (!reason) return toast.error("Vui lÃ²ng nháº­p lÃ½ do há»§y Ä‘Æ¡n.");
    setBusy(form, true);
    try {
      await orderService.cancel(orderId, { reason }, silentErrors());
      closeCancelModal();
      toast.success("ÄÃ£ há»§y Ä‘Æ¡n vÃ  hoÃ n láº¡i tá»“n kho.");
      await onSuccess?.();
      refreshAdminSidebarCounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBusy(form, false);
    }
  });
  overlay.querySelector("textarea")?.focus();
}

function closeCancelModal() { document.querySelector("[data-order-cancel-modal]")?.remove(); document.body.classList.remove("modal-open"); }
function bindProductImageFallback(root) { root.querySelectorAll("[data-order-product-image]").forEach((image) => image.addEventListener("error", () => { image.src = PLACEHOLDER_IMAGE; }, { once: true })); }
function bindErrorRetry(root, retry) { root.querySelector("[data-order-retry]")?.addEventListener("click", retry); }
function renderErrorState(error) { return `<section class="admin-order-error"><i class="fa-solid fa-circle-exclamation"></i><h1>KhÃ´ng thá»ƒ táº£i trang Ä‘Æ¡n hÃ ng</h1><p>${escapeHtml(getErrorMessage(error))}</p><div><a href="#orders" data-page="orders">Vá» danh sÃ¡ch</a><button type="button" data-order-retry>Thá»­ láº¡i</button></div></section>`; }
function renderInlineError(error) { return `<div class="admin-order-inline-error"><span>${escapeHtml(getErrorMessage(error))}</span><button type="button" data-order-retry>Thá»­ láº¡i</button></div>`; }
function getErrorMessage(error) {
  if (error?.status === 401) return "PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n, vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.";
  if (error?.status === 403) return "Báº¡n khÃ´ng cÃ³ quyá»n thá»±c hiá»‡n thao tÃ¡c nÃ y.";
  if (error?.status === 404) return "KhÃ´ng tÃ¬m tháº¥y Ä‘Æ¡n hÃ ng.";
  if (error?.status >= 500) return "Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.";
  return error?.message || "KhÃ´ng thá»ƒ xá»­ lÃ½ yÃªu cáº§u, vui lÃ²ng thá»­ láº¡i.";
}
function silentErrors() { return { showErrorToast: false }; }
function setBusy(root, busy) { root?.querySelectorAll?.("button, select, textarea, input").forEach((element) => { element.disabled = busy; }); }
function canCancel(order) { return ["pending", "confirmed"].includes(order.status); }
function badge(label, status) { return `<span class="admin-order-badge is-${escapeHtml(status || "neutral")}">${escapeHtml(label)}</span>`; }
function orderStatusLabel(status) { return ({ pending: "Chá» xÃ¡c nháº­n", confirmed: "ÄÃ£ xÃ¡c nháº­n", processing: "Äang xá»­ lÃ½", shipping: "Äang giao", completed: "HoÃ n thÃ nh", cancelled: "ÄÃ£ há»§y", refunded: "ÄÃ£ hoÃ n tiá»n" })[status] || status || "â€”"; }
function paymentStatusLabel(status) { return ({ unpaid: "ChÆ°a thanh toÃ¡n", pending: "Chá» thanh toÃ¡n", partial: "Thanh toÃ¡n má»™t pháº§n", paid: "ÄÃ£ thanh toÃ¡n", failed: "Thanh toÃ¡n tháº¥t báº¡i", refunded: "ÄÃ£ hoÃ n tiá»n", cancelled: "ÄÃ£ há»§y" })[status] || status || "â€”"; }
function paymentMethodLabel(method) {
  const value = String(method || "").toLowerCase();
  return ({ cod: "COD", bank_transfer: "Chuyá»ƒn khoáº£n", credit_card: "Tháº» tÃ­n dá»¥ng", vnpay: "VNPay", momo: "MoMo QR ca nhan" })[value] || method || "â€”";
}
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "â€”" : date.toLocaleString("vi-VN"); }
function formatAddress(address = {}) { return address.full_address || address.fullAddress || [address.detail_address || address.detailAddress || address.address || address.line1, address.ward_name || address.wardName || address.ward, address.province_name || address.provinceName || address.province || address.city, address.country].filter(Boolean).join(", ") || "ChÆ°a cáº­p nháº­t"; }
function resolveImageUrl(url) { if (!url) return PLACEHOLDER_IMAGE; return globalThis.normalizeImageUrl?.(url) ?? url; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

