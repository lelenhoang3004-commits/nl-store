import { toast } from "../components/toast/toast.js";
import { activateModalUX } from "../components/modal/modal-ux.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { paymentService } from "../services/payment.service.js";

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
    body.innerHTML = `<tr><td colspan="11"><div class="admin-payment-error"><span>${escapeHtml(getErrorMessage(state.error))}</span><button type="button" data-payment-retry>Thử lại</button></div></td></tr>`;
    renderPagination(root);
    return;
  }

  body.innerHTML = state.payments.length
    ? state.payments.map(renderPaymentRow).join("")
    : '<tr><td colspan="11" class="admin-payment-empty">Không có giao dịch thanh toán phù hợp.</td></tr>';
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
    ${modal ? "" : `<button type="button" data-payment-detail="${numberId(payment.id)}">Chi tiết</button>`}
    ${canManage && ["pending", "failed"].includes(status) ? actionButton(payment.id, "paid", "Xác nhận paid") : ""}
    ${canManage && status === "pending" ? actionButton(payment.id, "failed", "Đánh dấu failed") : ""}
    ${canManage && status === "paid" ? actionButton(payment.id, "refunded", "Hoàn tiền") : ""}
    ${payment.orderId ? `<a href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}">Xem đơn hàng</a>` : ""}
  </div>`;
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
  target.innerHTML = `<span>Trang ${page}/${totalPages} · ${Number(pagination.totalItems || 0)} giao dịch</span><div><button type="button" data-payment-page="${page - 1}" ${previous ? "" : "disabled"}>Trước</button><button type="button" data-payment-page="${page + 1}" ${next ? "" : "disabled"}>Sau</button></div>`;
}

async function openDetailModal(root, id) {
  closeDetailModal();
  const overlay = document.createElement("div");
  overlay.className = "admin-payment-modal";
  overlay.dataset.paymentModal = "";
  overlay.innerHTML = '<section class="admin-payment-modal-dialog" role="dialog" aria-modal="true" aria-label="Đang tải chi tiết thanh toán" tabindex="-1"><div class="admin-payment-modal-loading">Đang tải chi tiết giao dịch...</div></section>';
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
    overlay.querySelector(".admin-payment-modal-dialog").innerHTML = `<header><h2>Chi tiết giao dịch</h2><button type="button" data-payment-modal-close aria-label="Đóng">×</button></header><div class="admin-payment-modal-error"><p>${escapeHtml(getErrorMessage(error))}</p><button type="button" data-payment-modal-retry="${numberId(id)}">Thử lại</button></div>`;
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
    <header class="admin-payment-modal-header"><div><h2 id="payment-modal-title" tabindex="-1">Chi tiết thanh toán</h2><p>Thông tin giao dịch và đơn hàng liên quan</p></div><button type="button" data-payment-modal-close aria-label="Đóng modal chi tiết thanh toán"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
    <div class="admin-payment-modal-body">
      <section class="admin-payment-section admin-payment-transaction-section"><div class="admin-payment-section-title"><i class="fa-solid fa-credit-card" aria-hidden="true"></i><h3>Thông tin giao dịch</h3></div><div class="admin-payment-info-grid">
        ${detailField("Payment ID", payment.id)}${detailField("Mã giao dịch", payment.transactionCode, true)}
        ${detailField("Provider", payment.provider)}${detailField("Phương thức", getPaymentMethodLabel(payment.method))}
        <div class="admin-payment-info-item"><span>Trạng thái thanh toán</span>${statusBadge(payment.status)}</div>
        ${detailField("Số tiền", formatCurrency(payment.amount, payment.currency), true)}${detailField("Tiền tệ", payment.currency)}
        ${detailField("Ngày thanh toán", formatDate(payment.paidAt))}${detailField("Ngày tạo", formatDate(payment.createdAt))}${detailField("Ngày cập nhật", formatDate(payment.updatedAt))}
      </div></section>
      <div class="admin-payment-side-sections">
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><h3>Thông tin đơn hàng</h3></div><div class="admin-payment-info-grid is-compact">${detailField("Order ID", payment.orderId)}${detailField("Mã đơn hàng", payment.orderCode, true)}${detailField("Trạng thái đơn hàng", payment.orderStatus)}${detailField("Tổng tiền đơn", payment.orderTotal == null ? "-" : formatCurrency(payment.orderTotal, payment.currency))}</div>${payment.orderId ? `<a class="admin-payment-order-link" href="#orders/${numberId(payment.orderId)}" data-page="orders/${numberId(payment.orderId)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Xem đơn hàng</a>` : ""}</section>
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-user" aria-hidden="true"></i><h3>Thông tin khách hàng</h3></div><div class="admin-payment-info-grid is-compact">${detailField("Họ tên", payment.customerName, true)}${detailField("Email", payment.customerEmail)}${detailField("Số điện thoại", payment.customerPhone)}</div></section>
        <section class="admin-payment-section"><div class="admin-payment-section-title"><i class="fa-solid fa-code" aria-hidden="true"></i><h3>Metadata / Ghi chú</h3></div><div class="admin-payment-metadata">${payment.metadata ? `<pre>${escapeHtml(formatMetadata(payment.metadata))}</pre>` : "<p>Không có dữ liệu bổ sung</p>"}</div></section>
      </div>
    </div>
    <footer class="admin-payment-modal-footer">${renderActions(payment, true)}</footer>`;

  overlay.querySelectorAll("[data-payment-status]").forEach((button) => button.addEventListener("click", async () => {
    await updateStatus(root, button.dataset.paymentId, button.dataset.paymentStatus, true);
  }));
  requestAnimationFrame(() => overlay.querySelector("[data-payment-modal-close]")?.focus({ preventScroll: true }));
}

function detailField(label, value, prominent = false) {
  return `<div class="admin-payment-info-item ${prominent ? "is-prominent" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value === null || value === undefined || value === "" ? "-" : value)}</strong></div>`;
}

