/**
 * Category repository.
 * It owns all MySQL access for category data and keeps SQL out of services/controllers.
 */
import { BaseRepository } from "./base.repository.js";
import { Category } from "../models/category.model.js";
import { logger } from "../utils/logger.util.js";

const SORT_COLUMNS = Object.freeze({
  name: "c.name",
  slug: "c.slug",
  status: "c.status",
  sortOrder: "c.sort_order",
  createdAt: "c.created_at",
  updatedAt: "c.updated_at"
});

const normalizePagination = (pagination = {}) => {
  const parsedLimit = Number.parseInt(pagination?.limit, 10);
  const parsedOffset = Number.parseInt(pagination?.offset, 10);

  return {
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20,
    offset: Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
  };
};

const normalizeSqlParams = (params = []) => params.map((value) => value === undefined ? null : value);

export class CategoryRepository extends BaseRepository {
  async findAll(options, extra = {}) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const { limit, offset } = normalizePagination(options.pagination);

    const [rows] = await this.execute(
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
      LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    logger.sql("Category list query executed.", {
      repository: "CategoryRepository",
      operation: "findAll",
      durationMs: Date.now() - startedAt
    });

    return (await this.withTreeProductCounts(rows)).map((row) => new Category(row));
  }

  async countAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.execute(
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

  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }

  async findById(id, options = {}) {
    const startedAt = Date.now();
    const [rows] = await this.execute(
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

    const countedRows = await this.withTreeProductCounts(rows);
    return countedRows[0] ? new Category(countedRows[0]) : null;
  }

  async findBySlug(slug, excludedId = null) {
    const startedAt = Date.now();
    const params = [slug];
    const excludedSql = excludedId ? "AND id <> ?" : "";

    if (excludedId) {
      params.push(excludedId);
    }

    const [rows] = await this.execute(
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
    const [result] = await this.execute(
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
    await this.execute(
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
    await this.execute(
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
    const [rows] = await this.execute(
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

  async findDescendantIds(id) {
    const [rows] = await this.execute(
      `WITH RECURSIVE category_tree AS (
        SELECT id
        FROM categories
        WHERE parent_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT child.id
        FROM categories child
        INNER JOIN category_tree tree ON child.parent_id = tree.id
        WHERE child.deleted_at IS NULL
      )
      SELECT id FROM category_tree`,
      [id]
    );

    return rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value));
  }

  async withTreeProductCounts(rows = []) {
    if (!rows.length) return rows;

    const [categories] = await this.execute(
      `SELECT id, parent_id
      FROM categories
      WHERE deleted_at IS NULL`
    );
    const [productCounts] = await this.execute(
      `SELECT category_id, COUNT(*) AS total
      FROM products
      WHERE deleted_at IS NULL AND category_id IS NOT NULL
      GROUP BY category_id`
    );
    const childrenByParent = new Map();
    const directCounts = new Map();

    categories.forEach((category) => {
      const parentId = category.parent_id == null ? null : Number(category.parent_id);
      if (parentId == null) return;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(Number(category.id));
    });

    productCounts.forEach((item) => {
      directCounts.set(Number(item.category_id), Number(item.total || 0));
    });

    const countCache = new Map();
    const countDescendants = (categoryId) => {
      if (countCache.has(categoryId)) return countCache.get(categoryId);
      const children = childrenByParent.get(categoryId) || [];
      const total = children.length
        ? children.reduce((sum, childId) => sum + countDescendants(childId), 0)
        : directCounts.get(categoryId) || 0;
      countCache.set(categoryId, total);
      return total;
    };

    return rows.map((row) => ({
      ...row,
      product_count: countDescendants(Number(row.id))
    }));
  }

  async softDelete(id) {
    const startedAt = Date.now();
    const [result] = await this.execute(
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
