/**
 * Dashboard repository.
 * It owns aggregate SQL for overview cards, charts, top products, top customers, and monthly statistics.
 */
import { BaseRepository } from "./base.repository.js";
import { DashboardChartPoint, DashboardOverview, DashboardRankingItem } from "../models/dashboard.model.js";
import { logger } from "../utils/logger.util.js";

export class DashboardRepository extends BaseRepository {
  async getOverview() {
    const startedAt = Date.now();
    const [[productRow], [customerRow], [orderRow], [revenueRow]] = await Promise.all([
      this.client.getPool().execute("SELECT COUNT(*) AS total_products FROM products WHERE deleted_at IS NULL"),
      this.client.getPool().execute("SELECT COUNT(*) AS total_customers FROM users WHERE deleted_at IS NULL AND role = 'CUSTOMER'"),
      this.client.getPool().execute("SELECT COUNT(*) AS total_orders FROM orders WHERE deleted_at IS NULL"),
      this.client.getPool().execute("SELECT COALESCE(SUM(paid_amount), 0) AS total_revenue FROM orders WHERE deleted_at IS NULL")
    ]);

    logger.sql("Dashboard overview queries executed.", {
      repository: "DashboardRepository",
      operation: "getOverview",
      durationMs: Date.now() - startedAt
    });

    return new DashboardOverview({
      total_products: productRow[0]?.total_products,
      total_customers: customerRow[0]?.total_customers,
      total_orders: orderRow[0]?.total_orders,
      total_revenue: revenueRow[0]?.total_revenue
    });
  }

  async getRevenueByMonth(dateFrom) {
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS label,
        COALESCE(SUM(paid_amount), 0) AS revenue,
        COUNT(*) AS orders
      FROM orders
      WHERE deleted_at IS NULL AND created_at >= ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY label ASC`,
      [dateFrom]
    );

    logger.sql("Dashboard revenue chart query executed.", {
      repository: "DashboardRepository",
      operation: "getRevenueByMonth",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new DashboardChartPoint(row));
  }

  async getTopProducts(limit) {
    const [rows] = await this.client.getPool().execute(
      `SELECT
        od.product_id AS productId,
        od.product_name AS productName,
        od.product_sku AS productSku,
        COALESCE(SUM(od.quantity), 0) AS soldQuantity,
        COALESCE(SUM(od.total_price), 0) AS revenue
      FROM order_details od
      INNER JOIN orders o ON o.id = od.order_id AND o.deleted_at IS NULL
      GROUP BY od.product_id, od.product_name, od.product_sku
      ORDER BY soldQuantity DESC, revenue DESC
      LIMIT ?`,
      [limit]
    );

    return rows.map((row) => new DashboardRankingItem(row));
  }

  async getTopCustomers(limit) {
    const [rows] = await this.client.getPool().execute(
      `SELECT
        customer_id AS customerId,
        customer_name AS customerName,
        customer_email AS customerEmail,
        COUNT(*) AS totalOrders,
        COALESCE(SUM(paid_amount), 0) AS totalSpent
      FROM orders
      WHERE deleted_at IS NULL
      GROUP BY customer_id, customer_name, customer_email
      ORDER BY totalSpent DESC, totalOrders DESC
      LIMIT ?`,
      [limit]
    );

    return rows.map((row) => new DashboardRankingItem(row));
  }

  async getMonthlyStats(dateFrom) {
    const [orderRows] = await this.client.getPool().execute(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS label,
        COUNT(*) AS orders,
        COALESCE(SUM(paid_amount), 0) AS revenue
      FROM orders
      WHERE deleted_at IS NULL AND created_at >= ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY label ASC`,
      [dateFrom]
    );
    const [customerRows] = await this.client.getPool().execute(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS label,
        COUNT(*) AS customers
      FROM users
      WHERE deleted_at IS NULL AND role = 'CUSTOMER' AND created_at >= ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY label ASC`,
      [dateFrom]
    );

    return {
      orders: orderRows.map((row) => new DashboardChartPoint(row)),
      customers: customerRows.map((row) => new DashboardChartPoint(row))
    };
  }
}
