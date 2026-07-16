/**
 * Category repository.
 * It owns all MySQL access for category data and keeps SQL out of services/controllers.
 */
import { BaseRepository } from "./base.repository.js";
import { Category } from "../models/category.model.js";
import { logger } from "../utils/logger.util.js";

const SORT_COLUMNS = Object.freeze({
  name: "name",
  slug: "slug",
  status: "status",
  sortOrder: "sort_order",
  createdAt: "created_at",
  updatedAt: "updated_at"
});

export class CategoryRepository extends BaseRepository {
  async findAll(options, extra = {}) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";

    const [rows] = await this.client.getPool().execute(
      `SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.parent_id,
        c.image_url,
        c.status,
        c.sort_order,
        c.created_at,
        c.updated_at,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
      ${whereSql.replace("categories", "c")}
      GROUP BY c.id, c.name, c.slug, c.description, c.parent_id, c.image_url, c.status, c.sort_order, c.created_at, c.updated_at
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?`,
      [...params, options.pagination.limit, options.pagination.offset]
    );

    logger.sql("Category list query executed.", {
      repository: "CategoryRepository",
      operation: "findAll",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new Category(row));
  }

  async countAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.client.getPool().execute(
      `SELECT COUNT(*) AS total
      FROM categories c
      ${whereSql.replace("categories", "c")}`,
      params
    );

    logger.sql("Category count query executed.", {
      repository: "CategoryRepository",
      operation: "countAll",
      durationMs: Date.now() - startedAt
    });

    return Number(rows[0]?.total || 0);
  }

  async findById(id, options = {}) {
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.parent_id,
        c.image_url,
        c.status,
        c.sort_order,
        c.created_at,
        c.updated_at,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
      WHERE c.id = ? AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.slug, c.description, c.parent_id, c.image_url, c.status, c.sort_order, c.created_at, c.updated_at
      LIMIT 1`,
      [id]
    );

    logger.sql("Category lookup by id executed.", {
      repository: "CategoryRepository",
      operation: "findById",
      durationMs: Date.now() - startedAt
    });

    return rows[0] ? new Category(rows[0]) : null;
  }

  async findBySlug(slug, excludedId = null) {
    const startedAt = Date.now();
    const params = [slug];
    const excludedSql = excludedId ? "AND id <> ?" : "";

    if (excludedId) {
      params.push(excludedId);
    }

    const [rows] = await this.client.getPool().execute(
      `SELECT id, name, slug, status
      FROM categories
      WHERE slug = ? AND deleted_at IS NULL ${excludedSql}
      LIMIT 1`,
      params
    );

    logger.sql("Category lookup by slug executed.", {
      repository: "CategoryRepository",
      operation: "findBySlug",
      durationMs: Date.now() - startedAt
    });

    return rows[0] ? new Category(rows[0]) : null;
  }

  async create(payload) {
    const startedAt = Date.now();
    const [result] = await this.client.getPool().execute(
      `INSERT INTO categories
        (name, slug, description, parent_id, image_url, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.name,
        payload.slug,
        payload.description,
        payload.parentId,
        payload.imageUrl,
        payload.status,
        payload.sortOrder
      ]
    );

    logger.sql("Category create query executed.", {
      repository: "CategoryRepository",
      operation: "create",
      durationMs: Date.now() - startedAt
    });

    return this.findById(result.insertId);
  }

  async update(id, payload) {
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `UPDATE categories
      SET name = ?,
        slug = ?,
        description = ?,
        parent_id = ?,
        image_url = ?,
        status = ?,
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [
        payload.name,
        payload.slug,
        payload.description,
        payload.parentId,
        payload.imageUrl,
        payload.status,
        payload.sortOrder,
        id
      ]
    );

    logger.sql("Category update query executed.", {
      repository: "CategoryRepository",
      operation: "update",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }

  async updateStatus(id, status) {
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `UPDATE categories
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [status, id]
    );

    logger.sql("Category status update query executed.", {
      repository: "CategoryRepository",
      operation: "updateStatus",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }

  async countProductsByCategoryId(id) {
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND deleted_at IS NULL`,
      [id]
    );

    logger.sql("Category product count query executed.", {
      repository: "CategoryRepository",
      operation: "countProductsByCategoryId",
      durationMs: Date.now() - startedAt
    });

    return Number(rows[0]?.total || 0);
  }

  async softDelete(id) {
    const startedAt = Date.now();
    const [result] = await this.client.getPool().execute(
      `UPDATE categories
      SET deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    logger.sql("Category soft delete query executed.", {
      repository: "CategoryRepository",
      operation: "softDelete",
      durationMs: Date.now() - startedAt
    });

    return result.affectedRows > 0;
  }

  buildWhereClause(options) {
    const conditions = ["c.deleted_at IS NULL"];
    const params = [];

    if (options.search.enabled) {
      conditions.push("(c.name LIKE ? OR c.slug LIKE ?)");
      params.push(`%${options.search.keyword}%`, `%${options.search.keyword}%`);
    }

    if (options.filter.status) {
      conditions.push("c.status = ?");
      params.push(options.filter.status);
    }

    if (options.filter.parentId) {
      conditions.push("c.parent_id = ?");
      params.push(options.filter.parentId);
    }

    return {
      whereSql: `WHERE ${conditions.join(" AND ")}`,
      params
    };
  }
}
