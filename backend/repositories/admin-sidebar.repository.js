import { BaseRepository } from "./base.repository.js";
import { normalizeSqlParams } from "../utils/sql-query.util.js";

const LOW_STOCK_THRESHOLD = 5;

export class AdminSidebarRepository extends BaseRepository {
  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }

  async countProductsAttention(threshold = LOW_STOCK_THRESHOLD) {
    const [rows] = await this.execute(
      `SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.status = 'active'
        AND pv.deleted_at IS NULL
        AND pv.status <> 'inactive'
        AND (pv.status = 'out_of_stock' OR COALESCE(pv.stock, 0) <= ?)`,
      [threshold]
    );
    return Number(rows[0]?.total || 0);
  }

  async countPendingOrders() {
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM orders
      WHERE deleted_at IS NULL
        AND status = 'pending'`
    );
    return Number(rows[0]?.total || 0);
  }

  async countPendingPayments() {
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM payment_transactions pt
      INNER JOIN orders o ON o.id = pt.order_id AND o.deleted_at IS NULL
      WHERE LOWER(pt.status) IN ('pending', 'processing', 'customer_reported')
        AND LOWER(pt.status) NOT IN ('paid', 'success', 'failed', 'cancelled', 'expired', 'refunded')
        AND (
          LOWER(pt.status) IN ('processing', 'customer_reported')
          OR JSON_UNQUOTE(JSON_EXTRACT(pt.metadata, '$.customerReportedPaymentAt')) IS NOT NULL
        )`
    );
    return Number(rows[0]?.total || 0);
  }

  async countUnreadNewsletter() {
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM newsletter_subscribers
      WHERE status = 'subscribed'
        AND reviewed_at IS NULL`
    );
    return Number(rows[0]?.total || 0);
  }
}

export { LOW_STOCK_THRESHOLD };
