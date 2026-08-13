import { notifyError, notifySuccess } from "../../assets/js/notify.js";
import { activateModalUX } from "../components/modal/modal-ux.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { paymentService } from "../services/payment.service.js";
import { refreshAdminSidebarCounts } from "../components/sidebar/sidebar.js";
import { formatPaymentMethod, formatPaymentStatus, normalizePaymentStatus } from "../utils/payment-formatters.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
let state = { payments: [], pagination: null, query: { ...DEFAULT_QUERY }, error: null, busy: false };
let activeModal = null;
let modalUxCleanup = null;

export async function createPaymentsPage() {
  const template = await loadTemplate(new URL("./index.html", import.meta.url));
  state.query = readQueryFromUrl();
  try { await fetchPayments(); } catch (error) { state.error = error; }
  return template;
}

export function initPaymentsPage(root) {
  hydrateFilters(root);
  renderRows(root);
  bindEvents(root);
  root.__cleanup = () => closeDetailModal();
  return root.__cleanup;
}

async function fetchPayments() {
  const response = await paymentService.list(state.query, silentErrors());
  state.payments = response.data?.payments || [];
  state.pagination = response.meta?.pagination || null;
  state.error = null;
}

function readQueryFromUrl() {
  const params = getPaymentsUrlSearchParams();
  return {
    ...DEFAULT_QUERY,
    search: String(params.get("search") || "").trim(),
    status: String(params.get("status") || ""),
    method: String(params.get("method") || ""),
    provider: String(params.get("provider") || ""),
    page: positiveInteger(params.get("page"), DEFAULT_QUERY.page),
    limit: positiveInteger(params.get("limit"), DEFAULT_QUERY.limit)
  };
}

function syncPaymentsQueryToUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  ["search", "status", "method", "provider"].forEach((name) => {
    const value = String(state.query[name] || "").trim();
    if (value) params.set(name, value);
  });
  params.set("page", String(positiveInteger(state.query.page, DEFAULT_QUERY.page)));
  params.set("limit", String(positiveInteger(state.query.limit, DEFAULT_QUERY.limit)));
  const routePath = getPaymentsRoutePath();
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${routePath}${query ? `?${query}` : ""}`);
}

function getPaymentsUrlSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = String(window.location.hash || "").replace(/^#/, "");
  const queryIndex = hash.indexOf("?");
  return new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : "");
}

function getPaymentsRoutePath() {
  if (typeof window === "undefined") return "payments";
  return String(window.location.hash || "#payments").replace(/^#/, "").split("?")[0] || "payments";
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function hydrateFilters(root) {
  const form = root.querySelector("[data-payment-filters]");
  if (!form) return;
  ["search", "status", "method", "provider"].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = state.query[name] || "";
  });
}

function bindEvents(root) {
  const form = root.querySelector("[data-payment-filters]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy) return;
    const data = new FormData(form);
    state.query = { ...state.query, page: 1, search: String(data.get("search") || "").trim(), status: String(data.get("status") || ""), method: String(data.get("method") || ""), provider: String(data.get("provider") || "") };
    syncPaymentsQueryToUrl();
    await reloadList(root);
  });

  root.querySelector("[data-payment-reset]")?.addEventListener("click", async () => {
    if (state.busy) return;
    form?.reset();
    state.query = { ...DEFAULT_QUERY };
    syncPaymentsQueryToUrl();
    await reloadList(root);
  });

  root.querySelector("[data-payment-refresh]")?.addEventListener("click", () => reloadList(root));

  root.addEventListener("click", async (event) => {
    const pageButton = event.target.closest("[data-payment-page]");
    if (pageButton && !pageButton.disabled && !state.busy) { state.query.page = Number(pageButton.dataset.paymentPage) || 1; syncPaymentsQueryToUrl(); await reloadList(root); return; }
    if (event.target.closest("[data-payment-retry]")) { await reloadList(root); return; }
    const detailButton = event.target.closest("[data-payment-detail]");
    if (detailButton && !state.busy) { await openDetailModal(root, detailButton.dataset.paymentDetail); return; }
    const statusButton = event.target.closest("[data-payment-status]");
    if (statusButton && !state.busy) await handleStatusAction(root, statusButton.dataset.paymentId, statusButton.dataset.paymentStatus);
  });
}

async function reloadList(root) {
  if (state.busy) return;
  setBusy(root, true);
  try { await fetchPayments(); } catch (error) { state.error = error; notifyError(getErrorMessage(error)); }
  finally { renderRows(root); setBusy(root, false); }
}

function renderRows(root) {
  const body = root.querySelector("[data-payment-rows]");
  if (!body) return;
  if (state.error) {
    body.innerHTML = `<tr><td colspan="11"><div class="admin-payment-error"><span>${escapeHtml(getErrorMessage(state.error))}</span><button type="button" data-payment-retry>Th\u1eed l\u1ea1i</button></div></td></tr>`;
    renderPagination(root);
    return;
  }
  body.innerHTML = state.payments.length ? state.payments.map(renderPaymentRow).join("") : '<tr><td colspan="11" class="admin-payment-empty">Kh\u00f4ng t\u00ecm th\u1ea5y giao d\u1ecbch ph\u00f9 h\u1ee3p</td></tr>';
  renderPagination(root);
}

function renderPaymentRow(payment) {
  return `<tr>
    <td><button type="button" class="admin-payment-link admin-payment-code" data-payment-detail="${numberId(payment.id)}" title="${escapeHtml(payment.transactionCode || "-")}"><strong>${escapeHtml(payment.transactionCode || "-")}</strong></button></td>
    <td>${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">${escapeHtml(payment.orderCode || `#${payment.orderId}`)}</a>` : "-"}</td>
    <td><strong>${escapeHtml(payment.customerName || "-")}</strong><small>${escapeHtml(payment.customerPhone || payment.customerEmail || "")}</small></td>
    <td><span class="admin-payment-provider" title="${escapeHtml(payment.provider || "-")}">${escapeHtml(formatProviderLabel(payment.provider))}</span></td>
    <td class="admin-payment-method-cell">${escapeHtml(getPaymentMethodLabel(resolvePaymentMethod(payment), payment.provider))}</td>
    <td><strong>${formatCurrency(payment.amount, payment.currency)}</strong></td>
    <td>${escapeHtml(payment.currency || "-")}</td>
    <td class="admin-payment-status-cell">${statusBadge(payment.status)}</td>
    <td class="admin-payment-date">${formatCompactDate(payment.paidAt)}</td>
    <td class="admin-payment-date">${formatCompactDate(payment.createdAt)}</td>
    <td>${renderActions(payment)}</td>
  </tr>`;
}

function renderActions(payment, modal = false) {
  const canManage = hasPermission(PERMISSIONS.PAYMENT_MANAGE);
  const status = normalizePaymentStatus(payment.status);
  const classes = modal ? "admin-payment-modal-actions" : "admin-payment-actions admin-row-actions";
  if (modal) {
    return `<div class="${classes}">
      ${canManage && canConfirmManualPayment(payment) ? actionButton(payment.id, "paid", "X&#225;c nh&#7853;n &#273;&#227; nh&#7853;n ti&#7873;n") : ""}
      ${canManage && status === "pending" ? actionButton(payment.id, "failed", "&#272;&#225;nh d&#7845;u th&#7845;t b&#7841;i") : ""}
      ${canManage && status === "paid" ? actionButton(payment.id, "refunded", "Ho&#224;n ti&#7873;n") : ""}
      ${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">Xem &#273;&#417;n h&#224;ng</a>` : ""}
    </div>`;
  }
  const menuActions = [
    canManage && canConfirmManualPayment(payment) ? actionButton(payment.id, "paid", "X&#225;c nh&#7853;n &#273;&#227; nh&#7853;n ti&#7873;n") : "",
    canManage && status === "pending" ? actionButton(payment.id, "failed", "&#272;&#225;nh d&#7845;u th&#7845;t b&#7841;i") : "",
    canManage && status === "paid" ? actionButton(payment.id, "refunded", "Ho&#224;n ti&#7873;n") : "",
    payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">Xem &#273;&#417;n h&#224;ng</a>` : ""
  ].filter(Boolean).join("");
  return `<div class="${classes}">
    <button type="button" class="admin-row-action is-primary-soft" data-payment-detail="${numberId(payment.id)}"><i class="fa-regular fa-eye" aria-hidden="true"></i><span>Chi ti&#7871;t</span></button>
    ${menuActions ? `<details class="admin-row-action-menu"><summary class="admin-row-action is-icon" aria-label="M&#7903; th&#234;m h&#224;nh &#273;&#7897;ng thanh to&#225;n"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></summary><div class="admin-row-action-menu-panel">${menuActions}</div></details>` : ""}
  </div>`;
}

