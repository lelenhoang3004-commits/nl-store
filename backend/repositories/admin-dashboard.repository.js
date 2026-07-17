import { BaseRepository } from "./base.repository.js";
import { logger } from "../utils/logger.util.js";
import { sanitizePagination } from "../utils/sql-query.util.js";

const REVENUE_EXPRESSION = "COALESCE(NULLIF(paid_amount, 0), grand_total)";
const REVENUE_CONDITION = "status = 'completed' AND payment_status = 'paid'";

export class AdminDashboardRepository extends BaseRepository {
  async getSummary() {
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT
        COALESCE(SUM(CASE WHEN ${REVENUE_CONDITION} THEN ${REVENUE_EXPRESSION} ELSE 0 END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN ${REVENUE_CONDITION} AND DATE(created_at) = CURRENT_DATE THEN ${REVENUE_EXPRESSION} ELSE 0 END), 0) AS todayRevenue,
        COALESCE(SUM(CASE WHEN ${REVENUE_CONDITION} AND YEAR(created_at) = YEAR(CURRENT_DATE) AND MONTH(created_at) = MONTH(CURRENT_DATE) THEN ${REVENUE_EXPRESSION} ELSE 0 END), 0) AS monthRevenue,
        COUNT(*) AS totalOrders,
        SUM(DATE(created_at) = CURRENT_DATE) AS todayOrders,
        SUM(status = 'pending') AS pendingOrders,
        SUM(status = 'shipping') AS shippingOrders,
        SUM(status = 'completed') AS completedOrders,
        SUM(status = 'cancelled') AS cancelledOrders,
        SUM(payment_status = 'paid') AS paidOrders,
        SUM(payment_status IN ('unpaid', 'partial', 'failed')) AS unpaidOrders,
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'CUSTOMER') AS totalCustomers,
        (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS totalProducts
      FROM orders
      WHERE deleted_at IS NULL`
    );
    this.log("getSummary", startedAt);
    return rows[0] || {};
  }

  async getRevenueByDateRange({ dateFrom, dateTo }) {
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
        COALESCE(SUM(${REVENUE_EXPRESSION}), 0) AS revenue,
        COUNT(*) AS orders
      FROM orders
      WHERE deleted_at IS NULL
        AND ${REVENUE_CONDITION}
        AND created_at >= ?
        AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d') ASC`,
      [dateFrom, dateTo]
    );
    this.log("getRevenueByDateRange", startedAt);
    return rows;
  }

  async getOrdersByStatus() {
    const [rows] = await this.client.getPool().execute(
      `SELECT status, COUNT(*) AS total
      FROM orders
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY status ASC`
    );
    return rows;
  }

  async getPaymentsByMethod() {
    const [rows] = await this.client.getPool().execute(
      `SELECT COALESCE(payment_method, 'unknown') AS method,
        COUNT(*) AS total,
        COALESCE(SUM(grand_total), 0) AS amount
      FROM orders
      WHERE deleted_at IS NULL
      GROUP BY payment_method
      ORDER BY total DESC, method ASC`
    );
    return rows;
  }

  async getTopProducts(limit) {
    const pagination = sanitizePagination(limit, 0, 5);
    const [rows] = await this.client.getPool().execute(
      `SELECT od.product_id AS productId,
        od.product_name AS productName,
        od.product_sku AS productSku,
        od.product_image_url AS productImageUrl,
        COALESCE(SUM(od.quantity), 0) AS totalQuantity,
        COALESCE(SUM(od.total_price), 0) AS totalRevenue
      FROM order_details od
      INNER JOIN orders o ON o.id = od.order_id
      WHERE o.deleted_at IS NULL
        AND o.status = 'completed'
        AND o.payment_status = 'paid'
      GROUP BY od.product_id, od.product_name, od.product_sku, od.product_image_url
      ORDER BY totalQuantity DESC, totalRevenue DESC
      LIMIT ${pagination.limit}`
    );
    return rows;
  }

  async getRecentOrders(limit) {
    const pagination = sanitizePagination(limit, 0, 10);
    const [rows] = await this.client.getPool().execute(
      `SELECT id, order_code AS orderCode, customer_name AS customerName,
        payment_method AS paymentMethod, payment_status AS paymentStatus,
        status, grand_total AS grandTotal, created_at AS createdAt
      FROM orders
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT ${pagination.limit}`
    );
    return rows;
  }

  log(operation, startedAt) {
    logger.sql("Admin dashboard query executed.", {
      repository: "AdminDashboardRepository",
      operation,
      durationMs: Date.now() - startedAt
    });
  }
}

export { REVENUE_CONDITION, REVENUE_EXPRESSION };
