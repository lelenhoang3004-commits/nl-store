import { BaseRepository } from "./base.repository.js";
import { normalizeSqlParams, sanitizePagination } from "../utils/sql-query.util.js";

const NOTIFICATION_COLUMNS = `
  n.id,
  n.user_id,
  n.role,
  n.target_type,
  n.audience,
  n.type,
  n.title,
  n.message,
  n.link,
  n.dedupe_key,
  CASE WHEN nr.user_id IS NULL THEN 0 ELSE 1 END AS is_read,
  n.created_at
`;

let schemaReadyPromise = null;

export class NotificationRepository extends BaseRepository {
  async ensureSchema() {
    if (!schemaReadyPromise) {
      schemaReadyPromise = this.createSchema();
    }

    return schemaReadyPromise;
  }

  async createSchema() {
    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NULL,
        role VARCHAR(40) NULL,
        target_type ENUM('user', 'role', 'all') NOT NULL DEFAULT 'user',
        audience ENUM('ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
        type VARCHAR(60) NOT NULL DEFAULT 'system',
        title VARCHAR(180) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        dedupe_key VARCHAR(160) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_notifications_dedupe (dedupe_key),
        INDEX idx_notifications_user_read (user_id, is_read, created_at),
        INDEX idx_notifications_role_read (role, target_type, is_read, created_at),
        INDEX idx_notifications_audience_created (audience, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await this.ensureColumn("audience", "ENUM('ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER' AFTER target_type");
    await this.ensureColumn("dedupe_key", "VARCHAR(160) NULL AFTER link");
    await this.ensureIndex("idx_notifications_audience_created", "CREATE INDEX idx_notifications_audience_created ON notifications (audience, created_at)");
    await this.ensureUniqueIndex("uq_notifications_dedupe", "CREATE UNIQUE INDEX uq_notifications_dedupe ON notifications (dedupe_key)");
    await this.client.getPool().execute(`
      UPDATE notifications
      SET audience = CASE
        WHEN target_type IN ('role', 'all') OR UPPER(COALESCE(role, '')) IN ('ADMIN', 'STAFF') THEN 'ADMIN'
        ELSE 'CUSTOMER'
      END
    `);
    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        notification_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (notification_id, user_id),
        INDEX idx_notification_reads_user (user_id, read_at),
        CONSTRAINT fk_notification_reads_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
        CONSTRAINT fk_notification_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await this.client.getPool().execute(`
      INSERT IGNORE INTO notification_reads (notification_id, user_id, read_at)
      SELECT id, user_id, created_at
      FROM notifications
      WHERE is_read = 1 AND user_id IS NOT NULL
    `);
  }

  async findForPrincipal(principal, options = {}) {
    await this.ensureSchema();
    const pagination = sanitizePagination(options.limit || 20, options.offset || 0);
    const status = normalizeStatus(options.status);
    const { whereSql, params } = this.buildPrincipalWhere(principal, status);
    const [rows] = await this.execute(
      `SELECT ${NOTIFICATION_COLUMNS}
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
      ${whereSql}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
      [principal?.id, ...params]
    );
    return rows.map(mapNotification);
  }

  async countUnreadForPrincipal(principal) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildPrincipalWhere(principal, "unread");
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
      ${whereSql}`,
      [principal?.id, ...params]
    );
    return Number(rows[0]?.total || 0);
  }

  async markRead(id, principal) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildPrincipalWhere(principal);
    const [rows] = await this.execute(`SELECT n.id FROM notifications n ${whereSql} AND n.id = ? LIMIT 1`, [...params, id]);
    if (!rows.length) return false;
    await this.execute(
      `INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
      [id, principal?.id]
    );
    return true;
  }

  async markAllRead(principal) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildPrincipalWhere(principal, "unread");
    const [result] = await this.execute(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id)
      SELECT n.id, ?
      FROM notifications n
      LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
      ${whereSql}`,
      [principal?.id, principal?.id, ...params]
    );
    return result.affectedRows;
  }

  async create(payload, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [result] = await executor.execute(
      `INSERT INTO notifications (user_id, role, target_type, audience, type, title, message, link, dedupe_key, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ${payload.dedupeKey ? "ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)" : ""}`,
      normalizeSqlParams([
        payload.userId || null,
        payload.role || null,
        payload.targetType || (payload.userId ? "user" : "role"),
        normalizeAudience(payload.audience || (payload.userId ? "CUSTOMER" : "ADMIN")),
        payload.type || "system",
        payload.title,
        payload.message,
        payload.link || null,
        payload.dedupeKey || null
      ])
    );
    return result.insertId;
  }

  async ensureColumn(columnName, definition) {
    const [rows] = await this.client.getPool().execute(`SHOW COLUMNS FROM notifications LIKE '${columnName}'`);
    if (!rows.length) await this.client.getPool().execute(`ALTER TABLE notifications ADD COLUMN ${columnName} ${definition}`);
  }

  async ensureIndex(indexName, createSql) {
    const [rows] = await this.client.getPool().execute(`SHOW INDEX FROM notifications WHERE Key_name = ?`, [indexName]);
    if (!rows.length) await this.client.getPool().execute(createSql);
  }

  async ensureUniqueIndex(indexName, createSql) {
    await this.ensureIndex(indexName, createSql);
  }

  buildPrincipalWhere(principal, status = "") {
    const role = String(principal?.role || "").toUpperCase();
    const userId = principal?.id;
    const audience = role === "ADMIN" || role === "STAFF" ? "ADMIN" : "CUSTOMER";
    const conditions = [
      "n.audience = ?",
      "((n.target_type = 'user' AND n.user_id = ?) OR (n.target_type = 'role' AND UPPER(n.role) IN (?, 'ADMIN')) OR n.target_type = 'all')"
    ];
    const params = [audience, userId, role];
    if (status === "unread") conditions.push("nr.user_id IS NULL");
    if (status === "read") conditions.push("nr.user_id IS NOT NULL");
    return { whereSql: `WHERE ${conditions.join(" AND ")}`, params };
  }

  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }
}

function mapNotification(row = {}) {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    targetType: row.target_type,
    audience: row.audience,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    dedupeKey: row.dedupe_key,
    isRead: Boolean(row.is_read),
    read: Boolean(row.is_read),
    createdAt: row.created_at
  };
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["read", "unread"].includes(status) ? status : "";
}

function normalizeAudience(value) {
  return String(value || "").trim().toUpperCase() === "ADMIN" ? "ADMIN" : "CUSTOMER";
}
