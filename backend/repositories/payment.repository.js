/**
 * Payment repository.
 * It owns MySQL access for payment methods, transactions, histories, and order payment summary updates.
 */
import { BaseRepository } from "./base.repository.js";
import { PaymentHistory, PaymentMethod, PaymentTransaction } from "../models/payment.model.js";
import { logger } from "../utils/logger.util.js";

const METHOD_SORT_COLUMNS = Object.freeze({
  name: "name",
  code: "code",
  provider: "provider",
  type: "type",
  createdAt: "created_at",
  updatedAt: "updated_at"
});

const TRANSACTION_SORT_COLUMNS = Object.freeze({
  createdAt: "pt.created_at",
  updatedAt: "pt.updated_at",
  amount: "pt.amount",
  status: "pt.status",
  paidAt: "pt.paid_at"
});

export class PaymentRepository extends BaseRepository {
  async findMethods(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildMethodWhereClause(options);
    const sortColumn = METHOD_SORT_COLUMNS[options.sort.field] || METHOD_SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const [rows] = await this.execute(
      `SELECT id, code, name, provider, type, description, is_active, config, created_at, updated_at
      FROM payment_methods
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?`,
      [...params, options.pagination.limit, options.pagination.offset]
    );

    logger.sql("Payment method list query executed.", {
      repository: "PaymentRepository",
      operation: "findMethods",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new PaymentMethod(row));
  }

  async countMethods(options) {
    const { whereSql, params } = this.buildMethodWhereClause(options);
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM payment_methods
      ${whereSql}`,
      params
    );

    return Number(rows[0]?.total || 0);
  }

  async findMethodById(id) {
    const [rows] = await this.execute(
      `SELECT id, code, name, provider, type, description, is_active, config, created_at, updated_at
      FROM payment_methods
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1`,
      [id]
    );

    return rows[0] ? new PaymentMethod(rows[0]) : null;
  }

  async findMethodByCode(code, excludedId = null) {
    const params = [code];
    const excludedSql = excludedId ? "AND id <> ?" : "";

    if (excludedId) {
      params.push(excludedId);
    }

    const [rows] = await this.execute(
      `SELECT id, code, name, provider, type, description, is_active, config, created_at, updated_at
      FROM payment_methods
      WHERE code = ? AND deleted_at IS NULL ${excludedSql}
      LIMIT 1`,
      params
    );

    return rows[0] ? new PaymentMethod(rows[0]) : null;
  }

  async createMethod(payload) {
    const [result] = await this.execute(
      `INSERT INTO payment_methods
        (code, name, provider, type, description, is_active, config)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.code,
        payload.name,
        payload.provider,
        payload.type,
        payload.description,
        payload.isActive,
        JSON.stringify(payload.config || null)
      ]
    );

