import { BaseRepository } from "./base.repository.js";
import { normalizeSqlParams, sanitizePagination } from "../utils/sql-query.util.js";

const NOTIFICATION_COLUMNS = `
  id,
  user_id,
  role,
  target_type,
  type,
  title,
  message,
  link,
  is_read,
  created_at
`;

export class NotificationRepository extends BaseRepository {
  async ensureSchema() {
    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NULL,
        role VARCHAR(40) NULL,
        target_type ENUM('user', 'role', 'all') NOT NULL DEFAULT 'user',
        type VARCHAR(60) NOT NULL DEFAULT 'system',
        title VARCHAR(180) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user_read (user_id, is_read, created_at),
        INDEX idx_notifications_role_read (role, target_type, is_read, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async findForPrincipal(principal, options = {}) {
    await this.ensureSchema();
    const pagination = sanitizePagination(options.limit || 20, options.offset || 0);
    const { whereSql, params } = this.buildPrincipalWhere(principal);
    const [rows] = await this.execute(
      `SELECT ${NOTIFICATION_COLUMNS}
      FROM notifications
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
      params
    );
    return rows.map(mapNotification);
  }

  async countUnreadForPrincipal(principal) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildPrincipalWhere(principal, "is_read = 0");
    const [rows] = await this.execute(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`, params);
    return Number(rows[0]?.total || 0);
  }

  async markRead(id, principal) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildPrincipalWhere(principal, "id = ?");
    const [result] = await this.execute(`UPDATE notifications SET is_read = 1 ${whereSql}`, [id, ...params]);
    return result.affectedRows > 0;
  }

  async markAllRead(principal) {
    await this.ensureSchema();
    const { whereSql, params } = this.buildPrincipalWhere(principal, "is_read = 0");
    const [result] = await this.execute(`UPDATE notifications SET is_read = 1 ${whereSql}`, params);
    return result.affectedRows;
  }

  async create(payload, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [result] = await executor.execute(
      `INSERT INTO notifications (user_id, role, target_type, type, title, message, link, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      normalizeSqlParams([
        payload.userId || null,
        payload.role || null,
        payload.targetType || (payload.userId ? "user" : "role"),
        payload.type || "system",
        payload.title,
        payload.message,
        payload.link || null
      ])
    );
    return result.insertId;
  }

  buildPrincipalWhere(principal, extraCondition = "") {
    const role = String(principal?.role || "").toUpperCase();
    const userId = principal?.id;
    const conditions = [
      "((target_type = 'user' AND user_id = ?) OR (target_type = 'role' AND role = ?) OR target_type = 'all')"
    ];
    const params = [userId, role];
    if (extraCondition) conditions.push(extraCondition);
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
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    isRead: Boolean(row.is_read),
    read: Boolean(row.is_read),
    createdAt: row.created_at
  };
}
