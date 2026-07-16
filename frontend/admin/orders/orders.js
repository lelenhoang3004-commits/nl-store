import { toast } from "../components/toast/toast.js";
import { hasPermission } from "../permissions/access-control.js";
import { PERMISSIONS } from "../permissions/permissions.js";
import { loadTemplate } from "../router/template-cache.js";
import { apiClient } from "../services/api/index.js";
import { API_CONFIG } from "../services/api/api.config.js";
import { orderService } from "../services/order.service.js";

const API_ORIGIN = new URL(API_CONFIG.baseURL).origin;
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23eef2f7'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%2364748b' font-size='13'%3EKhông có ảnh%3C/text%3E%3C/svg%3E";
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
        <td>${escapeHtml(order.customerName || "—")}</td>
        <td>${escapeHtml(order.customerPhone || "—")}</td>
        <td><strong>${formatCurrency(order.grandTotal)}</strong></td>
        <td>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</td>
        <td>${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</td>
        <td>${badge(orderStatusLabel(order.status), order.status)}</td>
        <td>${formatDate(order.createdAt)}</td>
        <td><div class="admin-order-actions">
          <a href="#orders/${order.id}" data-page="orders/${order.id}">Xem chi tiết</a>
          ${hasPermission(PERMISSIONS.ORDER_MANAGE) && STATUS_TRANSITIONS[order.status]?.length ? `<a href="#orders/${order.id}" data-page="orders/${order.id}">Cập nhật trạng thái</a>` : ""}
          ${canCancel(order) && hasPermission(PERMISSIONS.ORDER_CANCEL) ? `<button type="button" data-order-cancel="${order.id}">Hủy đơn</button>` : ""}
        </div></td>
      </tr>`).join("")
    : '<tr><td colspan="9" class="admin-order-empty">Không có đơn hàng phù hợp.</td></tr>';
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
  target.innerHTML = `<span>Trang ${page}/${totalPages} · ${Number(pagination.totalItems || 0)} đơn hàng</span><div><button type="button" data-order-page="${page - 1}" ${hasPrevious ? "" : "disabled"}>Trước</button><button type="button" data-order-page="${page + 1}" ${hasNext ? "" : "disabled"}>Sau</button></div>`;
}

function renderOrderDetail(detail) {
  const { order, items = [], payments = [], histories = [] } = detail;
  const shipping = order.shippingAddress || {};
  const allowedNext = STATUS_TRANSITIONS[order.status] || [];
  const canManage = hasPermission(PERMISSIONS.ORDER_MANAGE);
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
          <article class="admin-order-card" id="order-status-actions"><h2>Cập nhật trạng thái</h2>${canManage && allowedNext.length ? `<form data-order-status-form><select name="status" aria-label="Trạng thái tiếp theo">${allowedNext.map((status) => `<option value="${status}">${orderStatusLabel(status)}</option>`).join("")}</select><textarea name="note" maxlength="500" placeholder="Ghi chú cập nhật"></textarea><button type="submit">Cập nhật</button></form>` : '<p>Không còn bước chuyển trạng thái hợp lệ.</p>'}${canCancel(order) && hasPermission(PERMISSIONS.ORDER_CANCEL) ? '<button class="admin-order-danger" type="button" data-detail-cancel>Hủy đơn hàng</button>' : ""}</article>
          ${renderPaymentSummary(order)}
          <article class="admin-order-card"><h2>Giao dịch thanh toán</h2>${payments.length ? payments.map((payment) => renderPayment(payment, order.paymentStatus)).join("") : '<p>Chưa có giao dịch thanh toán</p>'}</article>
        </aside>
      </div>
    </section>`;
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
  return `<div class="admin-order-item"><img src="${escapeHtml(resolveImageUrl(item.productImageUrl))}" alt="${escapeHtml(item.productName || "Sản phẩm")}" data-order-product-image><div><strong>${escapeHtml(item.productName || "—")}</strong><span>SKU: ${escapeHtml(item.productSku || "—")}</span>${variants.length ? `<span>Size / Màu: ${escapeHtml(variants.join(" / "))}</span>` : ""}<span>Số lượng: ${Number(item.quantity || 0)}</span><span>Đơn giá: ${formatCurrency(item.unitPrice)}</span></div><strong>${formatCurrency(item.totalPrice)}</strong></div>`;
}

function renderHistory(entry) {
  return `<div><span></span><p><strong>${escapeHtml(orderStatusLabel(entry.status))}</strong><small>${escapeHtml(entry.note || "Cập nhật trạng thái")}</small><small>Người cập nhật: ${entry.changedBy ? `#${escapeHtml(entry.changedBy)}` : "Hệ thống"}</small><time>${formatDate(entry.createdAt)}</time></p></div>`;
}

