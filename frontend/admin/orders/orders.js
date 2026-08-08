import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../../assets/js/notify.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { apiClient } from "../services/api/index.js";
import { API_CONFIG } from "../services/api/api.config.js";
import { orderService } from "../services/order.service.js";
import { refreshAdminSidebarCounts } from "../components/sidebar/sidebar.js";
import { formatOrderStatus, formatPaymentMethod, formatPaymentStatus, normalizeOrderStatus, normalizePaymentStatus } from "../utils/payment-formatters.js";

const API_ORIGIN = new URL(API_CONFIG.baseURL).origin;
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23eef2f7'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%2364748b' font-size='13'%3EKhông có ảnh%3C/text%3E%3C/svg%3E";
const DEFAULT_QUERY = Object.freeze({ page: 1, limit: 10, sortBy: "createdAt", sortDirection: "desc" });
const ORDER_STATUS_OPTIONS = Object.freeze(["pending", "confirmed", "processing", "shipping", "completed", "cancelled", "refunded"]);
const ORDER_STATUS_FLOW = Object.freeze(["pending", "confirmed", "processing", "shipping", "completed"]);
const TERMINAL_ORDER_STATUSES = new Set(["completed", "cancelled", "refunded"]);
const STATUS_TRANSITIONS = Object.freeze({
  pending: ["confirmed", "processing", "shipping", "completed"],
  confirmed: ["processing", "shipping", "completed"],
  processing: ["shipping", "completed"],
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
    notifyError(getErrorMessage(error));
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
        <td><a class="admin-order-code" href="#orders/${order.id}" data-page="orders/${order.id}" title="${escapeHtml(order.orderCode)}"><strong>${escapeHtml(order.orderCode)}</strong></a></td>
        <td><strong class="admin-order-customer-name">${escapeHtml(order.customerName || "—")}</strong></td>
        <td class="admin-order-phone">${escapeHtml(order.customerPhone || "—")}</td>
        <td class="admin-order-money-cell"><strong>${formatCurrency(order.grandTotal)}</strong></td>
        <td class="admin-order-method-cell" title="${escapeHtml(paymentMethodLabel(order.paymentMethod))}">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</td>
        <td>${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</td>
        <td>${badge(orderStatusLabel(order.status), order.status)}</td>
        <td class="admin-order-date">${formatCompactDate(order.createdAt)}</td>
        <td>${renderListActions(order)}</td>
      </tr>`).join("")
    : '<tr><td colspan="9" class="admin-order-empty">Không có đơn hàng phù hợp.</td></tr>';
  renderPagination(root);
}

function renderListActions(order) {
  const canUpdate = hasPermission(PERMISSIONS.ORDER_MANAGE) && STATUS_TRANSITIONS[order.status]?.length;
  const cancelAction = canCancel(order) && hasPermission(PERMISSIONS.ORDER_CANCEL) ? `<button type="button" class="is-danger" data-order-cancel="${order.id}">H&#7911;y &#273;&#417;n</button>` : "";
  return `<div class="admin-order-actions admin-row-actions">
    <a class="admin-row-action is-primary-soft" href="#orders/${order.id}" data-page="orders/${order.id}"><i class="fa-regular fa-eye" aria-hidden="true"></i><span>Xem</span></a>
    ${canUpdate ? `<a class="admin-row-action" href="#orders/${order.id}" data-page="orders/${order.id}"><i class="fa-regular fa-pen-to-square" aria-hidden="true"></i><span>C&#7853;p nh&#7853;t</span></a>` : ""}
    ${cancelAction ? `<details class="admin-row-action-menu"><summary class="admin-row-action is-icon" aria-label="M&#7903; th&#234;m h&#224;nh &#273;&#7897;ng &#273;&#417;n h&#224;ng"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></summary><div class="admin-row-action-menu-panel">${cancelAction}</div></details>` : ""}
  </div>`;
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
  target.innerHTML = `<span>Trang ${page}/${totalPages} · ${Number(pagination.totalItems || 0)} đơn hàng</span><div><button type="button" data-order-page="${page - 1}" ${hasPrevious ? "" : "disabled"}>Trước</button><button type="button" data-order-page="${page + 1}" ${hasNext ? "" : "disabled"}>Sau</button></div>`;
}

function renderOrderDetail(detail) {
  const { order, items = [], payments = [], histories = [] } = detail;
  const shipping = order.shippingAddress || {};
  const statusOptions = getStatusOptions(order.status);
  const canManage = hasPermission(PERMISSIONS.ORDER_MANAGE);
  const canUpdateStatus = canManage && !TERMINAL_ORDER_STATUSES.has(order.status) && statusOptions.some((option) => !option.disabled && option.value !== order.status);
  return `
    <section class="admin-order-detail" data-admin-order-detail="${order.id}">
      <div class="admin-orders-hero admin-order-detail-header">
        <div><p class="admin-orders-eyebrow">Chi tiết đơn hàng</p><h1>${escapeHtml(order.orderCode)}</h1><p>Tạo lúc ${formatDate(order.createdAt)}</p><div class="admin-order-header-badges">${badge(orderStatusLabel(order.status), order.status)}${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</div></div>
        <a class="admin-order-back" href="#orders" data-page="orders"><i class="fa-solid fa-arrow-left"></i> Danh sách</a>
      </div>
      <div class="admin-order-detail-grid">
        <div class="admin-order-detail-main">
          <article class="admin-order-card admin-order-info"><h2>Thông tin khách hàng</h2><div class="admin-order-info-grid"><p><span>Tên khách hàng</span><strong>${escapeHtml(order.customerName || "—")}</strong></p><p><span>Email</span><strong>${escapeHtml(order.customerEmail || "—")}</strong></p><p><span>Số điện thoại</span><strong>${escapeHtml(order.customerPhone || "—")}</strong></p></div></article>
          ${renderShippingCard(shipping, order)}
          <article class="admin-order-card"><h2>Sản phẩm trong đơn</h2><div class="admin-order-items">${items.length ? items.map(renderOrderItem).join("") : '<p class="admin-order-empty">Đơn hàng chưa có sản phẩm.</p>'}</div></article>
          <article class="admin-order-card"><h2>Lịch sử đơn hàng</h2><div class="admin-order-history">${histories.length ? histories.map(renderHistory).join("") : '<p class="admin-order-empty">Chưa có lịch sử trạng thái.</p>'}</div></article>
        </div>
        <aside class="admin-order-detail-side">
          <article class="admin-order-card" id="order-status-actions"><h2>C\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i</h2>${canManage ? `<form data-order-status-form><select name="status" aria-label="Tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng" ${canUpdateStatus ? "" : "disabled"}>${statusOptions.map((option) => `<option value="${option.value}" ${option.selected ? "selected" : ""} ${option.disabled ? "disabled" : ""}>${orderStatusLabel(option.value)}</option>`).join("")}</select><textarea name="note" maxlength="500" placeholder="Ghi ch\u00fa c\u1eadp nh\u1eadt" ${canUpdateStatus ? "" : "disabled"}></textarea>${canUpdateStatus ? '<button type="submit">C\u1eadp nh\u1eadt</button>' : ""}</form>` : '<p>B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng.</p>'}${!canUpdateStatus ? '<p>Kh\u00f4ng c\u00f2n b\u01b0\u1edbc chuy\u1ec3n tr\u1ea1ng th\u00e1i h\u1ee3p l\u1ec7.</p>' : ""}${canCancel(order) && hasPermission(PERMISSIONS.ORDER_CANCEL) ? '<button class="admin-order-danger" type="button" data-detail-cancel>H\u1ee7y \u0111\u01a1n h\u00e0ng</button>' : ""}</article>
          ${renderPaymentSummary(order)}
          <article class="admin-order-card"><h2>Giao dịch thanh toán</h2>${payments.length ? payments.map((payment) => renderPayment(payment, order.paymentStatus)).join("") : '<p>Chưa có giao dịch thanh toán</p>'}</article>
        </aside>
      </div>
    </section>`;
}

function getStatusOptions(currentStatus) {
  const currentFlowIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);
  return ORDER_STATUS_OPTIONS.map((status) => {
    const optionFlowIndex = ORDER_STATUS_FLOW.indexOf(status);
    const isCurrent = status === currentStatus;
    const isForwardWorkflowStatus = currentFlowIndex >= 0 && optionFlowIndex > currentFlowIndex;
    return {
      value: status,
      selected: isCurrent,
      disabled: isCurrent || status === "cancelled" || status === "refunded" || TERMINAL_ORDER_STATUSES.has(currentStatus) || !isForwardWorkflowStatus
    };
  });
}

function getTransitionPath(currentStatus, nextStatus) {
  const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus);
  const nextIndex = ORDER_STATUS_FLOW.indexOf(nextStatus);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex <= currentIndex) return [];
  return ORDER_STATUS_FLOW.slice(currentIndex + 1, nextIndex + 1);
}

function normalizeOrderDetailResponse(data = {}) {
  const payments = data.payments || (data.payment ? [data.payment] : detailState?.payments || []);
  return { ...data, payments, payment: payments[0] || data.payment || null };
}

function renderShippingCard(shipping, order) {
  const receiverName = shipping.receiver_name || shipping.receiverName || shipping.fullName || order.customerName || "—";
  const receiverPhone = shipping.receiver_phone || shipping.receiverPhone || shipping.phone || order.customerPhone || "—";
  const detailAddress = shipping.detail_address || shipping.detailAddress || shipping.address || shipping.line1 || "—";
  const ward = shipping.ward_name || shipping.wardName || shipping.ward || "—";
  const province = shipping.province_name || shipping.provinceName || shipping.province || shipping.city || "—";
  return `<article class="admin-order-card admin-order-info"><h2>Thông tin giao hàng</h2><div class="admin-order-info-grid"><p><span>Người nhận</span><strong>${escapeHtml(receiverName)}</strong></p><p><span>Điện thoại nhận hàng</span><strong>${escapeHtml(receiverPhone)}</strong></p><p><span>Địa chỉ chi tiết</span><strong>${escapeHtml(detailAddress)}</strong></p><p><span>Phường/Xã</span><strong>${escapeHtml(ward)}</strong></p><p><span>Tỉnh/Thành phố</span><strong>${escapeHtml(province)}</strong></p></div><p class="admin-order-address"><span>Địa chỉ đầy đủ</span><strong>${escapeHtml(formatAddress(shipping))}</strong></p></article>`;
}

function renderOrderItem(item) {
  const variants = [item.size || item.variantSize, item.color || item.variantColor].filter(Boolean);
  return `<div class="admin-order-item"><img src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${escapeHtml(resolveImageUrl(item.productImageUrl))}" alt="${escapeHtml(item.productName || "Sản phẩm")}" loading="lazy" decoding="async" data-product-image data-order-product-image><div><strong>${escapeHtml(item.productName || "—")}</strong><span>SKU: ${escapeHtml(item.productSku || "—")}</span>${variants.length ? `<span>Size / Màu: ${escapeHtml(variants.join(" / "))}</span>` : ""}<span>Số lượng: ${Number(item.quantity || 0)}</span><span>Đơn giá: ${formatCurrency(item.unitPrice)}</span></div><strong>${formatCurrency(item.totalPrice)}</strong></div>`;
}

function renderHistory(entry) {
  return `<div><span></span><p><strong>${escapeHtml(orderStatusLabel(entry.status))}</strong><small>${escapeHtml(entry.note || "Cập nhật trạng thái")}</small><small>Người cập nhật: ${entry.changedBy ? `#${escapeHtml(entry.changedBy)}` : "Hệ thống"}</small><time>${formatDate(entry.createdAt)}</time></p></div>`;
}

function renderPaymentSummary(order) {
  return `<article class="admin-order-card"><h2>Tóm tắt thanh toán</h2><div class="admin-order-money"><p><span>Tạm tính</span><strong>${formatCurrency(order.subtotal)}</strong></p><p><span>Giảm giá</span><strong>${formatCurrency(order.discountTotal)}</strong></p><p><span>Phí vận chuyển</span><strong>${formatCurrency(order.shippingFee)}</strong></p><p><span>Thu&#7871; VAT (10%)</span><strong>&#272;&#227; g&#7891;m ${formatCurrency(order.taxTotal)}</strong></p><p><span>Phương thức</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></p><p><span>Trạng thái</span>${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</p><p><span>Đã thanh toán</span><strong>${formatCurrency(order.paidAmount)}</strong></p><p class="total"><span>Tổng tiền</span><strong>${formatCurrency(order.grandTotal)}</strong></p></div></article>`;
}

function renderPayment(payment, orderPaymentStatus) {
  const method = String(payment.method || "").toLowerCase();
  const guide = payment.metadata?.paymentGuide || {};
  const providerCode = String(payment.provider || guide.provider || "").toUpperCase();
  const isPersonalMomo = isMomoPayment(payment);
  const isPersonalBank = providerCode === "BANK_PERSONAL_QR";
  const isManualConfirmable = method === "bank_transfer" || isPersonalMomo || isPersonalBank;
  const status = normalizePaymentStatus(payment.status);
  const canConfirm = hasPermission(PERMISSIONS.PAYMENT_MANAGE) && isManualConfirmable && ["pending", "processing"].includes(status) && normalizePaymentStatus(orderPaymentStatus) !== "paid";
  const extra = method === "bank_transfer"
    ? `<p><span>Nội dung chuyển khoản</span><strong>${escapeHtml(guide.transferContent || "?")}</strong></p><p><span>Khách báo lúc</span><strong>${escapeHtml(payment.metadata?.customerReportedPaymentAt || "?")}</strong></p>`
    : isPersonalMomo
      ? `<p><span>Nội dung MoMo</span><strong>${escapeHtml(guide.transferContent || "?")}</strong></p>`
      : method === "credit_card"
        ? `<p><span>Thương hiệu thẻ / 4 số cuối</span><strong>${escapeHtml([guide.cardBrand, guide.cardLast4].filter(Boolean).join(" / ") || "?")}</strong></p>`
        : "";
  return `<div class="admin-order-payment"><p><span>Mã giao dịch</span><strong>${escapeHtml(payment.transactionCode || "?")}</strong></p><p><span>Nhà cung cấp</span><strong>${escapeHtml(payment.provider || "?")}</strong></p><p><span>Phương thức</span><strong>${escapeHtml(paymentMethodLabel(payment.method))}</strong></p>${extra}<p><span>Số tiền</span><strong>${formatCurrency(payment.amount)}</strong></p><p><span>Trạng thái</span>${badge(paymentStatusLabel(payment.status), payment.status)}</p><p><span>Ngày thanh toán</span><strong>${payment.paidAt ? formatDate(payment.paidAt) : "—"}</strong></p>${canConfirm ? `<button type="button" data-confirm-payment="${payment.id}">Xác nhận đã nhận tiền</button>` : ""}</div>`;
}

function isMomoPayment(payment) {
  const provider = String(payment?.provider || payment?.metadata?.paymentGuide?.provider || "").toUpperCase();
  const method = String(payment?.method || payment?.paymentMethod || "").toLowerCase();
  return method === "momo" || provider === "MOMO" || provider === "MOMO_PERSONAL_QR";
}
function initOrderDetail(root, orderId) {
  bindProductImageFallback(root);
  root.querySelector("[data-order-status-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentStatus = detailState?.order?.status;
    const nextStatus = String(data.get("status") || "");
    const transitionPath = getTransitionPath(currentStatus, nextStatus);
    if (!transitionPath.length) return;
    if (transitionPath.length >= 2) {
      const confirmed = await openStatusJumpConfirmDialog(transitionPath);
      if (!confirmed) return;
    }
    setBusy(form, true);
    try {
      const response = await orderService.updateStatus(orderId, { status: nextStatus, note: String(data.get("note") || "").trim() }, silentErrors());
      detailState = normalizeOrderDetailResponse(response.data || detailState);
      notifySuccess("\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng.");
      root.innerHTML = renderOrderDetail(detailState);
      initOrderDetail(root, orderId);
      refreshAdminSidebarCounts();
    } catch (error) {
      notifyError(getErrorMessage(error));
      setBusy(form, false);
    }
  });

  root.querySelector("[data-detail-cancel]")?.addEventListener("click", () => openCancelModal(orderId, () => refreshOrderDetail(root, orderId)));
  root.querySelectorAll("[data-confirm-payment]").forEach((button) => button.addEventListener("click", async () => {
    const payment = detailState?.payments?.find((item) => String(item.id) === String(button.dataset.confirmPayment));
    button.disabled = true;
    const confirmed = await openOrderPaymentConfirmDialog(payment, detailState?.order || {}, async () => {
      await apiClient.patch(`/payments/${button.dataset.confirmPayment}/status`, {
        status: "paid",
        note: isMomoPayment(payment) ? "Admin xác nhận thanh toán MoMo QR cá nhân." : "Admin xác nhận cửa hàng đã nhận tiền chuyển khoản.",
        confirmedSource: isMomoPayment(payment) ? "admin_momo_personal_qr" : "admin_manual_transfer"
      }, silentErrors());
      notifySuccess("Đã xác nhận đã nhận tiền.");
      await refreshOrderDetail(root, orderId);
      refreshAdminSidebarCounts();
    });
    if (!confirmed) {
      button.disabled = false;
    }
  }))

}

function openOrderPaymentConfirmDialog(payment = {}, order = {}, onConfirm = null) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "admin-order-modal admin-order-payment-confirm-modal is-visible";
    overlay.dataset.orderPaymentConfirmModal = "";
    overlay.innerHTML = `
      <section class="admin-order-modal-dialog admin-order-payment-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="order-payment-confirm-title" tabindex="-1">
        <header class="admin-order-payment-confirm-header">
          <div>
            <p class="admin-orders-eyebrow">XÁC NHẬN THANH TOÁN</p>
            <h2 id="order-payment-confirm-title">Xác nhận thanh toán MoMo?</h2>
          </div>
          <button class="admin-order-payment-confirm-close" type="button" data-payment-confirm-cancel aria-label="Đóng">×</button>
        </header>
        <div class="admin-order-payment-confirm-body">
          <p class="admin-order-payment-confirm-message">Bạn đã kiểm tra và xác nhận cửa hàng đã nhận đúng số tiền của giao dịch này.</p>
          <div class="admin-order-payment-confirm-grid">
            ${paymentConfirmField("Mã đơn hàng", order.orderCode || payment.orderCode || "—")}
            ${paymentConfirmField("Mã giao dịch", payment.transactionCode || "—")}
            ${paymentConfirmField("Khách hàng", [order.customerName || payment.customerName || "—", order.customerCode || order.customer_code || payment.customerCode || payment.customer_code || ""].filter(Boolean).join("\n"))}
            ${paymentConfirmField("Số tiền", formatCurrency(payment.amount || order.grandTotal), "is-amount")}
            ${paymentConfirmField("Phương thức", '<span class="admin-order-payment-method-badge">MoMo</span>', "is-method", true)}
          </div>
        </div>
        <footer class="admin-order-payment-confirm-actions">
          <button class="admin-order-payment-confirm-secondary" type="button" data-payment-confirm-cancel>Hủy</button>
          <button class="admin-order-payment-confirm-primary" type="button" data-payment-confirm-ok>Xác nhận đã nhận tiền</button>
        </footer>
      </section>`;
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");

    const buttons = Array.from(overlay.querySelectorAll("button"));
    const confirmButton = overlay.querySelector("[data-payment-confirm-ok]");
    const close = (value) => {
      overlay.remove();
      document.body.classList.remove("modal-open");
      resolve(value);
    };
    const setLoading = (loading) => {
      buttons.forEach((button) => { button.disabled = loading; });
      if (confirmButton) confirmButton.textContent = loading ? "Đang xác nhận..." : "Xác nhận đã nhận tiền";
    };

    overlay.addEventListener("click", (event) => {
      if (confirmButton?.disabled) return;
      if (event.target === overlay || event.target.closest("[data-payment-confirm-cancel]")) close(false);
    });
    confirmButton?.addEventListener("click", async () => {
      setLoading(true);
      try {
        await onConfirm?.();
        close(true);
      } catch (error) {
        notifyError(getErrorMessage(error));
        setLoading(false);
      }
    });
    overlay.querySelector("[data-payment-confirm-cancel]")?.focus({ preventScroll: true });
  });
}

