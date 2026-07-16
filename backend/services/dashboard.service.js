/**
 * Dashboard service.
 * It prepares dashboard overview, charts, rankings, and monthly statistics for admin views.
 */
import { DashboardRepository } from "../repositories/dashboard.repository.js";
import { BaseService } from "./base.service.js";

const DEFAULT_MONTHS = 12;
const DEFAULT_LIMIT = 5;

export class DashboardService extends BaseService {
  constructor(repository = new DashboardRepository()) {
    super(repository);
  }

  async getOverview() {
    const overview = await this.repository.getOverview();
    return overview.toJSON();
  }

  async getRevenueChart(query = {}) {
    const months = normalizeMonths(query.months);
    const labels = createMonthLabels(months);
    const rows = await this.repository.getRevenueByMonth(createDateFrom(months));

    return mergeChartRows(labels, rows, ["revenue", "orders"]);
  }

  async getTopProducts(query = {}) {
    const limit = normalizeLimit(query.limit);
    const products = await this.repository.getTopProducts(limit);

    return products.map((product) => product.toJSON());
  }

  async getTopCustomers(query = {}) {
    const limit = normalizeLimit(query.limit);
    const customers = await this.repository.getTopCustomers(limit);

    return customers.map((customer) => customer.toJSON());
  }

  async getMonthlyStats(query = {}) {
    const months = normalizeMonths(query.months);
    const labels = createMonthLabels(months);
    const rows = await this.repository.getMonthlyStats(createDateFrom(months));
    const orderChart = mergeChartRows(labels, rows.orders, ["orders", "revenue"]);
    const customerChart = mergeChartRows(labels, rows.customers, ["customers"]);

    return labels.map((label) => ({
      label,
      orders: orderChart.find((item) => item.label === label)?.orders || 0,
      revenue: orderChart.find((item) => item.label === label)?.revenue || 0,
      customers: customerChart.find((item) => item.label === label)?.customers || 0
    }));
  }
}

function normalizeMonths(value) {
  const months = Number.parseInt(value, 10);

  if (!Number.isInteger(months) || months < 1) {
    return DEFAULT_MONTHS;
  }

  return Math.min(months, 24);
}

function normalizeLimit(value) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, 50);
}

function createDateFrom(months) {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - months + 1);

  return date;
}

function createMonthLabels(months) {
  const labels = [];
  const date = createDateFrom(months);

  for (let index = 0; index < months; index += 1) {
    labels.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    date.setMonth(date.getMonth() + 1);
  }

  return labels;
}

function mergeChartRows(labels, rows, numericFields) {
  const rowMap = new Map(rows.map((row) => [row.label, row.toJSON()]));

  return labels.map((label) => {
    const row = rowMap.get(label) || {};

    return numericFields.reduce((result, field) => {
      result[field] = Number(row[field] || 0);
      return result;
    }, { label });
  });
}
