/**
 * Product repository.
 * It owns all MySQL access for product data and keeps SQL out of services/controllers.
 */
import { BaseRepository } from "./base.repository.js";
import { Product } from "../models/product.model.js";
import { logger } from "../utils/logger.util.js";

const SORT_COLUMNS = Object.freeze({
  name: "p.name",
  slug: "p.slug",
  sku: "p.sku",
  price: "p.price",
  salePrice: "p.sale_price",
  stock: "p.stock",
  sold: "p.sold",
  status: "p.status",
  createdAt: "p.created_at",
  updatedAt: "p.updated_at"
});

const PRODUCT_SELECT = `
  SELECT
    p.id,
    p.name,
    p.slug,
    p.sku,
    p.category_id,
    c.name AS category_name,
    p.brand,
    p.short_description,
    p.description,
    p.price,
    p.sale_price,
    p.stock,
    p.sold,
    p.status,
    p.thumbnail_url,
    p.gallery_urls,
    p.tags,
    p.product_attributes,
    p.created_at,
    p.updated_at
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
`;

export class ProductRepository extends BaseRepository {
  async findAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";

    const [rows] = await this.client.getPool().execute(
      `${PRODUCT_SELECT}
      ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?`,
      [...params, options.pagination.limit, options.pagination.offset]
    );

    logger.sql("Product list query executed.", {
      repository: "ProductRepository",
      operation: "findAll",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new Product(row));
  }

  async countAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.client.getPool().execute(
      `SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      ${whereSql}`,
      params
    );

    logger.sql("Product count query executed.", {
      repository: "ProductRepository",
      operation: "countAll",
      durationMs: Date.now() - startedAt
    });

    return Number(rows[0]?.total || 0);
  }

  async findById(id) {
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `${PRODUCT_SELECT}
      WHERE p.id = ? AND p.deleted_at IS NULL
      LIMIT 1`,
      [id]
    );

    logger.sql("Product lookup by id executed.", {
      repository: "ProductRepository",
      operation: "findById",
      durationMs: Date.now() - startedAt
    });

    return rows[0] ? new Product(rows[0]) : null;
  }

  async findBySlug(slug, excludedId = null) {
    return this.findByUniqueField("slug", slug, excludedId);
  }

  async findBySku(sku, excludedId = null) {
    return this.findByUniqueField("sku", sku, excludedId);
  }

  async findByUniqueField(field, value, excludedId = null) {
    const startedAt = Date.now();
    const column = field === "sku" ? "sku" : "slug";
    const params = [value];
    const excludedSql = excludedId ? "AND id <> ?" : "";

    if (excludedId) {
      params.push(excludedId);
    }

    const [rows] = await this.client.getPool().execute(
      `SELECT id, name, slug, sku, status
      FROM products
      WHERE ${column} = ? AND deleted_at IS NULL ${excludedSql}
      LIMIT 1`,
      params
    );

    logger.sql("Product unique field lookup executed.", {
      repository: "ProductRepository",
      operation: "findByUniqueField",
      field: column,
      durationMs: Date.now() - startedAt
    });

    return rows[0] ? new Product(rows[0]) : null;
  }

  async create(payload) {
    const startedAt = Date.now();
    const [result] = await this.client.getPool().execute(
      `INSERT INTO products
        (name, slug, sku, category_id, brand, short_description, description, price, sale_price, stock, sold, status, thumbnail_url, gallery_urls, tags, product_attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.toSqlParams(payload)
    );

    logger.sql("Product create query executed.", {
      repository: "ProductRepository",
      operation: "create",
      durationMs: Date.now() - startedAt
    });

    return this.findById(result.insertId);
  }

  async update(id, payload) {
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `UPDATE products
      SET name = ?,
        slug = ?,
        sku = ?,
        category_id = ?,
        brand = ?,
        short_description = ?,
        description = ?,
        price = ?,
        sale_price = ?,
        stock = ?,
        sold = ?,
        status = ?,
        thumbnail_url = ?,
        gallery_urls = ?,
        tags = ?,
        product_attributes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [...this.toSqlParams(payload), id]
    );

    logger.sql("Product update query executed.", {
      repository: "ProductRepository",
      operation: "update",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }

  async updateStock(id, stock) {
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `UPDATE products
      SET stock = ?,
        status = CASE
          WHEN ? = 0 THEN 'out_of_stock'
          WHEN status = 'out_of_stock' THEN 'active'
          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [stock, stock, id]
    );

    logger.sql("Product stock update query executed.", {
      repository: "ProductRepository",
      operation: "updateStock",
      durationMs: Date.now() - startedAt
    });
    return this.findById(id);
  }

  async updateStatus(id, status) {
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `UPDATE products
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [status, id]
    );

    logger.sql("Product status update query executed.", {
      repository: "ProductRepository",
      operation: "updateStatus",
      durationMs: Date.now() - startedAt
    });
    return this.findById(id);
  }

  async softDelete(id) {
    const startedAt = Date.now();
    const [result] = await this.client.getPool().execute(
      `UPDATE products
      SET deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    logger.sql("Product soft delete query executed.", {
      repository: "ProductRepository",
      operation: "softDelete",
      durationMs: Date.now() - startedAt
    });

    return result.affectedRows > 0;
  }

  buildWhereClause(options) {
    const conditions = ["p.deleted_at IS NULL"];
    const params = [];

    if (options.search.enabled) {
      const keywords = options.search.keyword.split("|").map((item) => item.trim()).filter(Boolean).slice(0, 12);
      const searchableColumns = ["p.name", "p.slug", "p.sku", "p.brand", "p.tags", "p.short_description", "p.description", "c.name"];
      conditions.push(`(${keywords.map(() => `(${searchableColumns.map((column) => `${column} LIKE ?`).join(" OR ")})`).join(" OR ")})`);
      keywords.forEach((keyword) => {
        searchableColumns.forEach(() => params.push(`%${keyword}%`));
      });
    }

    if (options.filter.status) {
      conditions.push("p.status = ?");
      params.push(options.filter.status);
    }

    if (options.filter.categoryId) {
      conditions.push("p.category_id = ?");
      params.push(options.filter.categoryId);
    }

    if (options.filter.brand) {
      conditions.push("p.brand = ?");
      params.push(options.filter.brand);
    }

    if (options.filter.stockStatus === "inStock") {
      conditions.push("p.stock > 10");
    }

    if (options.filter.stockStatus === "lowStock") {
      conditions.push("p.stock > 0 AND p.stock <= 10");
    }

    if (options.filter.stockStatus === "outOfStock") {
      conditions.push("p.stock = 0");
    }

    if (options.filter.lowStock === "true" || options.filter.lowStock === true || options.filter.lowStock === "1") {
      conditions.push("p.stock >= 0 AND p.stock <= 5");
    }

    if (options.filter.priceMin) {
      conditions.push("p.price >= ?");
      params.push(options.filter.priceMin);
    }

    if (options.filter.priceMax) {
      conditions.push("p.price <= ?");
      params.push(options.filter.priceMax);
    }

    return {
      whereSql: `WHERE ${conditions.join(" AND ")}`,
      params
    };
  }

  toSqlParams(payload) {
    return [
      payload.name,
      payload.slug,
      payload.sku,
      payload.categoryId,
      payload.brand,
      payload.shortDescription,
      payload.description,
      payload.price,
      payload.salePrice,
      payload.stock,
      payload.sold,
      payload.status,
      payload.thumbnailUrl,
      JSON.stringify(payload.galleryUrls || []),
      JSON.stringify(payload.tags || []),
      JSON.stringify(payload.productAttributes || {})
    ];
  }
}