function paymentConfirmField(label, value, className = "", isHtml = false) {
  const content = isHtml ? value : escapeHtml(value || "—").replaceAll("\n", "<br>");
  return `<div class="admin-order-payment-confirm-item ${className}"><span>${escapeHtml(label)}</span><strong>${content}</strong></div>`;
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
    notifyError(getErrorMessage(error));
  } finally {
    setBusy(root, false);
  }
}

function openStatusJumpConfirmDialog(transitionPath = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "admin-order-modal is-visible";
    overlay.dataset.orderStatusJumpModal = "";
    overlay.innerHTML = `
      <section class="admin-order-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="status-jump-title" tabindex="-1">
        <header><div><p class="admin-orders-eyebrow">C\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i</p><h2 id="status-jump-title">X\u00e1c nh\u1eadn chuy\u1ec3n tr\u1ea1ng th\u00e1i</h2></div><button type="button" aria-label="\u0110\u00f3ng" data-status-jump-cancel>\u00d7</button></header>
        <div>
          <p>\u0110\u01a1n h\u00e0ng s\u1ebd t\u1ef1 \u0111\u1ed9ng ho\u00e0n t\u1ea5t c\u00e1c tr\u1ea1ng th\u00e1i trung gian:</p>
          <p><strong>${transitionPath.map(orderStatusLabel).join(" \u2192 ")}.</strong></p>
          <p>B\u1ea1n c\u00f3 ch\u1eafc ch\u1eafn mu\u1ed1n ti\u1ebfp t\u1ee5c?</p>
        </div>
        <footer><button type="button" data-status-jump-cancel>H\u1ee7y</button><button type="button" class="is-primary" data-status-jump-confirm>X\u00e1c nh\u1eadn</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    const close = (value) => {
      overlay.remove();
      document.body.classList.remove("modal-open");
      resolve(value);
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-status-jump-cancel]")) close(false);
      if (event.target.closest("[data-status-jump-confirm]")) close(true);
    });
    overlay.querySelector("[data-status-jump-confirm]")?.focus({ preventScroll: true });
  });
}

function openCancelModal(orderId, onSuccess) {
  closeCancelModal();
  const overlay = document.createElement("div");
  overlay.className = "admin-order-modal";
  overlay.dataset.orderCancelModal = "";
  overlay.innerHTML = `<section class="admin-order-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title"><header><div><p class="admin-orders-eyebrow">Quản lý đơn hàng</p><h2 id="cancel-order-title">Hủy đơn hàng</h2></div><button type="button" aria-label="Đóng" data-cancel-close>×</button></header><form data-cancel-form><label><span>Lý do hủy</span><textarea name="reason" maxlength="500" required placeholder="Nhập lý do hủy đơn...">Khách yêu cầu hủy</textarea></label><small>Tối đa 500 ký tự. Tồn kho sẽ được backend hoàn lại trong transaction.</small><footer><button type="button" data-cancel-close>Đóng</button><button type="submit" class="admin-order-danger">Xác nhận hủy</button></footer></form></section>`;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  overlay.querySelectorAll("[data-cancel-close]").forEach((button) => button.addEventListener("click", closeCancelModal));
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeCancelModal(); });
  overlay.querySelector("[data-cancel-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") || "").trim();
    if (!reason) return notifyError("Vui lòng nhập lý do hủy đơn.");
    setBusy(form, true);
    try {
      await orderService.cancel(orderId, { reason }, silentErrors());
      closeCancelModal();
      notifySuccess("Đã hủy đơn và hoàn lại tồn kho.");
      await onSuccess?.();
      refreshAdminSidebarCounts();
    } catch (error) {
      notifyError(getErrorMessage(error));
      setBusy(form, false);
    }
  });
  overlay.querySelector("textarea")?.focus();
}

function closeCancelModal() { document.querySelector("[data-order-cancel-modal]")?.remove(); document.body.classList.remove("modal-open"); }
function bindProductImageFallback(root) { root.querySelectorAll("[data-order-product-image]").forEach((image) => image.addEventListener("error", () => { image.src = PLACEHOLDER_IMAGE; }, { once: true })); }
function bindErrorRetry(root, retry) { root.querySelector("[data-order-retry]")?.addEventListener("click", retry); }
function renderErrorState(error) { return `<section class="admin-order-error"><i class="fa-solid fa-circle-exclamation"></i><h1>Không thể tải trang đơn hàng</h1><p>${escapeHtml(getErrorMessage(error))}</p><div><a href="#orders" data-page="orders">Về danh sách</a><button type="button" data-order-retry>Thử lại</button></div></section>`; }
function renderInlineError(error) { return `<div class="admin-order-inline-error"><span>${escapeHtml(getErrorMessage(error))}</span><button type="button" data-order-retry>Thử lại</button></div>`; }
function getErrorMessage(error) {
  if (error?.status === 401) return "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.";
  if (error?.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (error?.status === 404) return "Không tìm thấy đơn hàng.";
  if (error?.status >= 500) return "Lỗi hệ thống, vui lòng thử lại.";
  return error?.message || "Không thể xử lý yêu cầu, vui lòng thử lại.";
}
function silentErrors() { return { showErrorToast: false }; }
function setBusy(root, busy) { root?.querySelectorAll?.("button, select, textarea, input").forEach((element) => { element.disabled = busy; }); }
function canCancel(order) { return ["pending", "confirmed"].includes(order.status); }
function badge(label, status) { const className = normalizePaymentStatus(status) || normalizeOrderStatus(status) || String(status || "neutral").toLowerCase(); return `<span class="admin-order-badge is-${escapeHtml(className)}">${escapeHtml(label)}</span>`; }
function orderStatusLabel(status) { return ({ pending: "Chờ xác nhận", confirmed: "Đã xác nhận", processing: "Đang xử lý", shipping: "Đang giao", completed: "Hoàn thành", cancelled: "Đã hủy", refunded: "Đã hoàn tiền" })[status] || status || "—"; }
function paymentStatusLabel(status) { return formatPaymentStatus(status); }
function paymentMethodLabel(method) { return formatPaymentMethod(method); }
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatCompactDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `<span>${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span><small>${date.toLocaleDateString("vi-VN")}</small>`;
}function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN"); }
function formatAddress(address = {}) { return address.full_address || address.fullAddress || [address.detail_address || address.detailAddress || address.address || address.line1, address.ward_name || address.wardName || address.ward, address.province_name || address.provinceName || address.province || address.city, address.country].filter(Boolean).join(", ") || "Chưa cập nhật"; }
function resolveImageUrl(url) { if (!url) return PLACEHOLDER_IMAGE; return globalThis.normalizeImageUrl?.(url) ?? url; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }



