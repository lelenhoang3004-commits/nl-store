import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../../assets/js/notify.js";
import { loadTemplate } from "../router/template-cache.js";
import { API_CONFIG } from "../services/api/api.config.js";
import { dashboardService } from "../services/dashboard.service.js";

const API_ORIGIN = new URL(API_CONFIG.baseURL).origin;
const PLACEHOLDER_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23f8fafc'/%3E%3Cstop offset='1' stop-color='%23e2e8f0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' rx='28' fill='url(%23g)'/%3E%3Cpath d='M55 101l13-22 11 16 10-12 16 18H55z' fill='%23cbd5e1'/%3E%3Ccircle cx='100' cy='59' r='11' fill='%23cbd5e1'/%3E%3C/svg%3E";
const STATUS_ORDER = ["pending", "confirmed", "processing", "shipping", "completed", "cancelled"];
const PAYMENT_METHODS = [
  { key: "cod", aliases: ["cod"], label: "Thanh toán khi nhận hàng", icon: "fa-money-bill-wave", tone: "cash" },
  { key: "bank_transfer", aliases: ["bank_transfer", "bank", "BANK_PERSONAL_QR"], label: "Chuyển khoản ngân hàng", icon: "fa-building-columns", tone: "bank" },
  { key: "momo", aliases: ["momo", "MOMO_PERSONAL_QR"], label: "MoMo", icon: "fa-wallet", tone: "momo" },
  { key: "credit_card", aliases: ["credit_card", "CREDIT_CARD_DEMO"], label: "Thẻ tín dụng", icon: "fa-credit-card", tone: "card" }
];
const STATUS_META = {
  pending: { label: "Chờ xác nhận", icon: "fa-comment-dots", tone: "pending" },
  confirmed: { label: "Đã xác nhận", icon: "fa-box", tone: "confirmed" },
  processing: { label: "Đang xử lý", icon: "fa-hourglass-half", tone: "processing" },
  shipping: { label: "Đang giao", icon: "fa-truck-fast", tone: "shipping" },
  completed: { label: "Hoàn thành", icon: "fa-circle-check", tone: "completed" },
  cancelled: { label: "Đã hủy", icon: "fa-circle-xmark", tone: "cancelled" }
};

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
      notifyError(getErrorMessage(error));
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
    ["Đơn hôm nay", summary.todayOrders, "fa-receipt"],
    ["Đơn đã thanh toán", summary.paidOrders, "fa-wallet"],
    ["Đơn chưa thanh toán", summary.unpaidOrders, "fa-clock"],
    ["Khách hàng", summary.totalCustomers, "fa-users"],
    ["Sản phẩm", summary.totalProducts, "fa-box"]
  ];
  target.innerHTML = items.map(([label, value, icon]) => `<article><span class="secondary-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><div><span>${label}</span><strong>${formatNumber(value)}</strong></div></article>`).join("");
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
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const averageRevenue = rows.length ? totalRevenue / rows.length : 0;
  const maxRevenue = Math.max(...rows.map((row) => Number(row.revenue || 0)), 1);
  target.innerHTML = `<div class="revenue-summary"><article><span>Tổng doanh thu</span><strong>${formatCurrency(totalRevenue)}</strong><i class="fa-solid fa-coins" aria-hidden="true"></i></article><article><span>Trung bình / ngày</span><strong>${formatCurrency(averageRevenue)}</strong><i class="fa-solid fa-chart-line" aria-hidden="true"></i></article></div><div class="revenue-bars-inner">${rows.map((row) => {
    const revenue = Number(row.revenue || 0);
    const height = revenue > 0 ? Math.max(8, (revenue / maxRevenue) * 100) : 2;
    return `<div class="revenue-column" title="${formatDateOnly(row.date)}: ${formatCurrency(revenue)} (${formatNumber(row.orders)} đơn)"><strong>${formatCompactCurrency(revenue)}</strong><div class="revenue-track"><span style="height:${height}%"></span></div><small>${formatShortDate(row.date)}</small></div>`;
  }).join("")}</div>`;
}

function renderOrdersByStatus(root, rows) {
  const target = root.querySelector("[data-orders-status]");
  if (!target) return;
  const totals = new Map(rows.map((row) => [normalizeKey(row.status), Number(row.total || 0)]));
  const grandTotal = STATUS_ORDER.reduce((sum, status) => sum + Number(totals.get(status) || 0), 0);
  target.innerHTML = `${STATUS_ORDER.map((status) => {
    const meta = STATUS_META[status];
    const total = totals.get(status) || 0;
    const percent = grandTotal ? (total / grandTotal) * 100 : 0;
    return `<div class="status-row is-${meta.tone}"><span class="status-icon"><i class="fa-solid ${meta.icon}" aria-hidden="true"></i></span><span class="status-label">${meta.label}</span><span class="dashboard-progress"><i style="width:${percent}%"></i></span><strong>${formatNumber(total)}</strong></div>`;
  }).join("")}<div class="status-total"><span>Tổng cộng</span><strong>${formatNumber(grandTotal)}</strong></div>`;
}

function renderPaymentsByMethod(root, rows) {
  const target = root.querySelector("[data-payment-methods]");
  if (!target) return;
  const buckets = new Map(PAYMENT_METHODS.map((method) => [method.key, { ...method, total: 0, amount: 0 }]));
  const extras = [];
  rows.forEach((row) => {
    const key = resolvePaymentBucket(row.method);
    const total = Number(row.total || 0);
    const amount = Number(row.amount || 0);
    if (key && buckets.has(key)) {
      const bucket = buckets.get(key);
      bucket.total += total;
      bucket.amount += amount;
    } else if (total > 0 || amount > 0) {
      extras.push({ key: normalizeKey(row.method) || "unknown", label: paymentMethodLabel(row.method), icon: "fa-credit-card", tone: "other", total, amount });
    }
  });
  const methods = [...buckets.values(), ...extras];
  const maxTotal = Math.max(...methods.map((method) => Number(method.total || 0)), 1);
  const totalOrders = methods.reduce((sum, method) => sum + Number(method.total || 0), 0);
  const totalAmount = methods.reduce((sum, method) => sum + Number(method.amount || 0), 0);
  target.innerHTML = `${methods.map((method) => {
    const percent = (Number(method.total || 0) / maxTotal) * 100;
    return `<div class="payment-row is-${method.tone}"><span class="payment-icon"><i class="fa-solid ${method.icon}" aria-hidden="true"></i></span><span class="payment-name">${escapeHtml(method.label)}</span><span class="dashboard-progress"><i style="width:${percent}%"></i></span><strong>${formatNumber(method.total)} đơn</strong><b>${formatCurrency(method.amount)}</b></div>`;
  }).join("")}<div class="payment-total"><span>Tổng cộng</span><strong>${formatNumber(totalOrders)} đơn</strong><b>${formatCurrency(totalAmount)}</b></div>`;
}

function renderTopProducts(root, products) {
  const target = root.querySelector("[data-top-products]");
  if (!target) return;
  const topFive = [...products]
    .sort((a, b) => Number(b.totalQuantity || 0) - Number(a.totalQuantity || 0) || Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0))
    .slice(0, 5);
  if (!topFive.length) {
    target.innerHTML = `${emptyState("Chưa có sản phẩm bán chạy từ đơn hoàn thành và đã thanh toán.")}<a class="top-products-link" href="#products" data-page="products">Xem tất cả sản phẩm <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a>`;
    return;
  }
  const maxQuantity = Math.max(...topFive.map((product) => Number(product.totalQuantity || 0)), 1);
  target.innerHTML = `${topFive.map((product, index) => renderTopProduct(product, index, maxQuantity)).join("")}<a class="top-products-link" href="#products" data-page="products">Xem tất cả sản phẩm <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></a>`;
}

function renderTopProduct(product, index, maxQuantity) {
  const rank = index + 1;
  const quantity = Number(product.totalQuantity || 0);
  const percent = Math.max(0, Math.min(100, maxQuantity ? (quantity / maxQuantity) * 100 : 0));
  const rankClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "blue";
  const crown = rank === 1 ? '<i class="fa-solid fa-crown" aria-hidden="true"></i>' : "";
  return `<article class="top-product-row is-${rankClass}">
    <span class="top-product-rank">${crown}<b>${rank}</b></span>
    <img class="top-product-image" src="${globalThis.FASHION_IMAGE_PLACEHOLDER || PLACEHOLDER_IMAGE}" data-product-image-src="${escapeHtml(resolveImageUrl(product.productImageUrl))}" alt="${escapeHtml(product.productName || "Sản phẩm")}" loading="lazy" decoding="async" data-product-image data-dashboard-image>
    <div class="top-product-info">
      <strong title="${escapeHtml(product.productName || "Sản phẩm")}">${escapeHtml(product.productName || "Sản phẩm")}</strong>
      <span>SKU: ${escapeHtml(product.productSku || "—")}</span>
      <small><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> Đã bán <b>${formatNumber(quantity)}</b></small>
    </div>
    <div class="top-product-progress"><span><i style="width:${percent}%"></i></span><small>${Math.round(percent)}%</small></div>
    <div class="top-product-revenue"><span>Doanh thu</span><strong>${formatCurrency(product.totalRevenue)}</strong>${renderTrend(product)}</div>
  </article>`;
}

function renderTrend(product) {
  const trend = product.trendPercent ?? product.growthPercent ?? product.revenueTrendPercent;
  if (trend === undefined || trend === null || trend === "") return "";
  const value = Number(trend);
  if (!Number.isFinite(value)) return "";
  const direction = value >= 0 ? "up" : "down";
  return `<em class="top-product-trend is-${direction}"><i class="fa-solid fa-arrow-${direction}" aria-hidden="true"></i>${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</em>`;
}

function renderRecentOrders(root, orders) {
  const target = root.querySelector("[data-recent-orders]");
  if (!target) return;
  target.innerHTML = orders.length ? orders.map((order) => `<tr><td><strong>${escapeHtml(order.orderCode || "—")}</strong></td><td>${escapeHtml(order.customerName || "—")}</td><td><strong>${formatCurrency(order.grandTotal)}</strong></td><td><span class="dashboard-badge is-${escapeHtml(normalizeKey(order.paymentStatus) || "neutral")}">${escapeHtml(paymentStatusLabel(order.paymentStatus))}</span><small>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</small></td><td><span class="dashboard-badge is-${escapeHtml(normalizeKey(order.status) || "neutral")}">${escapeHtml(orderStatusLabel(order.status))}</span></td><td>${formatDate(order.createdAt)}</td><td><a href="#orders/${order.id}" data-page="orders/${order.id}">Chi tiết</a></td></tr>`).join("") : `<tr><td colspan="7">${emptyState("Chưa có đơn hàng.")}</td></tr>`;
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
function normalizeKey(value) { return String(value || "").trim().toLowerCase(); }
function resolvePaymentBucket(method) { const normalized = normalizeKey(method); return PAYMENT_METHODS.find((item) => item.aliases.some((alias) => normalizeKey(alias) === normalized))?.key || null; }
function orderStatusLabel(status) { return STATUS_META[normalizeKey(status)]?.label || status || "—"; }
function paymentStatusLabel(status) { return ({ unpaid: "Chưa thanh toán", pending: "Chờ thanh toán", partial: "Thanh toán một phần", paid: "Đã thanh toán", failed: "Thanh toán thất bại", refunded: "Đã hoàn tiền", cancelled: "Đã hủy" })[normalizeKey(status)] || status || "—"; }
function paymentMethodLabel(method) {
  const bucket = PAYMENT_METHODS.find((item) => item.aliases.some((alias) => normalizeKey(alias) === normalizeKey(method)));
  return bucket?.label || ({ unknown: "Chưa xác định" })[normalizeKey(method)] || method || "—";
}
function formatCurrency(value) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatCompactCurrency(value) { return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0)); }
function formatNumber(value) { return new Intl.NumberFormat("vi-VN").format(Number(value || 0)); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN"); }
function formatDateOnly(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN"); }
function formatShortDate(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? "—" : `${date.getDate()}/${date.getMonth() + 1}`; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
