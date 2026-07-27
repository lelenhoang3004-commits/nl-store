import { toast } from "../components/toast/toast.js";
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
    await reloadList(root);
  });

  root.querySelector("[data-payment-reset]")?.addEventListener("click", async () => {
    if (state.busy) return;
    form?.reset();
    state.query = { ...DEFAULT_QUERY };
    await reloadList(root);
  });

  root.querySelector("[data-payment-refresh]")?.addEventListener("click", () => reloadList(root));

  root.addEventListener("click", async (event) => {
    const pageButton = event.target.closest("[data-payment-page]");
    if (pageButton && !pageButton.disabled && !state.busy) { state.query.page = Number(pageButton.dataset.paymentPage); await reloadList(root); return; }
    if (event.target.closest("[data-payment-retry]")) { await reloadList(root); return; }
    const detailButton = event.target.closest("[data-payment-detail]");
    if (detailButton && !state.busy) { await openDetailModal(root, detailButton.dataset.paymentDetail); return; }
    const statusButton = event.target.closest("[data-payment-status]");
    if (statusButton && !state.busy) await updateStatus(root, statusButton.dataset.paymentId, statusButton.dataset.paymentStatus);
  });
}

async function reloadList(root) {
  if (state.busy) return;
  setBusy(root, true);
  try { await fetchPayments(); } catch (error) { state.error = error; toast.error(getErrorMessage(error)); }
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
  body.innerHTML = state.payments.length ? state.payments.map(renderPaymentRow).join("") : '<tr><td colspan="11" class="admin-payment-empty">Kh\u00f4ng c\u00f3 giao d\u1ecbch thanh to\u00e1n ph\u00f9 h\u1ee3p.</td></tr>';
  renderPagination(root);
}

function renderPaymentRow(payment) {
  return `<tr>
    <td><button type="button" class="admin-payment-link" data-payment-detail="${numberId(payment.id)}"><strong>${escapeHtml(payment.transactionCode || "-")}</strong></button></td>
    <td>${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">${escapeHtml(payment.orderCode || `#${payment.orderId}`)}</a>` : "-"}</td>
    <td><strong>${escapeHtml(payment.customerName || "-")}</strong><small>${escapeHtml(payment.customerPhone || payment.customerEmail || "")}</small></td>
    <td>${escapeHtml(payment.provider || "-")}</td>
    <td class="admin-payment-method-cell">${escapeHtml(formatPaymentMethod(resolvePaymentMethod(payment)))}</td>
    <td><strong>${formatCurrency(payment.amount, payment.currency)}</strong></td>
    <td>${escapeHtml(payment.currency || "-")}</td>
    <td class="admin-payment-status-cell">${statusBadge(payment.status)}</td>
    <td>${formatDate(payment.paidAt)}</td>
    <td>${formatDate(payment.createdAt)}</td>
    <td>${renderActions(payment)}</td>
  </tr>`;
}

function renderActions(payment, modal = false) {
  const canManage = hasPermission(PERMISSIONS.PAYMENT_MANAGE);
  const status = normalizePaymentStatus(payment.status);
  const classes = modal ? "admin-payment-modal-actions" : "admin-payment-actions";
  return `<div class="${classes}">
    ${modal ? "" : `<button type="button" data-payment-detail="${numberId(payment.id)}">Chi ti\u1ebft</button>`}
    ${canManage && ["pending", "processing", "failed"].includes(status) ? actionButton(payment.id, "paid", (isPersonalMomoPayment(payment) || isPersonalBankPayment(payment)) ? "X\u00e1c nh\u1eadn \u0111\u00e3 nh\u1eadn ti\u1ec1n" : "X\u00e1c nh\u1eadn \u0111\u00e3 thanh to\u00e1n") : ""}
    ${canManage && status === "pending" ? actionButton(payment.id, "failed", "\u0110\u00e1nh d\u1ea5u th\u1ea5t b\u1ea1i") : ""}
    ${canManage && status === "paid" ? actionButton(payment.id, "refunded", "Ho\u00e0n ti\u1ec1n") : ""}
    ${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">Xem \u0111\u01a1n h\u00e0ng</a>` : ""}
  </div>`;
}

function isPersonalMomoPayment(payment) { return String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase() === "MOMO_PERSONAL_QR"; }
function isPersonalBankPayment(payment) { return String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase() === "BANK_PERSONAL_QR"; }
function resolvePaymentMethod(payment) { return payment?.method || payment?.paymentMethod || payment?.metadata?.paymentGuide?.provider || payment?.provider || ""; }
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
    toast.error(getErrorMessage(error));
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
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-code" aria-hidden="true"></i><h3>Metadata / Ghi ch\u00fa</h3></div><div class="admin-payment-metadata">${payment.metadata ? `<pre>${escapeHtml(formatMetadata(payment.metadata))}</pre>` : "<p>Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u b\u1ed5 sung</p>"}</div></section>
      </div>
    </div>
    <footer class="admin-payment-modal-footer">${renderActions(payment, true)}</footer>`;
  overlay.querySelectorAll("[data-payment-status]").forEach((button) => button.addEventListener("click", async () => { await updateStatus(root, button.dataset.paymentId, button.dataset.paymentStatus, true); }));
  requestAnimationFrame(() => overlay.querySelector("[data-payment-modal-close]")?.focus({ preventScroll: true }));
}

function detailField(label, value, prominent = false) { return `<div class="admin-payment-info-item ${prominent ? "is-prominent" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === null || value === undefined || value === "" ? "-" : value)}</strong></div>`; }

async function updateStatus(root, id, status, fromModal = false) {
  const messages = { paid: "X\u00e1c nh\u1eadn giao d\u1ecbch \u0111\u00e3 \u0111\u01b0\u1ee3c thanh to\u00e1n?", failed: "\u0110\u00e1nh d\u1ea5u giao d\u1ecbch thanh to\u00e1n th\u1ea5t b\u1ea1i?", refunded: "X\u00e1c nh\u1eadn ho\u00e0n ti\u1ec1n cho giao d\u1ecbch n\u00e0y?" };
  if (!window.confirm(messages[status] || "X\u00e1c nh\u1eadn c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i?")) return;
  setBusy(root, true); setModalBusy(true);
  try {
    await paymentService.updateStatus(id, status, silentErrors());
    toast.success(`\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i: ${formatPaymentStatus(status)}.`);
    await fetchPayments(); renderRows(root); refreshAdminSidebarCounts();
    if (fromModal && activeModal) { const response = await paymentService.getById(id, silentErrors()); if (activeModal) renderDetailModal(root, activeModal, response.data?.payment); }
  } catch (error) { toast.error(getErrorMessage(error)); }
  finally { setBusy(root, false); setModalBusy(false); }
}

function closeDetailModal() { modalUxCleanup?.(); modalUxCleanup = null; activeModal?.remove(); activeModal = null; document.body.classList.remove("modal-open"); }
function setBusy(root, busy) { state.busy = busy; root?.querySelectorAll?.("button, input, select").forEach((element) => { element.disabled = busy; }); }
function setModalBusy(busy) { activeModal?.querySelectorAll?.("button").forEach((element) => { element.disabled = busy; }); }
function statusBadge(status) { const normalized = normalizePaymentStatus(status); return `<span class="admin-payment-badge is-${escapeHtml(normalized || "unknown")}">${escapeHtml(formatPaymentStatus(status))}</span>`; }
function formatCurrency(value, currency = "VND") { try { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); } catch { return `${Number(value || 0).toLocaleString("vi-VN")} ${currency || ""}`.trim(); } }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); }
function formatMetadata(value) { if (!value) return "-"; try { return JSON.stringify(value, null, 2); } catch { return String(value); } }
function numberId(value) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : ""; }
function silentErrors() { return { showErrorToast: false }; }
function getErrorMessage(error) { if (error?.status === 401) return "Phi\u00ean \u0111\u0103ng nh\u1eadp h\u1ebft h\u1ea1n, vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i."; if (error?.status === 403) return "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n truy c\u1eadp qu\u1ea3n l\u00fd thanh to\u00e1n."; if (error?.status === 404) return "Kh\u00f4ng t\u00ecm th\u1ea5y giao d\u1ecbch thanh to\u00e1n."; if (error?.status >= 500) return "L\u1ed7i h\u1ec7 th\u1ed1ng, vui l\u00f2ng th\u1eed l\u1ea1i."; return error?.message || "Kh\u00f4ng th\u1ec3 x\u1eed l\u00fd y\u00eau c\u1ea7u thanh to\u00e1n, vui l\u00f2ng th\u1eed l\u1ea1i."; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