function isMomoPayment(payment) { const provider = String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase(); const method = String(payment?.method || payment?.paymentMethod || "").toLowerCase(); return method === "momo" || provider === "MOMO" || provider === "MOMO_PERSONAL_QR"; }
function isPersonalBankPayment(payment) { return String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase() === "BANK_PERSONAL_QR"; }
function isManualConfirmablePayment(payment) { const method = String(payment?.method || payment?.paymentMethod || "").toLowerCase(); return method === "bank_transfer" || isPersonalBankPayment(payment) || isMomoPayment(payment); }
function canConfirmManualPayment(payment) { const status = normalizePaymentStatus(payment?.status); return isManualConfirmablePayment(payment) && ["pending", "processing"].includes(status); }
function resolvePaymentMethod(payment) { return payment?.method || payment?.paymentMethod || payment?.metadata?.paymentGuide?.provider || payment?.provider || ""; }
function getPaymentMethodLabel(method, provider) {
  const values = [method, provider].map((value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
  if (values.some((value) => ["bank_transfer", "bank_personal_qr", "bank_qr", "bank", "banking", "bank_transfer_qr"].includes(value))) return "Ngân hàng";
  if (values.some((value) => ["momo", "momo_personal_qr"].includes(value))) return "MoMo";
  if (values.some((value) => ["credit_card", "credit_card_demo", "card"].includes(value))) return "Thẻ tín dụng";
  if (values.some((value) => ["cod", "cash_on_delivery"].includes(value))) return "COD";
  return formatPaymentMethod(method || provider || "");
}
function actionButton(id, status, label) { return `<button type="button" data-payment-id="${numberId(id)}" data-payment-status="${status}">${label}</button>`; }

function renderPagination(root) {
  const target = root.querySelector("[data-payment-pagination]");
  if (!target) return;
  const pagination = state.pagination;
  if (!pagination || state.error) { target.innerHTML = ""; return; }
  const page = Number(pagination.page || 1);
  const totalPages = Math.max(Number(pagination.totalPages || 0), 1);
  const previous = pagination.hasPreviousPage ?? page > 1;
  const next = pagination.hasNextPage ?? page < totalPages;
  target.innerHTML = `<span>Trang ${page}/${totalPages} - ${Number(pagination.totalItems || 0)} giao d\u1ecbch</span><div><button type="button" data-payment-page="${page - 1}" ${previous ? "" : "disabled"}>Tr\u01b0\u1edbc</button><button type="button" data-payment-page="${page + 1}" ${next ? "" : "disabled"}>Sau</button></div>`;
}

async function openDetailModal(root, id) {
  closeDetailModal();
  const overlay = document.createElement("div");
  overlay.className = "admin-payment-modal";
  overlay.dataset.paymentModal = "";
  overlay.innerHTML = '<section class="admin-payment-modal-dialog" role="dialog" aria-modal="true" aria-label="\u0110ang t\u1ea3i chi ti\u1ebft thanh to\u00e1n" tabindex="-1"><div class="admin-payment-modal-loading">\u0110ang t\u1ea3i chi ti\u1ebft giao d\u1ecbch...</div></section>';
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  activeModal = overlay;
  modalUxCleanup = activateModalUX(overlay, { onClose: closeDetailModal });
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-payment-modal-close]")) closeDetailModal(); });

  try {
    const response = await paymentService.getById(id, silentErrors());
    if (activeModal !== overlay) return;
    renderDetailModal(root, overlay, response.data?.payment);
  } catch (error) {
    if (activeModal !== overlay) return;
    overlay.querySelector(".admin-payment-modal-dialog").innerHTML = `<header><h2>Chi ti\u1ebft giao d\u1ecbch</h2><button type="button" data-payment-modal-close aria-label="\u0110\u00f3ng">&times;</button></header><div class="admin-payment-modal-error"><p>${escapeHtml(getErrorMessage(error))}</p><button type="button" data-payment-modal-retry="${numberId(id)}">Th\u1eed l\u1ea1i</button></div>`;
    overlay.querySelector("[data-payment-modal-retry]")?.addEventListener("click", () => openDetailModal(root, id));
    notifyError(getErrorMessage(error));
  }
}

function renderDetailModal(root, overlay, payment) {
  if (!payment) return;
  overlay.dataset.paymentId = payment.id;
  const dialog = overlay.querySelector(".admin-payment-modal-dialog");
  dialog.setAttribute("aria-labelledby", "payment-modal-title");
  dialog.removeAttribute("aria-label");
  dialog.innerHTML = `
    <header class="admin-payment-modal-header"><div><h2 id="payment-modal-title" tabindex="-1">Chi ti\u1ebft thanh to\u00e1n</h2><p>Th\u00f4ng tin giao d\u1ecbch v\u00e0 \u0111\u01a1n h\u00e0ng li\u00ean quan</p></div><button type="button" data-payment-modal-close aria-label="\u0110\u00f3ng modal chi ti\u1ebft thanh to\u00e1n"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="admin-payment-modal-body">
      <section class="admin-payment-section admin-payment-transaction-section"><div class="admin-payment-section-title"><i class="fa-solid fa-credit-card" aria-hidden="true"></i><h3>Th\u00f4ng tin giao d\u1ecbch</h3></div><div class="admin-payment-info-grid">
        ${detailField("Payment ID", payment.id)}${detailField("M\u00e3 giao d\u1ecbch", payment.transactionCode, true)}
        ${detailField("Provider", payment.provider)}${detailField("Ph\u01b0\u01a1ng th\u1ee9c", formatPaymentMethod(resolvePaymentMethod(payment)))}
        <div class="admin-payment-info-item"><span>Tr\u1ea1ng th\u00e1i thanh to\u00e1n</span>${statusBadge(payment.status)}</div>
        ${detailField("S\u1ed1 ti\u1ec1n", formatCurrency(payment.amount, payment.currency), true)}${detailField("Ti\u1ec1n t\u1ec7", payment.currency)}
        ${detailField("Ng\u00e0y thanh to\u00e1n", formatDate(payment.paidAt))}${detailField("Ng\u00e0y t\u1ea1o", formatDate(payment.createdAt))}${detailField("Ng\u00e0y c\u1eadp nh\u1eadt", formatDate(payment.updatedAt))}
      </div></section>
      <div class="admin-payment-side-sections">
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><h3>Th\u00f4ng tin \u0111\u01a1n h\u00e0ng</h3></div><div class="admin-payment-info-grid is-compact">${detailField("Order ID", payment.orderId)}${detailField("M\u00e3 \u0111\u01a1n h\u00e0ng", payment.orderCode, true)}${detailField("Tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng", payment.orderStatus)}${detailField("T\u1ed5ng ti\u1ec1n \u0111\u01a1n", payment.orderTotal == null ? "-" : formatCurrency(payment.orderTotal, payment.currency))}</div>${payment.orderId ? `<a class="admin-payment-order-link" href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem \u0111\u01a1n h\u00e0ng</a>` : ""}</section>
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-user" aria-hidden="true"></i><h3>Th\u00f4ng tin kh\u00e1ch h\u00e0ng</h3></div><div class="admin-payment-info-grid is-compact">${detailField("H\u1ecd t\u00ean", payment.customerName, true)}${detailField("Email", payment.customerEmail)}${detailField("S\u1ed1 \u0111i\u1ec7n tho\u1ea1i", payment.customerPhone)}</div></section>
      </div>
    </div>
    <footer class="admin-payment-modal-footer">${renderActions(payment, true)}</footer>`;
  overlay.querySelectorAll("[data-payment-status]").forEach((button) => button.addEventListener("click", async () => { await handleStatusAction(root, button.dataset.paymentId, button.dataset.paymentStatus, true); }));
  requestAnimationFrame(() => overlay.querySelector("[data-payment-modal-close]")?.focus({ preventScroll: true }));
}

function detailField(label, value, prominent = false) { return `<div class="admin-payment-info-item ${prominent ? "is-prominent" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === null || value === undefined || value === "" ? "-" : value)}</strong></div>`; }

async function handleStatusAction(root, id, status, fromModal = false) {
  if (status === "paid") {
    const payment = await getPaymentForAction(id);
    if (!payment || !canConfirmManualPayment(payment)) {
      notifyError("Giao dịch này không đủ điều kiện xác nhận đã nhận tiền.");
      return;
    }
    const confirmed = await openPaymentConfirmDialog(payment);
    if (!confirmed) return;
    await updateStatus(root, id, status, fromModal, {
      note: isMomoPayment(payment)
        ? "Admin xác nhận thanh toán MoMo QR cá nhân."
        : "Admin xác nhận cửa hàng đã nhận tiền chuyển khoản.",
      confirmedSource: isMomoPayment(payment) ? "admin_momo_personal_qr" : "admin_manual_transfer"
    });
    return;
  }

  const messages = {
    failed: "Đánh dấu giao dịch thanh toán thất bại?",
    refunded: "Xác nhận hoàn tiền cho giao dịch này?"
  };
  if (!window.confirm(messages[status] || "Xác nhận cập nhật trạng thái?")) return;
  await updateStatus(root, id, status, fromModal);
}

async function getPaymentForAction(id) {
  const normalizedId = String(numberId(id));
  const localPayment = state.payments.find((payment) => String(payment.id) === normalizedId);
  if (localPayment) return localPayment;
  if (activeModal?.dataset.paymentId && String(activeModal.dataset.paymentId) === normalizedId) {
    const response = await paymentService.getById(id, silentErrors());
    return response.data?.payment || null;
  }
  const response = await paymentService.getById(id, silentErrors());
  return response.data?.payment || null;
}

function openPaymentConfirmDialog(payment) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "admin-payment-modal is-confirm";
    overlay.dataset.paymentConfirmModal = "";
    overlay.innerHTML = `
      <section class="admin-payment-modal-dialog admin-payment-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-confirm-title" tabindex="-1">
        <header class="admin-payment-modal-header">
          <div><h2 id="payment-confirm-title">Xác nhận thanh toán MoMo?</h2><p>Bạn đã kiểm tra và xác nhận cửa hàng đã nhận đúng số tiền của giao dịch này.</p></div>
          <button type="button" data-payment-confirm-cancel aria-label="Đóng"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div class="admin-payment-modal-body">
          <section class="admin-payment-section">
            <div class="admin-payment-info-grid is-compact">
              ${detailField("Mã đơn hàng", payment.orderCode || (payment.orderId ? `#${payment.orderId}` : "-"), true)}
              ${detailField("Mã giao dịch", payment.transactionCode || "-", true)}
              ${detailField("Khách hàng", payment.customerName || payment.customerEmail || payment.customerPhone || "-")}
              ${detailField("Số tiền", formatCurrency(payment.amount, payment.currency), true)}
              ${detailField("Phương thức", "MoMo")}
            </div>
          </section>
        </div>
        <footer class="admin-payment-modal-footer admin-payment-modal-actions">
          <button type="button" data-payment-confirm-cancel>Hủy</button>
          <button type="button" data-payment-confirm-ok>Xác nhận đã nhận tiền</button>
        </footer>
      </section>`;
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    const cleanup = activateModalUX(overlay, { onClose: () => close(false) });
    const close = (value) => {
      cleanup?.();
      overlay.remove();
      if (!activeModal) document.body.classList.remove("modal-open");
      resolve(value);
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-payment-confirm-cancel]")) close(false);
    });
    overlay.querySelector("[data-payment-confirm-ok]")?.addEventListener("click", (event) => {
      event.currentTarget.disabled = true;
      close(true);
    });
    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      overlay.querySelector("[data-payment-confirm-cancel]")?.focus({ preventScroll: true });
    });
  });
}

async function updateStatus(root, id, status, fromModal = false, payload = {}) {
  setBusy(root, true); setModalBusy(true);
  try {
    await paymentService.updateStatus(id, status, silentErrors(), payload);
    notifySuccess(status === "paid" ? "Đã xác nhận đã nhận tiền." : `Đã cập nhật trạng thái: ${formatPaymentStatus(status)}.`);
    await fetchPayments(); renderRows(root); refreshAdminSidebarCounts();
    if (fromModal && activeModal) { const response = await paymentService.getById(id, silentErrors()); if (activeModal) renderDetailModal(root, activeModal, response.data?.payment); }
  } catch (error) { notifyError(getErrorMessage(error)); }
  finally { setBusy(root, false); setModalBusy(false); }
}
function closeDetailModal() { modalUxCleanup?.(); modalUxCleanup = null; activeModal?.remove(); activeModal = null; document.body.classList.remove("modal-open"); }
function setBusy(root, busy) { state.busy = busy; root?.querySelectorAll?.("button, input, select").forEach((element) => { element.disabled = busy; }); }
function setModalBusy(busy) { activeModal?.querySelectorAll?.("button").forEach((element) => { element.disabled = busy; }); }
function statusBadge(status) { const normalized = normalizePaymentStatus(status); return `<span class="admin-payment-badge is-${escapeHtml(normalized || "unknown")}">${escapeHtml(formatPaymentStatus(status))}</span>`; }
function formatProviderLabel(provider) {
  const key = String(provider || "").trim().toUpperCase();
  return ({ MOMO_PERSONAL_QR: "MoMo QR", "MOMO QR": "MoMo QR", BANK_PERSONAL_QR: "Ng\u00e2n h\u00e0ng QR", BANK_QR: "Ng\u00e2n h\u00e0ng QR", BANK_TRANSFER_QR: "Ng\u00e2n h\u00e0ng QR", "CHUY\u1ec2N KHO\u1ea2N QR": "Ng\u00e2n h\u00e0ng QR", COD: "COD", CREDIT_CARD: "Th\u1ebb t\u00edn d\u1ee5ng", CREDIT_CARD_DEMO: "Th\u1ebb t\u00edn d\u1ee5ng", CARD: "Th\u1ebb t\u00edn d\u1ee5ng", MOMO: "MoMo" })[key] || provider || "-";
}
function formatCompactDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `<span>${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span><small>${date.toLocaleDateString("vi-VN")}</small>`;
}
function formatCurrency(value, currency = "VND") { try { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); } catch { return `${Number(value || 0).toLocaleString("vi-VN")} ${currency || ""}`.trim(); } }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); }
function numberId(value) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : ""; }
function silentErrors() { return { showErrorToast: false }; }
function getErrorMessage(error) { if (error?.status === 401) return "Phi\u00ean \u0111\u0103ng nh\u1eadp h\u1ebft h\u1ea1n, vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i."; if (error?.status === 403) return "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n truy c\u1eadp qu\u1ea3n l\u00fd thanh to\u00e1n."; if (error?.status === 404) return "Kh\u00f4ng t\u00ecm th\u1ea5y giao d\u1ecbch thanh to\u00e1n."; if (error?.status >= 500) return "L\u1ed7i h\u1ec7 th\u1ed1ng, vui l\u00f2ng th\u1eed l\u1ea1i."; return error?.message || "Kh\u00f4ng th\u1ec3 x\u1eed l\u00fd y\u00eau c\u1ea7u thanh to\u00e1n, vui l\u00f2ng th\u1eed l\u1ea1i."; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

