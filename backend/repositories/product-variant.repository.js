import { BaseRepository } from "./base.repository.js";
import { ProductVariant } from "../models/product-variant.model.js";

const SELECT = `SELECT id, product_id, sku, size, color, color_code, price, sale_price, stock, sold, status, created_at, updated_at FROM product_variants`;
let schemaReadyPromise = null;

export class ProductVariantRepository extends BaseRepository {
  async ensureSchema() {
    if (!schemaReadyPromise) {
      schemaReadyPromise = this.createSchema();
    }

    return schemaReadyPromise;
  }

  async createSchema() {
    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id BIGINT UNSIGNED NOT NULL,
        sku VARCHAR(120) NOT NULL UNIQUE,
        size VARCHAR(50),
        color VARCHAR(50),
        color_code VARCHAR(20),
        price DECIMAL(12,2),
        sale_price DECIMAL(12,2),
        stock INT NOT NULL DEFAULT 0,
        sold INT NOT NULL DEFAULT 0,
        status ENUM('active', 'inactive', 'out_of_stock') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        KEY idx_product_variants_product (product_id),
        CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.ensureTableColumn("order_details", "variant_id", "VARCHAR(100) NULL AFTER product_image_url");
    await this.ensureTableColumn("order_details", "size", "VARCHAR(50) NULL AFTER variant_id");
    await this.ensureTableColumn("order_details", "color", "VARCHAR(50) NULL AFTER size");
  }

  async ensureTableColumn(tableName, columnName, definition) {
    const allowedTables = new Set(["order_details"]);
    if (!allowedTables.has(tableName)) return;

    const [rows] = await this.client.getPool().execute(`SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`);
    if (!rows.length) {
      await this.client.getPool().execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  async findByProductId(productId, { customerOnly = false, connection = null } = {}) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [rows] = await executor.execute(`${SELECT} WHERE product_id = ? AND deleted_at IS NULL ${customerOnly ? "AND status = 'active'" : ""} ORDER BY color, size, id`, [productId]);
    return rows.map((row) => new ProductVariant(row));
  }

  async findByProductIds(productIds, { customerOnly = false } = {}) {
    await this.ensureSchema();
    if (!productIds.length) return new Map();
    const placeholders = productIds.map(() => "?").join(",");
    const [rows] = await this.client.getPool().execute(`${SELECT} WHERE product_id IN (${placeholders}) AND deleted_at IS NULL ${customerOnly ? "AND status = 'active'" : ""} ORDER BY product_id, color, size, id`, productIds);
    return rows.reduce((map, row) => {
      const item = new ProductVariant(row);
      if (!map.has(item.productId)) map.set(item.productId, []);
      map.get(item.productId).push(item);
      return map;
    }, new Map());
  }

  async findById(id, { connection = null, forUpdate = false } = {}) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [rows] = await executor.execute(`${SELECT} WHERE id = ? AND deleted_at IS NULL LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`, [id]);
    return rows[0] ? new ProductVariant(rows[0]) : null;
  }

  async findBySku(sku, excludedId = null) {
    await this.ensureSchema();
    const params = [sku];
    if (excludedId) params.push(excludedId);
    const [rows] = await this.client.getPool().execute(`${SELECT} WHERE sku = ? AND deleted_at IS NULL ${excludedId ? "AND id <> ?" : ""} LIMIT 1`, params);
    return rows[0] ? new ProductVariant(rows[0]) : null;
  }

  async findByProductColorSize(productId, color, size, excludedId = null) {
    await this.ensureSchema();
    const params = [productId, String(color || "").trim().toLowerCase(), String(size || "").trim().toLowerCase()];
    if (excludedId) params.push(excludedId);
    const [rows] = await this.client.getPool().execute(`${SELECT} WHERE product_id = ? AND deleted_at IS NULL AND LOWER(TRIM(color)) = ? AND LOWER(TRIM(size)) = ? ${excludedId ? "AND id <> ?" : ""} LIMIT 1`, params);
    return rows[0] ? new ProductVariant(rows[0]) : null;
  }

  async create(payload) {
    await this.ensureSchema();
    const [result] = await this.client.getPool().execute(`INSERT INTO product_variants (product_id, sku, size, color, color_code, price, sale_price, stock, sold, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, this.params(payload));
    return this.findById(result.insertId);
  }

  async update(id, payload) {
    await this.ensureSchema();
    await this.client.getPool().execute(`UPDATE product_variants SET product_id=?, sku=?, size=?, color=?, color_code=?, price=?, sale_price=?, stock=?, sold=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`, [...this.params(payload), id]);
    return this.findById(id);
  }

  async updateStock(id, payload) {
    await this.ensureSchema();
    const stock = Number(payload.stock ?? 0);
    const nextStatus = stock > 0 ? "active" : "out_of_stock";
    const [result] = await this.client.getPool().execute(`UPDATE product_variants SET stock=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`, [stock, nextStatus, id]);
    return result.affectedRows > 0;
  }

  async updateStatus(id, status) {
    await this.ensureSchema();
    const [result] = await this.client.getPool().execute(`UPDATE product_variants SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`, [status, id]);
    return result.affectedRows > 0;
  }

  async softDelete(id) {
    await this.ensureSchema();
    const [result] = await this.client.getPool().execute(`UPDATE product_variants SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL`, [id]);
    return result.affectedRows > 0;
  }

  async updateInventory(id, quantity, connection) {
    await this.ensureSchema();
    const [result] = await connection.execute(`UPDATE product_variants SET stock=stock-?, sold=sold+?, status=CASE WHEN stock-? <= 0 THEN 'out_of_stock' ELSE status END, updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=? AND deleted_at IS NULL`, [quantity, quantity, quantity, id, quantity]);
    return result.affectedRows > 0;
  }

  async syncProductInventory(productId, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    await executor.execute(`UPDATE products p SET p.stock=COALESCE((SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id=p.id AND pv.deleted_at IS NULL),0), p.sold=COALESCE((SELECT SUM(pv.sold) FROM product_variants pv WHERE pv.product_id=p.id AND pv.deleted_at IS NULL),0), p.updated_at=CURRENT_TIMESTAMP WHERE p.id=? AND p.deleted_at IS NULL`, [productId]);
  }

  params(payload) { return [payload.productId, payload.sku, payload.size, payload.color, payload.colorCode, payload.price, payload.salePrice, payload.stock, payload.sold, payload.status]; }
}
