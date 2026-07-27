import { toast } from "../components/toast/toast.js";
import { activateModalUX } from "../components/modal/modal-ux.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { paymentService } from "../services/payment.service.js";
import { refreshAdminSidebarCounts } from "../components/sidebar/sidebar.js";

const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
let state = { payments: [], pagination: null, query: { ...DEFAULT_QUERY }, error: null, busy: false };
let activeModal = null;
let modalUxCleanup = null;

export async function createPaymentsPage() {
  const template = await loadTemplate(new URL("./index.html", import.meta.url));
  try {
    await fetchPayments();
  } catch (error) {
    state.error = error;
  }
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
    state.query = {
      ...state.query,
      page: 1,
      search: String(data.get("search") || "").trim(),
      status: String(data.get("status") || ""),
      method: String(data.get("method") || ""),
      provider: String(data.get("provider") || "")
    };
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
    if (pageButton && !pageButton.disabled && !state.busy) {
      state.query.page = Number(pageButton.dataset.paymentPage);
      await reloadList(root);
      return;
    }

    if (event.target.closest("[data-payment-retry]")) {
      await reloadList(root);
      return;
    }

    const detailButton = event.target.closest("[data-payment-detail]");
    if (detailButton && !state.busy) {
      await openDetailModal(root, detailButton.dataset.paymentDetail);
      return;
    }

    const statusButton = event.target.closest("[data-payment-status]");
    if (statusButton && !state.busy) {
      await updateStatus(root, statusButton.dataset.paymentId, statusButton.dataset.paymentStatus);
    }
  });
}

async function reloadList(root) {
  if (state.busy) return;
  setBusy(root, true);
  try {
    await fetchPayments();
  } catch (error) {
    state.error = error;
    toast.error(getErrorMessage(error));
  } finally {
    renderRows(root);
    setBusy(root, false);
  }
}

function renderRows(root) {
  const body = root.querySelector("[data-payment-rows]");
  if (!body) return;

  if (state.error) {
    body.innerHTML = `<tr><td colspan="11"><div class="admin-payment-error"><span>${escapeHtml(getErrorMessage(state.error))}</span><button type="button" data-payment-retry>Thá»­ láº¡i</button></div></td></tr>`;
    renderPagination(root);
    return;
  }

  body.innerHTML = state.payments.length
    ? state.payments.map(renderPaymentRow).join("")
    : '<tr><td colspan="11" class="admin-payment-empty">KhÃ´ng cÃ³ giao dá»‹ch thanh toÃ¡n phÃ¹ há»£p.</td></tr>';
  renderPagination(root);
}

