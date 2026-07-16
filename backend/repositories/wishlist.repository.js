/**
 * Wishlist repository.
 * It owns all MySQL data access for user wishlist items.
 */
import { BaseRepository } from "./base.repository.js";
import { Product } from "../models/product.model.js";
import { logger } from "../utils/logger.util.js";

const WISHLIST_PRODUCT_SELECT = `
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
    p.updated_at,
    wi.created_at AS wishlist_created_at
  FROM wishlist_items wi
  JOIN products p ON p.id = wi.product_id AND p.deleted_at IS NULL
  LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
  WHERE wi.user_id = ?
  ORDER BY wi.created_at DESC`;

export class WishlistRepository extends BaseRepository {
  constructor(...args) {
    super(...args);
    this.schemaPromise = null;
  }

  async ensureSchema() {
    if (!this.schemaPromise) {
      this.schemaPromise = this.client.getPool().execute(`
        CREATE TABLE IF NOT EXISTS wishlist_items (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          product_id BIGINT UNSIGNED NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
          KEY idx_wishlist_user (user_id),
          KEY idx_wishlist_product (product_id),
          CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `).catch((error) => {
        this.schemaPromise = null;
        throw error;
      });
    }
    await this.schemaPromise;
  }

  async findItemsByUserId(userId) {
    await this.ensureSchema();
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(WISHLIST_PRODUCT_SELECT, [userId]);

    logger.sql("Wishlist items retrieved.", {
      repository: "WishlistRepository",
      operation: "findItemsByUserId",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => new Product(row));
  }

  async findProductIdsByUserId(userId) {
    await this.ensureSchema();
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    logger.sql("Wishlist product ids retrieved.", {
      repository: "WishlistRepository",
      operation: "findProductIdsByUserId",
      durationMs: Date.now() - startedAt
    });

    return rows.map((row) => ({ productId: row.product_id }));
  }

  async findItem(userId, productId) {
    await this.ensureSchema();
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT id, user_id, product_id, created_at FROM wishlist_items WHERE user_id = ? AND product_id = ? LIMIT 1`,
      [userId, productId]
    );

    logger.sql("Wishlist lookup executed.", {
      repository: "WishlistRepository",
      operation: "findItem",
      durationMs: Date.now() - startedAt
    });

    return rows[0] || null;
  }

  async insert(userId, productId) {
    await this.ensureSchema();
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)`,
      [userId, productId]
    );

    logger.sql("Wishlist item inserted.", {
      repository: "WishlistRepository",
      operation: "insert",
      durationMs: Date.now() - startedAt
    });
  }

  async deleteByUserAndProduct(userId, productId) {
    await this.ensureSchema();
    const startedAt = Date.now();
    await this.client.getPool().execute(
      `DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );

    logger.sql("Wishlist item deleted.", {
      repository: "WishlistRepository",
      operation: "deleteByUserAndProduct",
      durationMs: Date.now() - startedAt
    });
  }

  async countByUserId(userId) {
    await this.ensureSchema();
    const startedAt = Date.now();
    const [rows] = await this.client.getPool().execute(
      `SELECT COUNT(*) AS total FROM wishlist_items WHERE user_id = ?`,
      [userId]
    );

    logger.sql("Wishlist count retrieved.", {
      repository: "WishlistRepository",
      operation: "countByUserId",
      durationMs: Date.now() - startedAt
    });

    return Number(rows[0]?.total || 0);
  }
}
