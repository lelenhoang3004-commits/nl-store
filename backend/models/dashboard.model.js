/**
 * Dashboard models.
 * They provide predictable shapes for statistic cards, charts, and ranking data.
 */
import { BaseModel } from "./base.model.js";

export class DashboardOverview extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.totalProducts = Number(attributes.totalProducts || attributes.total_products || 0);
    this.totalCustomers = Number(attributes.totalCustomers || attributes.total_customers || 0);
    this.totalOrders = Number(attributes.totalOrders || attributes.total_orders || 0);
    this.totalRevenue = Number(attributes.totalRevenue || attributes.total_revenue || 0);
  }
}

export class DashboardChartPoint extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.label = attributes.label;
    this.revenue = Number(attributes.revenue || 0);
    this.orders = Number(attributes.orders || 0);
    this.customers = Number(attributes.customers || 0);
  }
}

export class DashboardRankingItem extends BaseModel {
  constructor(attributes = {}) {
    super();
    Object.assign(this, attributes);
  }
}