function renderPaymentRow(payment) {
  return `<tr>
    <td><button type="button" class="admin-payment-link" data-payment-detail="${numberId(payment.id)}"><strong>${escapeHtml(payment.transactionCode || "-")}</strong></button></td>
    <td>${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">${escapeHtml(payment.orderCode || `#${payment.orderId}`)}</a>` : "-"}</td>
    <td><strong>${escapeHtml(payment.customerName || "-")}</strong><small>${escapeHtml(payment.customerPhone || payment.customerEmail || "")}</small></td>
    <td>${escapeHtml(payment.provider || "-")}</td>
    <td>${escapeHtml(getPaymentMethodLabel(payment.method))}</td>
    <td><strong>${formatCurrency(payment.amount, payment.currency)}</strong></td>
    <td>${escapeHtml(payment.currency || "-")}</td>
    <td>${statusBadge(payment.status)}</td>
    <td>${formatDate(payment.paidAt)}</td>
    <td>${formatDate(payment.createdAt)}</td>
    <td>${renderActions(payment)}</td>
  </tr>`;
}

function renderActions(payment, modal = false) {
  const canManage = hasPermission(PERMISSIONS.PAYMENT_MANAGE);
  const status = normalizeStatus(payment.status);
  const classes = modal ? "admin-payment-modal-actions" : "admin-payment-actions";
  return `<div class="${classes}">
    ${modal ? "" : `<button type="button" data-payment-detail="${numberId(payment.id)}">Chi tiáº¿t</button>`}
    ${canManage && ["pending", "processing", "failed"].includes(status) ? actionButton(payment.id, "paid", (isPersonalMomoPayment(payment) || isPersonalBankPayment(payment)) ? "Xac nhan da nhan tien" : "Xac nhan paid") : ""}
    ${canManage && status === "pending" ? actionButton(payment.id, "failed", "ÄÃ¡nh dáº¥u failed") : ""}
    ${canManage && status === "paid" ? actionButton(payment.id, "refunded", "HoÃ n tiá»n") : ""}
    ${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">Xem Ä‘Æ¡n hÃ ng</a>` : ""}
  </div>`;
}

function isPersonalMomoPayment(payment) {
  return String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase() === "MOMO_PERSONAL_QR";
}

function isPersonalBankPayment(payment) {
  return String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase() === "BANK_PERSONAL_QR";
}

function actionButton(id, status, label) {
  return `<button type="button" data-payment-id="${numberId(id)}" data-payment-status="${status}">${label}</button>`;
}

function renderPagination(root) {
  const target = root.querySelector("[data-payment-pagination]");
  if (!target) return;
  const pagination = state.pagination;
  if (!pagination || state.error) {
    target.innerHTML = "";
    return;
  }
  const page = Number(pagination.page || 1);
  const totalPages = Math.max(Number(pagination.totalPages || 0), 1);
  const previous = pagination.hasPreviousPage ?? page > 1;
  const next = pagination.hasNextPage ?? page < totalPages;
  target.innerHTML = `<span>Trang ${page}/${totalPages} Â· ${Number(pagination.totalItems || 0)} giao dá»‹ch</span><div><button type="button" data-payment-page="${page - 1}" ${previous ? "" : "disabled"}>TrÆ°á»›c</button><button type="button" data-payment-page="${page + 1}" ${next ? "" : "disabled"}>Sau</button></div>`;
}

async function openDetailModal(root, id) {
  closeDetailModal();
  const overlay = document.createElement("div");
  overlay.className = "admin-payment-modal";
  overlay.dataset.paymentModal = "";
  overlay.innerHTML = '<section class="admin-payment-modal-dialog" role="dialog" aria-modal="true" aria-label="Äang táº£i chi tiáº¿t thanh toÃ¡n" tabindex="-1"><div class="admin-payment-modal-loading">Äang táº£i chi tiáº¿t giao dá»‹ch...</div></section>';
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  activeModal = overlay;
  modalUxCleanup = activateModalUX(overlay, { onClose: closeDetailModal });
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-payment-modal-close]")) closeDetailModal();
  });

  try {
    const response = await paymentService.getById(id, silentErrors());
    if (activeModal !== overlay) return;
    renderDetailModal(root, overlay, response.data?.payment);
  } catch (error) {
    if (activeModal !== overlay) return;
    overlay.querySelector(".admin-payment-modal-dialog").innerHTML = `<header><h2>Chi tiáº¿t giao dá»‹ch</h2><button type="button" data-payment-modal-close aria-label="ÄÃ³ng">Ã—</button></header><div class="admin-payment-modal-error"><p>${escapeHtml(getErrorMessage(error))}</p><button type="button" data-payment-modal-retry="${numberId(id)}">Thá»­ láº¡i</button></div>`;
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
    <header class="admin-payment-modal-header"><div><h2 id="payment-modal-title" tabindex="-1">Chi tiáº¿t thanh toÃ¡n</h2><p>ThÃ´ng tin giao dá»‹ch vÃ  Ä‘Æ¡n hÃ ng liÃªn quan</p></div><button type="button" data-payment-modal-close aria-label="ÄÃ³ng modal chi tiáº¿t thanh toÃ¡n"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="admin-payment-modal-body">
      <section class="admin-payment-section admin-payment-transaction-section"><div class="admin-payment-section-title"><i class="fa-solid fa-credit-card" aria-hidden="true"></i><h3>ThÃ´ng tin giao dá»‹ch</h3></div><div class="admin-payment-info-grid">
        ${detailField("Payment ID", payment.id)}${detailField("MÃ£ giao dá»‹ch", payment.transactionCode, true)}
        ${detailField("Provider", payment.provider)}${detailField("PhÆ°Æ¡ng thá»©c", getPaymentMethodLabel(payment.method))}
        <div class="admin-payment-info-item"><span>Tráº¡ng thÃ¡i thanh toÃ¡n</span>${statusBadge(payment.status)}</div>
        ${detailField("Sá»‘ tiá»n", formatCurrency(payment.amount, payment.currency), true)}${detailField("Tiá»n tá»‡", payment.currency)}
        ${detailField("NgÃ y thanh toÃ¡n", formatDate(payment.paidAt))}${detailField("NgÃ y táº¡o", formatDate(payment.createdAt))}${detailField("NgÃ y cáº­p nháº­t", formatDate(payment.updatedAt))}
      </div></section>
      <div class="admin-payment-side-sections">
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><h3>ThÃ´ng tin Ä‘Æ¡n hÃ ng</h3></div><div class="admin-payment-info-grid is-compact">${detailField("Order ID", payment.orderId)}${detailField("MÃ£ Ä‘Æ¡n hÃ ng", payment.orderCode, true)}${detailField("Tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng", payment.orderStatus)}${detailField("Tá»•ng tiá»n Ä‘Æ¡n", payment.orderTotal == null ? "-" : formatCurrency(payment.orderTotal, payment.currency))}</div>${payment.orderId ? `<a class="admin-payment-order-link" href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem Ä‘Æ¡n hÃ ng</a>` : ""}</section>
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-user" aria-hidden="true"></i><h3>ThÃ´ng tin khÃ¡ch hÃ ng</h3></div><div class="admin-payment-info-grid is-compact">${detailField("Há» tÃªn", payment.customerName, true)}${detailField("Email", payment.customerEmail)}${detailField("Sá»‘ Ä‘iá»‡n thoáº¡i", payment.customerPhone)}</div></section>
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-code" aria-hidden="true"></i><h3>Metadata / Ghi chÃº</h3></div><div class="admin-payment-metadata">${payment.metadata ? `<pre>${escapeHtml(formatMetadata(payment.metadata))}</pre>` : "<p>KhÃ´ng cÃ³ dá»¯ liá»‡u bá»• sung</p>"}</div></section>
      </div>
    </div>
    <footer class="admin-payment-modal-footer">${renderActions(payment, true)}</footer>`;

  overlay.querySelectorAll("[data-payment-status]").forEach((button) => button.addEventListener("click", async () => {
    await updateStatus(root, button.dataset.paymentId, button.dataset.paymentStatus, true);
  }));
  requestAnimationFrame(() => overlay.querySelector("[data-payment-modal-close]")?.focus({ preventScroll: true }));
}

function renderPaymentMetadataSummary(payment) {
  const guide = payment?.metadata?.paymentGuide || {};
  const method = String(payment?.method || "").toLowerCase();
  if (method === "bank_transfer") {
    return `${detailField("Noi dung chuyen khoan", guide.transferContent)}${detailField("Tai khoan nhan", guide.bank?.accountNumber)}${detailField("Chu tai khoan", guide.bank?.accountName)}`;
  }
  if (method === "credit_card") {
    return `${detailField("Card brand", guide.cardBrand || payment?.metadata?.card_brand)}${detailField("Last4", guide.cardLast4 || payment?.metadata?.card_last4)}`;
  }
  return "";
}

function detailField(label, value, prominent = false) {
  return `<div class="admin-payment-info-item ${prominent ? "is-prominent" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === null || value === undefined || value === "" ? "-" : value)}</strong></div>`;
}

async function updateStatus(root, id, status, fromModal = false) {
  const messages = {
    paid: "XÃ¡c nháº­n giao dá»‹ch Ä‘Ã£ Ä‘Æ°á»£c thanh toÃ¡n?",
    failed: "ÄÃ¡nh dáº¥u giao dá»‹ch thanh toÃ¡n tháº¥t báº¡i?",
    refunded: "XÃ¡c nháº­n hoÃ n tiá»n cho giao dá»‹ch nÃ y?"
  };
  if (!window.confirm(messages[status] || "XÃ¡c nháº­n cáº­p nháº­t tráº¡ng thÃ¡i?")) return;

  setBusy(root, true);
  setModalBusy(true);
  try {
    await paymentService.updateStatus(id, status, silentErrors());
    toast.success(`ÄÃ£ cáº­p nháº­t tráº¡ng thÃ¡i: ${getPaymentStatusLabel(status)}.`);
    await fetchPayments();
    renderRows(root);
    refreshAdminSidebarCounts();
    if (fromModal && activeModal) {
      const response = await paymentService.getById(id, silentErrors());
      if (activeModal) renderDetailModal(root, activeModal, response.data?.payment);
    }
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setBusy(root, false);
    setModalBusy(false);
  }
}

function closeDetailModal() {
  modalUxCleanup?.();
  modalUxCleanup = null;
  activeModal?.remove();
  activeModal = null;
  document.body.classList.remove("modal-open");
}

function setBusy(root, busy) {
  state.busy = busy;
  root?.querySelectorAll?.("button, input, select").forEach((element) => { element.disabled = busy; });
}

function setModalBusy(busy) {
  activeModal?.querySelectorAll?.("button").forEach((element) => { element.disabled = busy; });
}

function statusBadge(status) {
  const normalized = normalizeStatus(status);
  return `<span class="admin-payment-badge is-${escapeHtml(normalized || "unknown")}">${escapeHtml(getPaymentStatusLabel(status))}</span>`;
}

function normalizeStatus(status) { return status === "success" ? "paid" : String(status || "").toLowerCase(); }
function getPaymentStatusLabel(status) { return ({ pending: "Chá» thanh toÃ¡n", paid: "ÄÃ£ thanh toÃ¡n", success: "ÄÃ£ thanh toÃ¡n", failed: "Thanh toÃ¡n tháº¥t báº¡i", refunded: "ÄÃ£ hoÃ n tiá»n", processing: "Dang cho xac nhan", cancelled: "ÄÃ£ há»§y" })[status] || status || "-"; }
function getPaymentMethodLabel(method) {
  const value = String(method || "").toLowerCase();
  return ({ cod: "Thanh toÃ¡n khi nháº­n hÃ ng", bank_transfer: "Chuyá»ƒn khoáº£n ngÃ¢n hÃ ng", credit_card: "Tháº» tÃ­n dá»¥ng", vnpay: "VNPay", momo: "MoMo QR ca nhan" })[value] || method || "-";
}
function formatCurrency(value, currency = "VND") { try { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); } catch { return `${Number(value || 0).toLocaleString("vi-VN")} ${currency || ""}`.trim(); } }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); }
function formatMetadata(value) { if (!value) return "-"; try { return JSON.stringify(value, null, 2); } catch { return String(value); } }
function numberId(value) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : ""; }
function silentErrors() { return { showErrorToast: false }; }
function getErrorMessage(error) {
  if (error?.status === 401) return "PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n, vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.";
  if (error?.status === 403) return "Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p quáº£n lÃ½ thanh toÃ¡n.";
  if (error?.status === 404) return "KhÃ´ng tÃ¬m tháº¥y giao dá»‹ch thanh toÃ¡n.";
  if (error?.status >= 500) return "Lá»—i há»‡ thá»‘ng, vui lÃ²ng thá»­ láº¡i.";
  return error?.message || "KhÃ´ng thá»ƒ xá»­ lÃ½ yÃªu cáº§u thanh toÃ¡n, vui lÃ²ng thá»­ láº¡i.";
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }


