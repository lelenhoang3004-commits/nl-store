import { AdminDashboardRepository } from "../repositories/admin-dashboard.repository.js";
import { BaseService } from "./base.service.js";

const ALLOWED_DAYS = [7, 14, 30];
const DEFAULT_DAYS = 7;
const DEFAULT_TOP_LIMIT = 5;
const DEFAULT_RECENT_LIMIT = 10;

export class AdminDashboardService extends BaseService {
  constructor(repository = new AdminDashboardRepository()) {
    super(repository);
  }

  async getDashboardOverview(query = {}) {
    const revenueOptions = normalizeRevenueOptions(query);
    const topLimit = normalizeLimit(query.topLimit ?? query.limit, DEFAULT_TOP_LIMIT);
    const recentLimit = normalizeLimit(query.recentLimit, DEFAULT_RECENT_LIMIT);
    const [summary, revenueRows, ordersByStatus, paymentsByMethod, topProducts, recentOrders] = await Promise.all([
      this.repository.getSummary(),
      this.repository.getRevenueByDateRange(revenueOptions),
      this.repository.getOrdersByStatus(),
      this.repository.getPaymentsByMethod(),
      this.repository.getTopProducts(topLimit),
      this.repository.getRecentOrders(recentLimit)
    ]);
    return {
      summary: normalizeSummary(summary),
      revenueChart: fillRevenueDates(revenueRows, revenueOptions),
      ordersByStatus: ordersByStatus.map(normalizeStatusRow),
      paymentsByMethod: paymentsByMethod.map(normalizePaymentRow),
      topProducts: topProducts.map(normalizeProduct),
      recentOrders: recentOrders.map(normalizeOrder)
    };
  }

  async getSummary() {
    return normalizeSummary(await this.repository.getSummary());
  }

  async getRevenue(query = {}) {
    const options = normalizeRevenueOptions(query);
    return fillRevenueDates(await this.repository.getRevenueByDateRange(options), options);
  }

  async getOrdersByStatus() {
    return (await this.repository.getOrdersByStatus()).map(normalizeStatusRow);
  }

  async getPaymentsByMethod() {
    return (await this.repository.getPaymentsByMethod()).map(normalizePaymentRow);
  }

  async getTopProducts(query = {}) {
    return (await this.repository.getTopProducts(normalizeLimit(query.limit, DEFAULT_TOP_LIMIT))).map(normalizeProduct);
  }

  async getRecentOrders(query = {}) {
    return (await this.repository.getRecentOrders(normalizeLimit(query.limit, DEFAULT_RECENT_LIMIT))).map(normalizeOrder);
  }
}

function normalizeRevenueOptions(query) {
  const days = ALLOWED_DAYS.includes(Number(query.days)) ? Number(query.days) : DEFAULT_DAYS;
  const dateTo = query.dateTo ? parseDate(query.dateTo) : startOfToday();
  const dateFrom = query.dateFrom ? parseDate(query.dateFrom) : addDays(dateTo, -(days - 1));
  return { days, dateFrom: formatSqlDate(dateFrom), dateTo: formatSqlDate(dateTo) };
}

function fillRevenueDates(rows, { dateFrom, dateTo }) {
  const byDate = new Map(rows.map((row) => [String(row.date), row]));
  const result = [];
  for (let date = parseDate(dateFrom), end = parseDate(dateTo); date <= end; date = addDays(date, 1)) {
    const key = formatSqlDate(date);
    const row = byDate.get(key) || {};
    result.push({ date: key, revenue: Number(row.revenue || 0), orders: Number(row.orders || 0) });
  }
  return result;
}

function normalizeSummary(row = {}) {
  return ["totalRevenue", "todayRevenue", "monthRevenue", "totalOrders", "todayOrders", "pendingOrders", "shippingOrders", "completedOrders", "cancelledOrders", "paidOrders", "unpaidOrders", "totalCustomers", "totalProducts"]
    .reduce((result, key) => ({ ...result, [key]: Number(row[key] || 0) }), {});
}

function normalizeStatusRow(row) { return { status: row.status, total: Number(row.total || 0) }; }
function normalizePaymentRow(row) { return { method: row.method, total: Number(row.total || 0), amount: Number(row.amount || 0) }; }
function normalizeProduct(row) { return { ...row, totalQuantity: Number(row.totalQuantity || 0), totalRevenue: Number(row.totalRevenue || 0) }; }
function normalizeOrder(row) { return { ...row, grandTotal: Number(row.grandTotal || 0) }; }
function normalizeLimit(value, fallback) { const limit = Number(value); return Number.isInteger(limit) && limit >= 1 ? Math.min(limit, 20) : fallback; }
function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date; }
function parseDate(value) { const date = new Date(`${String(value).slice(0, 10)}T00:00:00`); return date; }
function addDays(value, days) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }
function formatSqlDate(value) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }

export { ALLOWED_DAYS };
