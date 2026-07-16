import { BaseRepository } from "./base.repository.js";
import { Voucher } from "../models/voucher.model.js";
import { logger } from "../utils/logger.util.js";

const SORT_COLUMNS = Object.freeze({
  code: "code",
  name: "name",
  discountType: "discount_type",
  quantity: "quantity",
  usedQuantity: "used_quantity",
  startsAt: "starts_at",
  expiresAt: "expires_at",
  status: "status",
  createdAt: "created_at"
});

const VOUCHER_COLUMNS = `
  id,
  code,
  name,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  max_discount_amount,
  quantity,
  used_quantity,
  starts_at,
  expires_at,
  status,
  conditions,
  created_at
`;

export class VoucherRepository extends BaseRepository {
  async findAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const [rows] = await this.client.getPool().execute(
      `SELECT ${VOUCHER_COLUMNS}
      FROM vouchers
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?`,
      [...params, options.pagination.limit, options.pagination.offset]
    );

    logger.sql("Voucher list query executed.", { repository: "VoucherRepository", operation: "findAll", durationMs: Date.now() - startedAt });
    return rows.map((row) => new Voucher(row));
  }

  async countAll(options) {
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.client.getPool().execute(`SELECT COUNT(*) AS total FROM vouchers ${whereSql}`, params);
    return Number(rows[0]?.total || 0);
  }

  async findById(id, connection = null) {
    const executor = connection || this.client.getPool();
    const [rows] = await executor.execute(`SELECT ${VOUCHER_COLUMNS} FROM vouchers WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? new Voucher(rows[0]) : null;
  }

  async findByCode(code, excludedId = null, connection = null, forUpdate = false) {
    const executor = connection || this.client.getPool();
    const params = [String(code || "").trim().toUpperCase()];
    const excludedSql = excludedId ? "AND id <> ?" : "";
    if (excludedId) params.push(excludedId);
    const [rows] = await executor.execute(
      `SELECT ${VOUCHER_COLUMNS} FROM vouchers WHERE code = ? ${excludedSql} LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
      params
    );
    return rows[0] ? new Voucher(rows[0]) : null;
  }

  async create(payload) {
    const [result] = await this.client.getPool().execute(
      `INSERT INTO vouchers
        (code, name, description, discount_type, discount_value, min_order_amount, max_discount_amount, quantity, used_quantity, starts_at, expires_at, status, conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.toSqlParams(payload)
    );
    return this.findById(result.insertId);
  }

  async update(id, payload) {
    await this.client.getPool().execute(
      `UPDATE vouchers
      SET code = ?, name = ?, description = ?, discount_type = ?, discount_value = ?, min_order_amount = ?, max_discount_amount = ?, quantity = ?, used_quantity = ?, starts_at = ?, expires_at = ?, status = ?, conditions = ?
      WHERE id = ?`,
      [...this.toSqlParams(payload), id]
    );
    return this.findById(id);
  }

  async updateStatus(id, status) {
    await this.client.getPool().execute(`UPDATE vouchers SET status = ? WHERE id = ?`, [status, id]);
    return this.findById(id);
  }

  async incrementUsedCount(id, connection = null) {
    const executor = connection || this.client.getPool();
    await executor.execute(`UPDATE vouchers SET used_quantity = used_quantity + 1 WHERE id = ?`, [id]);
  }

  async softDelete(id) {
    const [result] = await this.client.getPool().execute(`DELETE FROM vouchers WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  }

  buildWhereClause(options) {
    const conditions = ["1 = 1"];
    const params = [];
    if (options.search.enabled) {
      conditions.push("(code LIKE ? OR name LIKE ?)");
      params.push(`%${options.search.keyword}%`, `%${options.search.keyword}%`);
    }
    if (options.filter.status) {
      conditions.push("status = ?");
      params.push(options.filter.status);
    }
    return { whereSql: `WHERE ${conditions.join(" AND ")}`, params };
  }

  toSqlParams(payload) {
    return [
      payload.code,
      payload.name,
      payload.description,
      payload.discountType,
      payload.discountValue,
      payload.minOrderAmount,
      payload.maxDiscountAmount,
      payload.quantity,
      payload.usedQuantity,
      payload.startsAt,
      payload.expiresAt,
      payload.status,
      payload.conditions
    ];
  }
}
