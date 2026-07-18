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
    p.rating_average,
    p.rating_count,
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

const PRODUCT_SELECT_WITHOUT_RATING_COUNT = PRODUCT_SELECT
  .replace("    p.rating_count,", "    0 AS rating_count,");

const LEGACY_PRODUCT_SELECT = PRODUCT_SELECT_WITHOUT_RATING_COUNT
  .replace("    p.rating_average,", "    4.8 AS rating_average,")
  .replace("    p.product_attributes,", "    NULL AS product_attributes,");

const normalizePagination = (pagination = {}) => {
  const parsedLimit = Number.parseInt(pagination?.limit, 10);
  const parsedOffset = Number.parseInt(pagination?.offset, 10);

  return {
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 12,
    offset: Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
  };
};

const normalizeSqlParams = (params = []) => params.map((value) => value === undefined ? null : value);

export class ProductRepository extends BaseRepository {
  async findAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const sortColumn = SORT_COLUMNS[options.sort.field] || SORT_COLUMNS.createdAt;
    const sortDirection = options.sort.direction === "asc" ? "ASC" : "DESC";
    const { limit, offset } = normalizePagination(options.pagination);

    const rows = await this.executeProductSelect(
      `${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    logger.sql("Product list query executed.", {
      repository: "ProductRepository",
      operation: "findAll",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new Product(row));
  }

  async executeProductSelect(suffixSql, params) {
    try {
      const [rows] = await this.execute(`${PRODUCT_SELECT}\n${suffixSql}`, params);
      return rows;
    } catch (error) {
      // Log SQL error details for troubleshooting
      logger.error("Product select failed.", {
        repository: "ProductRepository",
        code: error?.code,
        message: error?.message,
        sqlMessage: error?.sqlMessage,
        sql: error?.sql,
        params: normalizeSqlParams(params)
      });

      if (!isMissingColumnError(error, "rating_count")) {
        if (error?.code !== "ER_BAD_FIELD_ERROR") {
          throw error;
        }

        logger.warn("Products schema is missing optional product columns; using legacy-compatible select.", {
          repository: "ProductRepository",
          code: error.code,
          sqlMessage: error.sqlMessage
        });
        const [rows] = await this.execute(`${LEGACY_PRODUCT_SELECT}\n${suffixSql}`, params);
        return rows;
      }

      logger.warn("Products schema is missing rating_count; selecting rating_average with default rating_count.", {
        repository: "ProductRepository",
        code: error.code,
        sqlMessage: error.sqlMessage
      });
      try {
        const [rows] = await this.execute(`${PRODUCT_SELECT_WITHOUT_RATING_COUNT}\n${suffixSql}`, params);
        return rows;
      } catch (fallbackError) {
        logger.error("Product select fallback failed.", {
          repository: "ProductRepository",
          code: fallbackError?.code,
          message: fallbackError?.message,
          sqlMessage: fallbackError?.sqlMessage,
          sql: fallbackError?.sql
        });
        if (fallbackError?.code !== "ER_BAD_FIELD_ERROR") {
          throw fallbackError;
        }

        logger.warn("Products schema is missing rating_average; using legacy rating defaults.", {
          repository: "ProductRepository",
          code: fallbackError.code,
          sqlMessage: fallbackError.sqlMessage
        });
        const [rows] = await this.execute(`${LEGACY_PRODUCT_SELECT}\n${suffixSql}`, params);
        return rows;
      }
    }
  }

  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }

  async countAll(options) {
    const startedAt = Date.now();
    const { whereSql, params } = this.buildWhereClause(options);
    const [rows] = await this.execute(
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
    const rows = await this.executeProductSelect(
      `WHERE p.id = ? AND p.deleted_at IS NULL
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

    const [rows] = await this.execute(
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
    const sql = `INSERT INTO products
        (name, slug, sku, category_id, brand, short_description, description, price, sale_price, stock, sold, rating_average, rating_count, status, thumbnail_url, gallery_urls, tags, product_attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const sqlWithoutRatingCount = `INSERT INTO products
        (name, slug, sku, category_id, brand, short_description, description, price, sale_price, stock, sold, rating_average, status, thumbnail_url, gallery_urls, tags, product_attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const legacySql = `INSERT INTO products
        (name, slug, sku, category_id, brand, short_description, description, price, sale_price, stock, sold, status, thumbnail_url, gallery_urls, tags, product_attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await this.executeProductWrite(sql, this.toSqlParams(payload), sqlWithoutRatingCount, this.toSqlParamsWithoutRatingCount(payload), legacySql, this.toLegacySqlParams(payload), "create");

    logger.sql("Product create query executed.", {
      repository: "ProductRepository",
      operation: "create",
      durationMs: Date.now() - startedAt
    });

    return this.findById(result.insertId);
  }

  async update(id, payload) {
    const startedAt = Date.now();
    const fields = [
      ["name", payload.name],
      ["slug", payload.slug],
      ["sku", payload.sku],
      ["category_id", payload.categoryId],
      ["brand", payload.brand],
      ["short_description", payload.shortDescription],
      ["description", payload.description],
      ["price", payload.price],
      ["sale_price", payload.salePrice],
      ["stock", payload.stock],
      ["sold", payload.sold],
      ["rating_average", payload.ratingAverage],
      ["status", payload.status],
      ["thumbnail_url", payload.thumbnailUrl],
      ["gallery_urls", JSON.stringify(payload.galleryUrls || [])],
      ["tags", JSON.stringify(payload.tags || [])],
      ["product_attributes", JSON.stringify(payload.productAttributes || {})]
    ];

    if (payload.ratingCountProvided) {
      fields.splice(12, 0, ["rating_count", payload.ratingCount]);
    }

    const setSql = fields.map(([column]) => `${column} = ?`).join(",\n        ");
    const params = [...fields.map(([, value]) => value), id];
    const sql = `UPDATE products
      SET ${setSql},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`;

    try {
      await this.execute(sql, params);
    } catch (error) {
      logger.error("Product update failed.", {
        repository: "ProductRepository",
        operation: "update",
        code: error?.code,
        message: error?.message,
        sqlMessage: error?.sqlMessage,
        sql: error?.sql || sql,
        params: normalizeSqlParams(params)
      });
      throw error;
    }

    logger.sql("Product update query executed.", {
      repository: "ProductRepository",
      operation: "update",
      durationMs: Date.now() - startedAt
    });

    return this.findById(id);
  }
  async executeProductWrite(sql, params, sqlWithoutRatingCount, paramsWithoutRatingCount, legacySql, legacyParams, operation) {
    try {
      return await this.execute(sql, params);
    } catch (error) {
      // Log SQL error details for troubleshooting
      logger.error("Product write failed.", {
        repository: "ProductRepository",
        operation,
        code: error?.code,
        message: error?.message,
        sqlMessage: error?.sqlMessage,
        sql: error?.sql,
        params: normalizeSqlParams(params)
      });

      if (!isMissingRatingColumnError(error)) {
        throw error;
      }

      if (isMissingColumnError(error, "rating_count")) {
        logger.warn("Products schema is missing rating_count; writing rating_average without rating_count. Run the product ratings migration to persist rating_count.", {
          repository: "ProductRepository",
          operation,
          code: error.code,
          sqlMessage: error.sqlMessage || error.message
        });
        try {
          return await this.execute(sqlWithoutRatingCount, paramsWithoutRatingCount);
        } catch (fallbackError) {
          logger.error("Product write fallback failed.", {
            repository: "ProductRepository",
            operation,
            code: fallbackError?.code,
            message: fallbackError?.message,
            sqlMessage: fallbackError?.sqlMessage,
            sql: fallbackError?.sql,
            params: normalizeSqlParams(paramsWithoutRatingCount)
          });
          if (!isMissingColumnError(fallbackError, "rating_average")) {
            throw fallbackError;
          }
          error = fallbackError;
        }
      }

      logger.warn("Products schema is missing rating_average; using legacy-compatible write. Run the product ratings migration to persist ratings.", {
        repository: "ProductRepository",
        operation,
        code: error.code,
        sqlMessage: error.sqlMessage || error.message
      });
      return this.execute(legacySql, legacyParams);
    }
  }
  async updateStock(id, stock) {
    const startedAt = Date.now();
    await this.execute(
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
    await this.execute(
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
    const [result] = await this.execute(
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
      payload.ratingAverage,
      payload.ratingCount,
      payload.status,
      payload.thumbnailUrl,
      JSON.stringify(payload.galleryUrls || []),
      JSON.stringify(payload.tags || []),
      JSON.stringify(payload.productAttributes || {})
    ];
  }
  toSqlParamsWithoutRatingCount(payload) {
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
      payload.ratingAverage,
      payload.status,
      payload.thumbnailUrl,
      JSON.stringify(payload.galleryUrls || []),
      JSON.stringify(payload.tags || []),
      JSON.stringify(payload.productAttributes || {})
    ];
  }

  toLegacySqlParams(payload) {
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

function isMissingColumnError(error, columnName) {
  if (error?.code !== "ER_BAD_FIELD_ERROR") return false;
  return String(error.sqlMessage || error.message || "").toLowerCase().includes(columnName);
}

function isMissingRatingColumnError(error) {
  return isMissingColumnError(error, "rating_average") || isMissingColumnError(error, "rating_count");
}
