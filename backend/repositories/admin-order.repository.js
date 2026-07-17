import { BaseRepository } from "./base.repository.js";
import { Order, OrderDetail, OrderHistory } from "../models/order.model.js";
import { PaymentTransaction } from "../models/payment.model.js";
import { logger } from "../utils/logger.util.js";
import { normalizeSqlParams, sanitizePagination } from "../utils/sql-query.util.js";

const SORT_COLUMNS = Object.freeze({
  createdAt: "created_at",
  updatedAt: "updated_at",
  orderCode: "order_code",
  customerName: "customer_name",
  grandTotal: "grand_total",
  status: "status",
  paymentStatus: "payment_status"
});

const ORDER_COLUMNS = `
  id, order_code, customer_id, customer_name, customer_email, customer_phone,
  shipping_address, status, payment_status, payment_method, subtotal,
  discount_total, shipping_fee, tax_total, grand_total, paid_amount, note,
  created_at, updated_at
`;

export class AdminOrderRepository extends BaseRepository {
  async findAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sortBy] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sortDirection === "asc" ? "ASC" : "DESC";
    const pagination = sanitizePagination(options.limit, options.offset);
    const [rows] = await this.execute(
      `SELECT ${ORDER_COLUMNS}
      FROM orders
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
      params
    );

    this.log("findAll", startedAt);
    return rows.map((row) => new Order(row));
  }

  async countAll(options) {
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.execute(`SELECT COUNT(*) AS total FROM orders ${whereSql}`, params);
    return Number(rows[0]?.total || 0);
  }

  async findById(id, connection = null, lockForUpdate = false) {
    const [rows] = await this.execute(
      `SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1${lockForUpdate ? " FOR UPDATE" : ""}`,
      [id],
      connection
    );
    return rows[0] ? new Order(rows[0]) : null;
  }

  async findItemsByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT id, order_id, product_id, product_name, product_sku, product_image_url,
        quantity, unit_price, discount_amount, total_price
      FROM order_details
      WHERE order_id = ?
      ORDER BY id ASC`,
      [orderId],
      connection
    );
    return rows.map((row) => new OrderDetail(row));
  }

  async findPaymentByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT pt.id, pt.order_id, o.order_code, pt.payment_method_id,
        pt.transaction_code, pt.provider, pt.method, pt.amount, pt.currency,
        pt.status, pt.paid_at, pt.metadata, pt.created_at, pt.updated_at
      FROM payment_transactions pt
      INNER JOIN orders o ON o.id = pt.order_id AND o.deleted_at IS NULL
      WHERE pt.order_id = ?
      ORDER BY pt.created_at DESC, pt.id DESC`,
      [orderId],
      connection
    );
    return rows.map((row) => new PaymentTransaction(row));
  }

  async findHistoriesByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT id, order_id, status, note, changed_by, created_at
      FROM order_histories
      WHERE order_id = ?
      ORDER BY created_at ASC, id ASC`,
      [orderId],
      connection
    );
    return rows.map((row) => new OrderHistory(row));
  }

  async updateStatus(id, status, connection = null) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [status, id],
      connection
    );
    this.log("updateStatus", startedAt);
    return result.affectedRows > 0;
  }

  async updateCancelled(id, connection = null) {
    return this.updateStatus(id, "cancelled", connection);
  }

  async createOrderHistory(payload, connection = null) {
    const startedAt = Date.now();
    await this.execute(
      `INSERT INTO order_histories (order_id, status, note, changed_by)
      VALUES (?, ?, ?, ?)`,
      [payload.orderId, payload.status, payload.note, payload.changedBy],
      connection
    );
    this.log("createOrderHistory", startedAt);
  }

  async restoreInventory(items, connection) {
    for (const item of items) {
      if (!item.productId || item.quantity <= 0) continue;
      await connection.execute(
        `UPDATE products
        SET stock = stock + ?,
          sold = GREATEST(sold - ?, 0),
          status = CASE WHEN status = 'out_of_stock' THEN 'active' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [item.quantity, item.quantity, item.productId]
      );
    }
    logger.sql("Cancelled order inventory restore queries executed.", {
      repository: "AdminOrderRepository",
      operation: "restoreInventory",
      itemCount: items.length
    });
  }

  buildWhereClause(options) {
    const conditions = ["deleted_at IS NULL"];
    const params = [];
    if (options.search) {
      conditions.push("(order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)");
      const keyword = `%${options.search}%`;
      params.push(keyword, keyword, keyword);
    }
    [["status", "status"], ["paymentStatus", "payment_status"], ["paymentMethod", "payment_method"]].forEach(([key, column]) => {
      if (options[key]) {
        conditions.push(`${column} = ?`);
        params.push(options[key]);
      }
    });
    if (options.dateFrom) {
      conditions.push("created_at >= ?");
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push("created_at <= ?");
      params.push(options.dateTo);
    }
    return { whereSql: `WHERE ${conditions.join(" AND ")}`, params };
  }

  execute(sql, params = [], connection = null) {
    const safeParams = normalizeSqlParams(params);
    return connection ? connection.execute(sql, safeParams) : this.client.getPool().execute(sql, safeParams);
  }

  log(operation, startedAt) {
    logger.sql("Admin order query executed.", {
      repository: "AdminOrderRepository",
      operation,
      durationMs: Date.now() - startedAt
    });
  }
}