    return this.findMethodById(result.insertId);
  }

  async updateMethod(id, payload) {
    await this.execute(
      `UPDATE payment_methods
      SET code = ?,
        name = ?,
        provider = ?,
        type = ?,
        description = ?,
        is_active = ?,
        config = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.code,
        payload.name,
        payload.provider,
        payload.type,
        payload.description,
        payload.isActive,
        JSON.stringify(payload.config || null),
        id
      ]
    );

    return this.findMethodById(id);
  }

  async softDeleteMethod(id) {
    const [result] = await this.execute(
      `UPDATE payment_methods
      SET deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    return result.affectedRows > 0;
  }

  async findTransactions(options) {
    const { whereSql, params } = this.buildTransactionWhereClause(options);
    const sortColumn = TRANSACTION_SORT_COLUMNS[options.sort.field] || TRANSACTION_SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const [rows] = await this.execute(
      `SELECT
        pt.id,
        pt.order_id,
        o.order_code,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        pt.payment_method_id,
        pt.transaction_code,
        pt.provider,
        pt.method,
        pt.amount,
        pt.currency,
        pt.status,
        pt.paid_at,
        pt.metadata,
        pt.created_at,
        pt.updated_at
      FROM payment_transactions pt
      LEFT JOIN orders o ON o.id = pt.order_id AND o.deleted_at IS NULL
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?`,
      [...params, options.pagination.limit, options.pagination.offset]
    );

    return rows.map((row) => new PaymentTransaction(row));
  }

  async countTransactions(options) {
    const { whereSql, params } = this.buildTransactionWhereClause(options);
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM payment_transactions pt
      LEFT JOIN orders o ON o.id = pt.order_id AND o.deleted_at IS NULL
      ${whereSql}`,
      params
    );

    return Number(rows[0]?.total || 0);
  }

  async findTransactionById(id, connection = null) {
    const [rows] = await this.execute(
      `SELECT
        pt.id,
        pt.order_id,
        o.order_code,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        pt.payment_method_id,
        pt.transaction_code,
        pt.provider,
        pt.method,
        pt.amount,
        pt.currency,
        pt.status,
        pt.paid_at,
        pt.metadata,
        pt.created_at,
        pt.updated_at
      FROM payment_transactions pt
      LEFT JOIN orders o ON o.id = pt.order_id AND o.deleted_at IS NULL
      WHERE pt.id = ?
      LIMIT 1`,
      [id],
      connection
    );

    return rows[0] ? new PaymentTransaction(rows[0]) : null;
  }

  async findAll(options) {
    return this.findTransactions(options);
  }

  async findById(id, connection = null) {
    return this.findTransactionById(id, connection);
  }

  async findByOrderId(orderId, connection = null) {
    const [rows] = await this.execute(
      `SELECT
        pt.id,
        pt.order_id,
        o.order_code,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        pt.payment_method_id,
        pt.transaction_code,
        pt.provider,
        pt.method,
        pt.amount,
        pt.currency,
        pt.status,
        pt.paid_at,
        pt.metadata,
        pt.created_at,
        pt.updated_at
      FROM payment_transactions pt
      INNER JOIN orders o ON o.id = pt.order_id AND o.deleted_at IS NULL
      WHERE pt.order_id = ?
      ORDER BY pt.created_at DESC, pt.id DESC
      LIMIT 1`,
      [orderId],
      connection
    );

    return rows[0] ? new PaymentTransaction(rows[0]) : null;
  }

  async createTransaction(payload, connection = null) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `INSERT INTO payment_transactions
        (order_id, payment_method_id, transaction_code, provider, method, amount, currency, status, paid_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.orderId,
        payload.paymentMethodId,
        payload.transactionCode,
        payload.provider,
        payload.method,
        payload.amount,
        payload.currency,
        payload.status,
        payload.paidAt,
        JSON.stringify(payload.metadata || null)
      ],
      connection
    );

    logger.sql("Payment transaction create query executed.", {
      repository: "PaymentRepository",
      operation: "createTransaction",
      durationMs: Date.now() - startedAt
    });

    return result.insertId;
  }

  async updateTransactionStatus(id, payload, connection = null) {
    const startedAt = Date.now();
    await this.execute(
      `UPDATE payment_transactions
      SET status = ?,
        paid_at = ?,
        metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [payload.status, payload.paidAt, JSON.stringify(payload.metadata || null), id],
      connection
    );

    logger.sql("Payment transaction status update query executed.", {
      repository: "PaymentRepository",
      operation: "updateStatus",
      durationMs: Date.now() - startedAt
    });

    return this.findTransactionById(id, connection);
  }

  async updateStatus(id, payload, connection = null) {
    return this.updateTransactionStatus(id, payload, connection);
  }

  async addHistory(transactionId, payload, connection = null) {
    const startedAt = Date.now();
    await this.execute(
      `INSERT INTO payment_histories
        (transaction_id, status, note, changed_by)
      VALUES (?, ?, ?, ?)`,
      [transactionId, payload.status, payload.note, payload.changedBy],
      connection
    );

    logger.sql("Payment history create query executed.", {
      repository: "PaymentRepository",
      operation: "createHistory",
      durationMs: Date.now() - startedAt
    });
  }

  async createHistory(payload, connection = null) {
    return this.addHistory(payload.transactionId, payload, connection);
  }

  async findHistoriesByTransactionId(transactionId) {
    const [rows] = await this.execute(
      `SELECT id, transaction_id, status, note, changed_by, created_at
      FROM payment_histories
      WHERE transaction_id = ?
      ORDER BY created_at ASC`,
      [transactionId]
    );

    return rows.map((row) => new PaymentHistory(row));
  }

  async findOrderPaymentSummary(orderId, connection = null, lockForUpdate = false) {
    const [rows] = await this.execute(
      `SELECT grand_total, paid_amount
      FROM orders
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1${lockForUpdate ? " FOR UPDATE" : ""}`,
      [orderId],
      connection
    );

    return rows[0] || null;
  }

  async findOrderForPayment(orderId, connection = null, lockForUpdate = false) {
    const [rows] = await this.execute(
      `SELECT id, order_code, payment_status, payment_method, grand_total, paid_amount, deleted_at
      FROM orders
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1${lockForUpdate ? " FOR UPDATE" : ""}`,
      [orderId],
      connection
    );

    return rows[0] || null;
  }

  async updateOrderPaymentSummary(orderId, payload, connection = null) {
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
      repository: "PaymentRepository",
      operation: "updateOrderPaymentStatus",
      durationMs: Date.now() - startedAt
    });
  }

  async updateOrderPaymentStatus(orderId, payload, connection = null) {
    return this.updateOrderPaymentSummary(orderId, payload, connection);
  }

  async findPaymentMethodByCode(code, connection = null) {
    const normalizedCode = String(code || "").trim().toLowerCase();
    const aliases = normalizedCode === "bank_transfer" ? [normalizedCode, "bank"] : [normalizedCode];
    const placeholders = aliases.map(() => "?").join(", ");
    const [rows] = await this.execute(
      `SELECT id, code, name, provider, type, description, is_active, config, created_at, updated_at
      FROM payment_methods
      WHERE deleted_at IS NULL
        AND is_active = 1
        AND (LOWER(code) IN (${placeholders}) OR LOWER(type) IN (${placeholders}))
      ORDER BY id ASC
      LIMIT 1`,
      [...aliases, ...aliases],
      connection
    );

    return rows[0] ? new PaymentMethod(rows[0]) : null;
  }

  buildMethodWhereClause(options) {
    const conditions = ["deleted_at IS NULL"];
    const params = [];

    if (options.search.enabled) {
      conditions.push("(code LIKE ? OR name LIKE ? OR provider LIKE ?)");
      params.push(`%${options.search.keyword}%`, `%${options.search.keyword}%`, `%${options.search.keyword}%`);
    }

    ["provider", "type"].forEach((field) => {
      if (options.filter[field]) {
        conditions.push(`${field} = ?`);
        params.push(options.filter[field]);
      }
    });

    if (options.filter.isActive !== undefined) {
      conditions.push("is_active = ?");
      params.push(options.filter.isActive === "true" || options.filter.isActive === true ? 1 : 0);
    }

    return {
      whereSql: `WHERE ${conditions.join(" AND ")}`,
      params
    };
  }

  buildTransactionWhereClause(options) {
    const conditions = ["1 = 1"];
    const params = [];

    if (options.search.enabled) {
      conditions.push(`(
        pt.transaction_code LIKE ?
        OR o.order_code LIKE ?
        OR o.customer_name LIKE ?
        OR o.customer_phone LIKE ?
        OR pt.provider LIKE ?
        OR pt.method LIKE ?
      )`);
      const keyword = `%${options.search.keyword}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    ["orderId", "paymentMethodId", "provider", "method", "status"].forEach((field) => {
      if (options.filter[field]) {
        const column = field === "orderId"
          ? "pt.order_id"
          : field === "paymentMethodId"
            ? "pt.payment_method_id"
            : `pt.${field}`;
        conditions.push(`${column} = ?`);
        params.push(options.filter[field]);
      }
    });

    return {
      whereSql: `WHERE ${conditions.join(" AND ")}`,
      params
    };
  }

  execute(sql, params = [], connection = null) {
    return connection
      ? connection.execute(sql, params)
      : this.client.getPool().execute(sql, params);
  }
}