function renderPaymentSummary(order) {
  return `<article class="admin-order-card"><h2>Tóm tắt thanh toán</h2><div class="admin-order-money"><p><span>Tạm tính</span><strong>${formatCurrency(order.subtotal)}</strong></p><p><span>Giảm giá</span><strong>${formatCurrency(order.discountTotal)}</strong></p><p><span>Phí vận chuyển</span><strong>${formatCurrency(order.shippingFee)}</strong></p><p><span>Thuế</span><strong>${formatCurrency(order.taxTotal)}</strong></p><p><span>Phương thức</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></p><p><span>Trạng thái</span>${badge(paymentStatusLabel(order.paymentStatus), order.paymentStatus)}</p><p><span>Đã thanh toán</span><strong>${formatCurrency(order.paidAmount)}</strong></p><p class="total"><span>Tổng tiền</span><strong>${formatCurrency(order.grandTotal)}</strong></p></div></article>`;
}

function renderPayment(payment, orderPaymentStatus) {
  const canConfirm = hasPermission(PERMISSIONS.PAYMENT_MANAGE) && payment.status !== "paid" && orderPaymentStatus !== "paid";
  return `<div class="admin-order-payment"><p><span>Mã giao dịch</span><strong>${escapeHtml(payment.transactionCode || "—")}</strong></p><p><span>Provider</span><strong>${escapeHtml(payment.provider || "—")}</strong></p><p><span>Phương thức</span><strong>${escapeHtml(paymentMethodLabel(payment.method))}</strong></p><p><span>Số tiền</span><strong>${formatCurrency(payment.amount)}</strong></p><p><span>Trạng thái</span>${badge(paymentStatusLabel(payment.status), payment.status)}</p><p><span>Ngày thanh toán</span><strong>${payment.paidAt ? formatDate(payment.paidAt) : "—"}</strong></p>${canConfirm ? `<button type="button" data-confirm-payment="${payment.id}">Xác nhận đã thanh toán</button>` : ""}</div>`;
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
      toast.success("Đã cập nhật trạng thái đơn hàng.");
      await refreshOrderDetail(root, orderId);
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
      toast.success("Đã xác nhận thanh toán.");
      await refreshOrderDetail(root, orderId);
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
  overlay.innerHTML = `<section class="admin-order-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title"><header><div><p class="admin-orders-eyebrow">Order Management</p><h2 id="cancel-order-title">Hủy đơn hàng</h2></div><button type="button" aria-label="Đóng" data-cancel-close>×</button></header><form data-cancel-form><label><span>Lý do hủy</span><textarea name="reason" maxlength="500" required placeholder="Nhập lý do hủy đơn...">Khách yêu cầu hủy</textarea></label><small>Tối đa 500 ký tự. Tồn kho sẽ được backend hoàn lại trong transaction.</small><footer><button type="button" data-cancel-close>Đóng</button><button type="submit" class="admin-order-danger">Xác nhận hủy</button></footer></form></section>`;
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  overlay.querySelectorAll("[data-cancel-close]").forEach((button) => button.addEventListener("click", closeCancelModal));
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeCancelModal(); });
  overlay.querySelector("[data-cancel-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") || "").trim();
    if (!reason) return toast.error("Vui lòng nhập lý do hủy đơn.");
    setBusy(form, true);
    try {
      await orderService.cancel(orderId, { reason }, silentErrors());
      closeCancelModal();
      toast.success("Đã hủy đơn và hoàn lại tồn kho.");
      await onSuccess?.();
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
function badge(label, status) { return `<span class="admin-order-badge is-${escapeHtml(status || "neutral")}">${escapeHtml(label)}</span>`; }
function orderStatusLabel(status) { return ({ pending: "Chờ xác nhận", confirmed: "Đã xác nhận", processing: "Đang xử lý", shipping: "Đang giao", completed: "Hoàn thành", cancelled: "Đã hủy", refunded: "Đã hoàn tiền" })[status] || status || "—"; }
function paymentStatusLabel(status) { return ({ unpaid: "Chưa thanh toán", pending: "Chờ thanh toán", partial: "Thanh toán một phần", paid: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền", cancelled: "Đã hủy" })[status] || status || "—"; }
function paymentMethodLabel(method) { return ({ cod: "COD", bank_transfer: "Chuyển khoản", vnpay: "VNPay", momo: "MoMo" })[method] || method || "—"; }
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN"); }
function formatAddress(address = {}) { return address.full_address || address.fullAddress || [address.detail_address || address.detailAddress || address.address || address.line1, address.ward_name || address.wardName || address.ward, address.province_name || address.provinceName || address.province || address.city, address.country].filter(Boolean).join(", ") || "Chưa cập nhật"; }
function resolveImageUrl(url) { if (!url) return PLACEHOLDER_IMAGE; if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url; if (url.startsWith("/uploads")) return `${API_ORIGIN}${url}`; if (url.startsWith("uploads")) return `${API_ORIGIN}/${url}`; return url; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
