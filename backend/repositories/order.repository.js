/**
 * Order repository.
 * It owns MySQL access for orders, order details, status history, and payment transactions.
 */
import { BaseRepository } from "./base.repository.js";
import { Order, OrderDetail, OrderHistory, OrderTransaction } from "../models/order.model.js";
import { logger } from "../utils/logger.util.js";
import { normalizeSqlParams, sanitizePagination } from "../utils/sql-query.util.js";

const SORT_COLUMNS = Object.freeze({
  orderCode: "order_code",
  status: "status",
  paymentStatus: "payment_status",
  grandTotal: "grand_total",
  paidAmount: "paid_amount",
  createdAt: "created_at",
  updatedAt: "updated_at"
});

const ORDER_COLUMNS = `
  id,
  order_code,
  customer_id,
  customer_name,
  customer_email,
  customer_phone,
  shipping_address,
  status,
  payment_status,
  payment_method,
  subtotal,
  discount_total,
  shipping_fee,
  tax_total,
  grand_total,
  paid_amount,
  note,
  created_at,
  updated_at
`;

const ORDER_STATUS_CANCELLED = "cancelled";

export class OrderRepository extends BaseRepository {
  async findAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const pagination = sanitizePagination(options.pagination.limit, options.pagination.offset);
    const [rows] = await this.execute(
      `SELECT ${ORDER_COLUMNS}
      FROM orders
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
      params
    );

    logger.sql("Order list query executed.", {
      repository: "OrderRepository",
      operation: "findAll",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new Order(row));
  }

  async countAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM orders
      ${whereSql}`,
      params
    );

    logger.sql("Order count query executed.", {
      repository: "OrderRepository",
      operation: "countAll",
      durationMs: Date.now() - startedAt
    });

    return Number(rows[0]?.total || 0);
  }

  async findByIdForUpdate(id, connection) {
    const [rows] = await this.execute(
      `SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE`,
      [id],
      connection
    );

    return rows[0] ? new Order(rows[0]) : null;
  }

  async findById(id) {
    const startedAt = Date.now();
    const [rows] = await this.execute(
      `SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1`,
      [id]
    );

    logger.sql("Order lookup by id executed.", {
      repository: "OrderRepository",
      operation: "findById",
      durationMs: Date.now() - startedAt
    });

    if (!rows[0]) {
      return null;
    }

    const [items, history, transactions] = await Promise.all([
      this.findDetailsByOrderId(id),
      this.findHistoryByOrderId(id),
      this.findTransactionsByOrderId(id)
    ]);

    return new Order({
      ...rows[0],
      items: items.map((item) => item.toJSON()),
      history: history.map((item) => item.toJSON()),
      transactions: transactions.map((item) => item.toJSON())
    });
  }

  async create(payload, connection = null) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `INSERT INTO orders
        (order_code, customer_id, customer_name, customer_email, customer_phone, shipping_address, status, payment_status, payment_method, subtotal, discount_total, shipping_fee, tax_total, grand_total, paid_amount, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.orderCode,
        payload.customerId,
        payload.customerName,
        payload.customerEmail,
        payload.customerPhone,
        JSON.stringify(payload.shippingAddress || null),
        payload.status,
        payload.paymentStatus,
        payload.paymentMethod,
        payload.subtotal,
        payload.discountTotal,
        payload.shippingFee,
        payload.taxTotal,
        payload.grandTotal,
        payload.paidAmount,
        payload.note
      ],
      connection
    );

    logger.sql("Order create query executed.", {
      repository: "OrderRepository",
      operation: "create",
      durationMs: Date.now() - startedAt
    });

    return result.insertId;
  }

  async createDetails(orderId, items, connection = null) {
    const startedAt = Date.now();

    for (const item of items) {
      await this.execute(
        `INSERT INTO order_details
          (order_id, product_id, product_name, product_sku, product_image_url, quantity, unit_price, discount_amount, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.productName,
          item.productSku,
          item.productImageUrl,
          item.quantity,
          item.unitPrice,
          item.discountAmount,
          item.totalPrice
        ],
        connection
      );
    }

    logger.sql("Order details create queries executed.", {
      repository: "OrderRepository",
      operation: "createDetails",
      totalItems: items.length,
      durationMs: Date.now() - startedAt
    });
  }

  async addHistory(orderId, payload, connection = null) {
    const startedAt = Date.now();
    await this.execute(
      `INSERT INTO order_histories
        (order_id, status, note, changed_by)
      VALUES (?, ?, ?, ?)`,
      [orderId, payload.status, payload.note, payload.changedBy],
      connection
    );

    logger.sql("Order history create query executed.", {
      repository: "OrderRepository",
      operation: "addHistory",
      durationMs: Date.now() - startedAt
    });
  }

  async updateStatus(orderId, payload, connection = null) {
    const startedAt = Date.now();
    await this.execute(
      `UPDATE orders
      SET status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [payload.status, orderId],
      connection
    );

    logger.sql("Order status update query executed.", {
      repository: "OrderRepository",
      operation: "updateStatus",
      durationMs: Date.now() - startedAt
    });
  }


  async cancelOrder(orderId, { paymentStatus = "failed" } = {}, connection = null) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `UPDATE orders
      SET status = ?,
        payment_status = CASE WHEN payment_status IN ('paid', 'refunded') THEN payment_status ELSE ? END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL AND status <> 'cancelled'`,
      [ORDER_STATUS_CANCELLED, paymentStatus, orderId],
      connection
    );

    logger.sql("Order cancellation update query executed.", {
      repository: "OrderRepository",
      operation: "cancelOrder",
      durationMs: Date.now() - startedAt
    });

    return result.affectedRows > 0;
  }

  async cancelOpenPaymentTransactions(orderId, connection = null) {
    await this.execute(
      `UPDATE payment_transactions
      SET status = 'cancelled',
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND status IN ('pending', 'processing')`,
      [orderId],
      connection
    );
  }

  async restoreInventory(items, connection = null) {
    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) continue;
      if (item.variantId) {
        await this.execute(
          `UPDATE product_variants
          SET stock = stock + ?,
            sold = GREATEST(sold - ?, 0),
            status = CASE WHEN status = 'out_of_stock' THEN 'active' ELSE status END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL`,
          [quantity, quantity, item.variantId],
          connection
        );
      }
      if (item.productId) {
        await this.execute(
          `UPDATE products
          SET stock = stock + ?,
            sold = GREATEST(sold - ?, 0),
            status = CASE WHEN status = 'out_of_stock' THEN 'active' ELSE status END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL`,
          [quantity, quantity, item.productId],
          connection
        );
      }
    }
  }
  async createTransaction(orderId, payload, connection = null) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `INSERT INTO order_transactions
        (order_id, transaction_code, provider, method, amount, status, paid_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        payload.transactionCode,
        payload.provider,
        payload.method,
        payload.amount,
        payload.status,
        payload.paidAt,
        JSON.stringify(payload.metadata || null)
      ],
      connection
    );

    logger.sql("Order transaction create query executed.", {
      repository: "OrderRepository",
      operation: "createTransaction",
      durationMs: Date.now() - startedAt
    });

    return result.insertId;
  }

  async updatePaymentSummary(orderId, payload, connection = null) {
    const startedAt = Date.now();
    await this.execute(
      `UPDATE orders
      SET payment_status = ?,
        payment_method = ?,
        paid_amount = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [payload.paymentStatus, payload.paymentMethod, payload.paidAmount, orderId],
      connection
    );

    logger.sql("Order payment summary update query executed.", {
      repository: "OrderRepository",
      operation: "updatePaymentSummary",
      durationMs: Date.now() - startedAt
    });
  }

  async softDelete(orderId) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `UPDATE orders
      SET deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [orderId]
    );

    logger.sql("Order soft delete query executed.", {
      repository: "OrderRepository",
      operation: "softDelete",
      durationMs: Date.now() - startedAt
    });

    return result.affectedRows > 0;
  }

  async findDetailsByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT
        id,
        order_id,
        product_id,
        product_name,
        product_sku,
        product_image_url,
        variant_id,
        size,
        color,
        quantity,
        unit_price,
        discount_amount,
        total_price
      FROM order_details
      WHERE order_id = ?
      ORDER BY id ASC`,
      [orderId],
      connection
    );

    return rows.map((row) => new OrderDetail(row));
  }

  async findHistoryByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT id, order_id, status, note, changed_by, created_at
      FROM order_histories
      WHERE order_id = ?
      ORDER BY created_at ASC`,
      [orderId],
      connection
    );

    return rows.map((row) => new OrderHistory(row));
  }

  async findTransactionsByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT id, order_id, transaction_code, provider, method, amount, status, paid_at, metadata, created_at
      FROM (
        SELECT id, order_id, transaction_code, provider, method, amount, status, paid_at, metadata, created_at
        FROM payment_transactions
        WHERE order_id = ?
        UNION ALL
        SELECT id, order_id, transaction_code, provider, method, amount, status, paid_at, metadata, created_at
        FROM order_transactions
        WHERE order_id = ?
      ) AS transactions
      ORDER BY created_at DESC`,
      [orderId, orderId],
      connection
    );

    return rows.map((row) => new OrderTransaction(row));
  }

  buildWhereClause(options) {
    const conditions = ["deleted_at IS NULL"];
    const params = [];

    if (options.search.enabled) {
      conditions.push("(order_code LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)");
      params.push(
        `%${options.search.keyword}%`,
        `%${options.search.keyword}%`,
        `%${options.search.keyword}%`,
        `%${options.search.keyword}%`
      );
    }

    ["status", "paymentStatus", "paymentMethod", "customerId"].forEach((field) => {
      if (options.filter[field]) {
        const column = field === "paymentStatus"
          ? "payment_status"
          : field === "paymentMethod"
            ? "payment_method"
            : field === "customerId"
              ? "customer_id"
              : field;
        conditions.push(`${column} = ?`);
        params.push(options.filter[field]);
      }
    });

    if (options.filter.dateFrom) {
      conditions.push("created_at >= ?");
      params.push(options.filter.dateFrom);
    }

    if (options.filter.dateTo) {
      conditions.push("created_at <= ?");
      params.push(options.filter.dateTo);
    }

    return {
      whereSql: `WHERE ${conditions.join(" AND ")}`,
      params
    };
  }

  execute(sql, params = [], connection = null) {
    const safeParams = normalizeSqlParams(params);
    return connection
      ? connection.execute(sql, safeParams)
      : this.client.getPool().execute(sql, safeParams);
  }
}
