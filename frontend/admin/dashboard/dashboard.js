import { toast } from "../components/toast/toast.js";
import { loadTemplate } from "../router/template-cache.js";
import { API_CONFIG } from "../services/api/api.config.js";
import { dashboardService } from "../services/dashboard.service.js";

const API_ORIGIN = new URL(API_CONFIG.baseURL).origin;
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23eef2f7'/%3E%3Ctext x='50%25' y='53%25' text-anchor='middle' fill='%2364748b' font-size='12'%3ENo image%3C/text%3E%3C/svg%3E";
const STATUS_ORDER = ["pending", "confirmed", "processing", "shipping", "completed", "cancelled"];
const PAYMENT_METHODS = ["cod", "bank_transfer", "vnpay", "momo"];

let dashboardState = null;
let dashboardError = null;

export async function createDashboard() {
  const template = await loadTemplate(new URL("./index.html", import.meta.url));
  try {
    dashboardState = (await dashboardService.getOverview(
      { days: 7, topLimit: 5, recentLimit: 10 },
      silentErrors()
    )).data;
    dashboardError = null;
  } catch (error) {
    dashboardError = error;
  }
  return template;
}

export function initDashboard(root = document) {
  if (dashboardError) renderError(root, dashboardError);
  else renderDashboard(root, dashboardState || emptyDashboard());

  root.querySelector("[data-dashboard-error]")?.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-dashboard-retry]")) return;
    await reloadDashboard(root);
  });

  root.querySelector("[data-dashboard-days]")?.addEventListener("change", async (event) => {
    const select = event.currentTarget;
    select.disabled = true;
    try {
      const response = await dashboardService.getRevenue({ days: select.value }, silentErrors());
      dashboardState = { ...(dashboardState || emptyDashboard()), revenueChart: response.data?.revenueChart || [] };
      renderRevenueChart(root, dashboardState.revenueChart);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      select.disabled = false;
    }
  });
}

async function reloadDashboard(root) {
  setBusy(root, true);
  try {
    dashboardState = (await dashboardService.getOverview(
      { days: root.querySelector("[data-dashboard-days]")?.value || 7, topLimit: 5, recentLimit: 10 },
      silentErrors()
    )).data;
    dashboardError = null;
    hideError(root);
    renderDashboard(root, dashboardState || emptyDashboard());
  } catch (error) {
    dashboardError = error;
    renderError(root, error);
  } finally {
    setBusy(root, false);
  }
}

function renderDashboard(root, data) {
  hideError(root);
  renderSummary(root, data.summary || {});
  renderSecondarySummary(root, data.summary || {});
  renderRevenueChart(root, data.revenueChart || []);
  renderOrdersByStatus(root, data.ordersByStatus || []);
  renderPaymentsByMethod(root, data.paymentsByMethod || []);
  renderTopProducts(root, data.topProducts || []);
  renderRecentOrders(root, data.recentOrders || []);
  bindImageFallback(root);
}

function renderSecondarySummary(root, summary) {
  const target = root.querySelector("[data-dashboard-secondary]");
  if (!target) return;
  const items = [
    ["Đơn hôm nay", summary.todayOrders],
    ["Đơn đã thanh toán", summary.paidOrders],
    ["Đơn chưa thanh toán", summary.unpaidOrders],
    ["Khách hàng", summary.totalCustomers],
    ["Sản phẩm", summary.totalProducts]
  ];
  target.innerHTML = items.map(([label, value]) => `<div><span>${label}</span><strong>${formatNumber(value)}</strong></div>`).join("");
}

function renderSummary(root, summary) {
  const target = root.querySelector("[data-dashboard-stats]");
  if (!target) return;
  const cards = [
    ["Tổng doanh thu", formatCurrency(summary.totalRevenue), "fa-coins"],
    ["Doanh thu hôm nay", formatCurrency(summary.todayRevenue), "fa-calendar-day"],
    ["Doanh thu tháng này", formatCurrency(summary.monthRevenue), "fa-chart-line"],
    ["Tổng đơn hàng", formatNumber(summary.totalOrders), "fa-bag-shopping"],
    ["Đơn chờ xác nhận", formatNumber(summary.pendingOrders), "fa-clock"],
    ["Đơn đang giao", formatNumber(summary.shippingOrders), "fa-truck-fast"],
    ["Đơn hoàn thành", formatNumber(summary.completedOrders), "fa-circle-check"],
    ["Đơn đã hủy", formatNumber(summary.cancelledOrders), "fa-circle-xmark"]
  ];
  target.innerHTML = cards.map(([label, value, icon]) => `<article class="stat-card"><span class="stat-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><div><p class="stat-label">${label}</p><strong class="stat-value">${value}</strong></div></article>`).join("");
}

function renderRevenueChart(root, rows) {
  const target = root.querySelector("[data-revenue-chart]");
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = emptyState("Chưa có dữ liệu doanh thu.");
    return;
  }
  const maxRevenue = Math.max(...rows.map((row) => Number(row.revenue || 0)), 1);
  target.innerHTML = rows.map((row) => {
    const height = Number(row.revenue || 0) > 0 ? Math.max(8, (Number(row.revenue) / maxRevenue) * 100) : 2;
    return `<div class="revenue-column" title="${formatDateOnly(row.date)}: ${formatCurrency(row.revenue)} (${formatNumber(row.orders)} đơn)"><strong>${formatCompactCurrency(row.revenue)}</strong><div class="revenue-track"><span style="height:${height}%"></span></div><small>${formatShortDate(row.date)}</small></div>`;
  }).join("");
}