async function updateStatus(root, id, status, fromModal = false) {
  const messages = {
    paid: "Xác nhận giao dịch đã được thanh toán?",
    failed: "Đánh dấu giao dịch thanh toán thất bại?",
    refunded: "Xác nhận hoàn tiền cho giao dịch này?"
  };
  if (!window.confirm(messages[status] || "Xác nhận cập nhật trạng thái?")) return;

  setBusy(root, true);
  setModalBusy(true);
  try {
    await paymentService.updateStatus(id, status, silentErrors());
    toast.success(`Đã cập nhật trạng thái: ${getPaymentStatusLabel(status)}.`);
    await fetchPayments();
    renderRows(root);
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
function getPaymentStatusLabel(status) { return ({ pending: "Chờ thanh toán", paid: "Đã thanh toán", success: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền", cancelled: "Đã hủy" })[status] || status || "-"; }
function getPaymentMethodLabel(method) { return ({ cod: "Thanh toán khi nhận hàng", bank_transfer: "Chuyển khoản ngân hàng", vnpay: "VNPay", momo: "MoMo" })[method] || method || "-"; }
function formatCurrency(value, currency = "VND") { try { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: currency || "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); } catch { return `${Number(value || 0).toLocaleString("vi-VN")} ${currency || ""}`.trim(); } }
function formatDate(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); }
function formatMetadata(value) { if (!value) return "-"; try { return JSON.stringify(value, null, 2); } catch { return String(value); } }
function numberId(value) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : ""; }
function silentErrors() { return { showErrorToast: false }; }
function getErrorMessage(error) {
  if (error?.status === 401) return "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.";
  if (error?.status === 403) return "Bạn không có quyền truy cập quản lý thanh toán.";
  if (error?.status === 404) return "Không tìm thấy giao dịch thanh toán.";
  if (error?.status >= 500) return "Lỗi hệ thống, vui lòng thử lại.";
  return error?.message || "Không thể xử lý yêu cầu thanh toán, vui lòng thử lại.";
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
