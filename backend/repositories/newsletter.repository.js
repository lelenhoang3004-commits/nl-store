import { BaseRepository } from "./base.repository.js";
import { NewsletterSubscriber } from "../models/newsletter.model.js";
import { logger } from "../utils/logger.util.js";
import { normalizeSqlParams, sanitizePagination } from "../utils/sql-query.util.js";

const SORT_COLUMNS = Object.freeze({
  email: "email",
  fullName: "full_name",
  source: "source",
  status: "status",
  subscribedAt: "subscribed_at",
  unsubscribedAt: "unsubscribed_at",
  createdAt: "created_at"
});

const NEWSLETTER_COLUMNS = `
  id,
  email,
  full_name,
  source,
  status,
  subscribed_at,
  unsubscribed_at,
  created_at
`;

export class NewsletterRepository extends BaseRepository {
  async ensureSchema() {
    await this.execute(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(190) NOT NULL UNIQUE,
      full_name VARCHAR(120) NULL,
      source VARCHAR(60) NOT NULL DEFAULT 'website',
      status ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
      subscribed_at DATETIME NULL,
      unsubscribed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_newsletter_status (status),
      INDEX idx_newsletter_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }

  async findAll(options) {
    await this.ensureSchema();
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const pagination = sanitizePagination(options.pagination.limit, options.pagination.offset);
    const [rows] = await this.execute(
      `SELECT ${NEWSLETTER_COLUMNS}
      FROM newsletter_subscribers
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
      params
    );

    logger.sql("Newsletter subscriber list query executed.", { repository: "NewsletterRepository", operation: "findAll", durationMs: Date.now() - startedAt });
    return rows.map((row) => new NewsletterSubscriber(row));
  }

  async countAll(options) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.execute(`SELECT COUNT(*) AS total FROM newsletter_subscribers ${whereSql}`, params);
    return Number(rows[0]?.total || 0);
  }

  async findById(id) {
    await this.ensureSchema();
    const [rows] = await this.execute(`SELECT ${NEWSLETTER_COLUMNS} FROM newsletter_subscribers WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? new NewsletterSubscriber(rows[0]) : null;
  }

  async findByEmail(email) {
    await this.ensureSchema();
    const [rows] = await this.execute(`SELECT ${NEWSLETTER_COLUMNS} FROM newsletter_subscribers WHERE email = ? LIMIT 1`, [email]);
    return rows[0] ? new NewsletterSubscriber(rows[0]) : null;
  }

  async findByUnsubscribeToken() {
    return null;
  }

  async create(payload) {
    await this.ensureSchema();
    const source = payload.source || "website";
    const [result] = await this.execute(
      `INSERT INTO newsletter_subscribers (email, full_name, source, status, subscribed_at)
      VALUES (?, ?, ?, 'subscribed', NOW())`,
      [payload.email, payload.fullName, source]
    );
    return this.findById(result.insertId);
  }

  async resubscribe(id, payload) {
    await this.ensureSchema();
    const source = payload.source || "website";
    await this.execute(
      `UPDATE newsletter_subscribers
      SET full_name = ?, source = ?, status = 'subscribed', subscribed_at = NOW(), unsubscribed_at = NULL
      WHERE id = ?`,
      [payload.fullName, source, id]
    );
    return this.findById(id);
  }

  async updateStatus(id, status) {
    await this.ensureSchema();
    await this.execute(
      `UPDATE newsletter_subscribers
      SET status = ?,
        subscribed_at = CASE WHEN ? = 'subscribed' THEN NOW() ELSE subscribed_at END,
        unsubscribed_at = CASE WHEN ? = 'unsubscribed' THEN NOW() ELSE NULL END
      WHERE id = ?`,
      [status, status, status, id]
    );
    return this.findById(id);
  }

  async unsubscribe(id) {
    return this.updateStatus(id, "unsubscribed");
  }

  async delete(id) {
    await this.ensureSchema();
    const [result] = await this.execute(`DELETE FROM newsletter_subscribers WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  }

  buildWhereClause(options) {
    const conditions = ["1 = 1"];
    const params = [];
    if (options.search.enabled) {
      conditions.push("(email LIKE ? OR full_name LIKE ?)");
      params.push(`%${options.search.keyword}%`, `%${options.search.keyword}%`);
    }
    if (options.filter.status) {
      conditions.push("status = ?");
      params.push(options.filter.status);
    }
    return { whereSql: `WHERE ${conditions.join(" AND ")}`, params };
  }
}