function renderOrdersByStatus(root, rows) {
  const target = root.querySelector("[data-orders-status]");
  if (!target) return;
  const totals = new Map(rows.map((row) => [row.status, Number(row.total || 0)]));
  target.innerHTML = STATUS_ORDER.map((status) => `<div><span>${orderStatusLabel(status)}</span><strong>${formatNumber(totals.get(status) || 0)}</strong></div>`).join("");
}

function renderPaymentsByMethod(root, rows) {
  const target = root.querySelector("[data-payment-methods]");
  if (!target) return;
  const values = new Map(rows.map((row) => [row.method, row]));
  target.innerHTML = PAYMENT_METHODS.map((method) => {
    const row = values.get(method) || {};
    return `<div><span>${paymentMethodLabel(method)}<small>${formatCurrency(row.amount || 0)}</small></span><strong>${formatNumber(row.total || 0)} đơn</strong></div>`;
  }).join("");
}

function renderTopProducts(root, products) {
  const target = root.querySelector("[data-top-products]");
  if (!target) return;
  target.innerHTML = products.length ? products.map((product, index) => `<div class="product-item"><span class="product-rank">${index + 1}</span><img src="${escapeHtml(resolveImageUrl(product.productImageUrl))}" alt="${escapeHtml(product.productName || "Sản phẩm")}" data-dashboard-image><div class="item-copy"><strong>${escapeHtml(product.productName || "—")}</strong><span>SKU: ${escapeHtml(product.productSku || "—")} · Đã bán ${formatNumber(product.totalQuantity)}</span></div><span class="item-value">${formatCurrency(product.totalRevenue)}</span></div>`).join("") : emptyState("Chưa có sản phẩm bán chạy.");
}

function renderRecentOrders(root, orders) {
  const target = root.querySelector("[data-recent-orders]");
  if (!target) return;
  target.innerHTML = orders.length ? orders.map((order) => `<tr><td><strong>${escapeHtml(order.orderCode || "—")}</strong></td><td>${escapeHtml(order.customerName || "—")}</td><td><strong>${formatCurrency(order.grandTotal)}</strong></td><td><span class="dashboard-badge is-${escapeHtml(order.paymentStatus || "neutral")}">${escapeHtml(paymentStatusLabel(order.paymentStatus))}</span><small>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</small></td><td><span class="dashboard-badge is-${escapeHtml(order.status || "neutral")}">${escapeHtml(orderStatusLabel(order.status))}</span></td><td>${formatDate(order.createdAt)}</td><td><a href="#orders/${order.id}" data-page="orders/${order.id}">Chi tiết</a></td></tr>`).join("") : `<tr><td colspan="7">${emptyState("Chưa có đơn hàng.")}</td></tr>`;
}

function renderError(root, error) {
  const target = root.querySelector("[data-dashboard-error]");
  if (!target) return;
  target.hidden = false;
  target.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><div><strong>Không thể tải dashboard</strong><p>${escapeHtml(getErrorMessage(error))}</p></div><button type="button" data-dashboard-retry>Thử lại</button>`;
  root.querySelector("[data-dashboard-stats]").innerHTML = "";
  root.querySelector("[data-dashboard-secondary]").innerHTML = "";
  root.querySelectorAll("[data-revenue-chart], [data-orders-status], [data-payment-methods], [data-top-products], [data-recent-orders]").forEach((element) => { element.innerHTML = ""; });
}

function hideError(root) { const target = root.querySelector("[data-dashboard-error]"); if (target) { target.hidden = true; target.innerHTML = ""; } }
function bindImageFallback(root) { root.querySelectorAll("[data-dashboard-image]").forEach((image) => image.addEventListener("error", () => { image.src = PLACEHOLDER_IMAGE; }, { once: true })); }
function getErrorMessage(error) { if (error?.status === 401) return "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại."; if (error?.status === 403) return "Bạn không có quyền xem dashboard."; if (error?.status >= 500) return "Lỗi hệ thống, vui lòng thử lại."; return error?.message || "Không thể tải dữ liệu dashboard."; }
function emptyDashboard() { return { summary: {}, revenueChart: [], ordersByStatus: [], paymentsByMethod: [], topProducts: [], recentOrders: [] }; }
function emptyState(message) { return `<p class="dashboard-empty">${escapeHtml(message)}</p>`; }
function silentErrors() { return { showErrorToast: false }; }
function setBusy(root, busy) { root.querySelectorAll("button, select").forEach((element) => { element.disabled = busy; }); }
function resolveImageUrl(url) { if (!url) return PLACEHOLDER_IMAGE; return globalThis.normalizeImageUrl?.(url) ?? url; }
function orderStatusLabel(status) { return ({ pending: "Chờ xác nhận", confirmed: "Đã xác nhận", processing: "Đang xử lý", shipping: "Đang giao", completed: "Hoàn thành", cancelled: "Đã hủy", refunded: "Đã hoàn tiền" })[status] || status || "—"; }
function paymentStatusLabel(status) { return ({ unpaid: "Chưa thanh toán", partial: "Thanh toán một phần", paid: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền" })[status] || status || "—"; }
function paymentMethodLabel(method) { return ({ cod: "COD", bank_transfer: "Bank Transfer", vnpay: "VNPay", momo: "MoMo", unknown: "Chưa xác định" })[method] || method || "—"; }
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatCompactCurrency(value) { return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0)); }
function formatNumber(value) { return new Intl.NumberFormat("vi-VN").format(Number(value || 0)); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN"); }
function formatDateOnly(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN"); }
function formatShortDate(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? "—" : `${date.getDate()}/${date.getMonth() + 1}`; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
