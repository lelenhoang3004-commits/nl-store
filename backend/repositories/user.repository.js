/**
 * User repository.
 * It owns all MySQL access for user CRUD, profile, avatar, and address data.
 */
import { BaseRepository } from "./base.repository.js";
import { User } from "../models/user.model.js";
import { logger } from "../utils/logger.util.js";
import { normalizeSqlParams, sanitizePagination } from "../utils/sql-query.util.js";

const SORT_COLUMNS = Object.freeze({
  fullName: "full_name",
  email: "email",
  role: "role",
  status: "status",
  createdAt: "created_at",
  updatedAt: "updated_at",
  lastLoginAt: "last_login_at"
});

const USER_COLUMNS = `
  id,
  email,
  full_name,
  phone,
  avatar_url,
  role,
  permissions,
  status,
  address_json,
  last_login_at,
  created_at,
  updated_at
`;

export class UserRepository extends BaseRepository {
  async findAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const pagination = sanitizePagination(options.pagination.limit, options.pagination.offset);

    const [rows] = await this.execute(
      `SELECT ${USER_COLUMNS}
      FROM users
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ${pagination.limit} OFFSET ${pagination.offset}`,
      params
    );

    logger.sql("User list query executed.", {
      repository: "UserRepository",
      operation: "findAll",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new User(row));
  }

  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }

  async countAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.execute(
      `SELECT COUNT(*) AS total
      FROM users
      ${whereSql}`,
      params
    );

    logger.sql("User count query executed.", {
      repository: "UserRepository",
      operation: "countAll",
      durationMs: Date.now() - startedAt
    });

    return Number(rows[0]?.total || 0);
  }

  async findById(id) {
    const startedAt = Date.now();
    const [rows] = await this.execute(
      `SELECT ${USER_COLUMNS}
      FROM users
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1`,
      [id]
    );

    logger.sql("User lookup by id executed.", {
      repository: "UserRepository",
      operation: "findById",
      durationMs: Date.now() - startedAt
    });

    return rows[0] ? new User(rows[0]) : null;
  }

  async findByEmail(email, excludedId = null) {
    const startedAt = Date.now();
    const params = [email];
    const excludedSql = excludedId ? "AND id <> ?" : "";

    if (excludedId) {
      params.push(excludedId);
    }

    const [rows] = await this.execute(
      `SELECT ${USER_COLUMNS}
      FROM users
      WHERE email = ? AND deleted_at IS NULL ${excludedSql}
      LIMIT 1`,
      params
    );

    logger.sql("User lookup by email executed.", {
      repository: "UserRepository",
      operation: "findByEmail",
      durationMs: Date.now() - startedAt
    });

    return rows[0] ? new User(rows[0]) : null;
  }

  async create(payload) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `INSERT INTO users
        (email, full_name, phone, avatar_url, password_hash, role, permissions, status, address_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.email,
        payload.fullName,
        payload.phone,
        payload.avatarUrl,
        payload.passwordHash,
        payload.role,
        JSON.stringify(payload.permissions || []),
        payload.status,
        JSON.stringify(payload.address || null)
      ]
    );

    logger.sql("User create query executed.", {
      repository: "UserRepository",
      operation: "create",
      durationMs: Date.now() - startedAt
    });

    return this.findById(result.insertId);
  }

  async update(id, payload) {
    const startedAt = Date.now();
    const fields = [
      "email = ?",
      "full_name = ?",
      "phone = ?",
      "avatar_url = ?",
      "role = ?",
      "permissions = ?",
      "status = ?",
      "address_json = ?",
      "updated_at = CURRENT_TIMESTAMP"
    ];
    const params = [
      payload.email,
      payload.fullName,
      payload.phone,
      payload.avatarUrl,
      payload.role,
      JSON.stringify(payload.permissions || []),
      payload.status,
      JSON.stringify(payload.address || null)
    ];

    if (payload.passwordHash) {
      fields.splice(4, 0, "password_hash = ?");
      params.splice(4, 0, payload.passwordHash);
    }

    await this.execute(
      `UPDATE users
      SET ${fields.join(", ")}
      WHERE id = ? AND deleted_at IS NULL`,
      [...params, id]
    );

    logger.sql("User update query executed.", {
      repository: "UserRepository",
      operation: "update",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }


  async patchFields(id, fields) {
    const startedAt = Date.now();
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);

    if (!entries.length) {
      return this.findById(id);
    }

    const columnMap = {
      email: "email",
      fullName: "full_name",
      phone: "phone",
      role: "role",
      status: "status",
      permissions: "permissions"
    };
    const assignments = entries.map(([key]) => `${columnMap[key]} = ?`);
    const params = entries.map(([key, value]) => key === "permissions" ? JSON.stringify(value || []) : value);

    await this.execute(
      `UPDATE users
      SET ${assignments.join(", ")},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [...params, id]
    );

    logger.sql("User patch query executed.", {
      repository: "UserRepository",
      operation: "patchFields",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }

  async updateProfile(id, payload) {
    const startedAt = Date.now();
    await this.execute(
      `UPDATE users
      SET full_name = ?,
        phone = ?,
        avatar_url = ?,
        address_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.fullName,
        payload.phone,
        payload.avatarUrl,
        JSON.stringify(payload.address || null),
        id
      ]
    );

    logger.sql("User profile update query executed.", {
      repository: "UserRepository",
      operation: "updateProfile",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }

  async updateAvatar(id, avatarUrl) {
    const startedAt = Date.now();
    await this.execute(
      `UPDATE users
      SET avatar_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [avatarUrl, id]
    );

    logger.sql("User avatar update query executed.", {
      repository: "UserRepository",
      operation: "updateAvatar",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }

  async softDelete(id) {
    const startedAt = Date.now();
    const [result] = await this.execute(
      `UPDATE users
      SET deleted_at = CURRENT_TIMESTAMP,
        refresh_token_hash = NULL,
        refresh_token_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    logger.sql("User soft delete query executed.", {
      repository: "UserRepository",
      operation: "softDelete",
      durationMs: Date.now() - startedAt
    });

    return result.affectedRows > 0;
  }

  buildWhereClause(options) {
    const conditions = ["deleted_at IS NULL"];
    const params = [];

    if (options.search.enabled) {
      conditions.push("(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      params.push(`%${options.search.keyword}%`, `%${options.search.keyword}%`, `%${options.search.keyword}%`);
    }

    if (options.filter.role) {
      conditions.push("role = ?");
      params.push(options.filter.role);
    }

    if (options.filter.status) {
      conditions.push("status = ?");
      params.push(options.filter.status);
    }

    return {
      whereSql: `WHERE ${conditions.join(" AND ")}`,
      params
    };
  }
}
