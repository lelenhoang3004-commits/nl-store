/**
 * Cart repository.
 * It owns MySQL access for carts and cart_items.
 */
import { BaseRepository } from "./base.repository.js";
import { Cart, CartItem } from "../models/cart.model.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { logger } from "../utils/logger.util.js";

let schemaReadyPromise = null;

export class CartRepository extends BaseRepository {
  async ensureSchema() {
    if (!schemaReadyPromise) {
      schemaReadyPromise = this.createSchema();
    }

    return schemaReadyPromise;
  }

  async createSchema() {
    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS carts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        status ENUM('active', 'converted', 'abandoned') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        UNIQUE KEY uq_carts_user_status (user_id, status),
        CONSTRAINT fk_carts_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        cart_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        variant_id VARCHAR(100),
        variant_key VARCHAR(255) NOT NULL,
        size VARCHAR(50),
        color VARCHAR(80),
        product_name VARCHAR(200) NOT NULL,
        product_sku VARCHAR(100),
        product_image_url VARCHAR(255),
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        quantity INT NOT NULL DEFAULT 1,
        total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        is_selected TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cart_items_variant (cart_id, variant_key),
        CONSTRAINT fk_cart_items_cart
          FOREIGN KEY (cart_id) REFERENCES carts(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_cart_items_product
          FOREIGN KEY (product_id) REFERENCES products(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.ensureCartItemsColumn("is_selected", "TINYINT(1) NOT NULL DEFAULT 1");
    await this.ensureTableColumn("order_details", "variant_id", "VARCHAR(100) NULL AFTER product_image_url");
    await this.ensureTableColumn("order_details", "size", "VARCHAR(50) NULL AFTER variant_id");
    await this.ensureTableColumn("order_details", "color", "VARCHAR(50) NULL AFTER size");
  }

  async ensureCartItemsColumn(columnName, definition) {
    const [rows] = await this.client.getPool().execute(
      `SHOW COLUMNS FROM cart_items LIKE '${columnName}'`
    );

    if (!rows.length) {
      await this.client.getPool().execute(`ALTER TABLE cart_items ADD COLUMN ${columnName} ${definition}`);
    }
  }

  async ensureTableColumn(tableName, columnName, definition) {
    const allowedTables = new Set(["order_details"]);
    if (!allowedTables.has(tableName)) return;
    const [rows] = await this.client.getPool().execute(`SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`);
    if (!rows.length) await this.client.getPool().execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }

  async findActiveCartByUserId(userId) {
    await this.ensureSchema();
    const [rows] = await this.client.getPool().execute(
      `SELECT id, user_id, status, created_at, updated_at
      FROM carts
      WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL
      LIMIT 1`,
      [userId]
    );

    if (!rows[0]) {
      return null;
    }

    const items = await this.findItemsByCartId(rows[0].id);
    return new Cart({ ...rows[0], items });
  }

  async createActiveCart(userId, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [result] = await executor.execute(
      `INSERT INTO carts (user_id, status)
      VALUES (?, 'active')
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [userId]
    );

    if (result.insertId) {
      return result.insertId;
    }

    const [rows] = await executor.execute(
      `SELECT id FROM carts WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );

    return rows[0]?.id;
  }

  async findProductById(productId) {
    const [rows] = await this.client.getPool().execute(
      `SELECT
        id,
        name,
        slug,
        sku,
        category_id,
        brand,
        short_description,
        description,
        price,
        sale_price,
        stock,
        sold,
        status,
        thumbnail_url,
        gallery_urls,
        tags,
        created_at,
        updated_at
      FROM products
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1`,
      [productId]
    );

    return rows[0] ? new Product(rows[0]) : null;
  }

  async findItemByVariantKey(cartId, variantKey, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [rows] = await executor.execute(
      `SELECT id, cart_id, product_id, variant_id, variant_key, size, color, product_name,
        product_sku, product_image_url, unit_price, quantity, total_price, is_selected, created_at, updated_at
      FROM cart_items
      WHERE cart_id = ? AND variant_key = ?
      LIMIT 1`,
      [cartId, variantKey]
    );

    return rows[0] ? new CartItem(rows[0]) : null;
  }

  async addItem(cartId, payload, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    await executor.execute(
      `INSERT INTO cart_items
        (cart_id, product_id, variant_id, variant_key, size, color, product_name, product_sku, product_image_url, unit_price, quantity, total_price, is_selected)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        cartId,
        payload.productId,
        payload.variantId,
        payload.variantKey,
        payload.size,
        payload.color,
        payload.productName,
        payload.productSku,
        payload.productImageUrl,
        payload.unitPrice,
        payload.quantity,
        payload.totalPrice
      ]
    );
  }

  async updateItemQuantity(itemId, quantity, unitPrice, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    await executor.execute(
      `UPDATE cart_items
      SET quantity = ?,
        total_price = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [quantity, quantity * unitPrice, itemId]
    );
  }

  async findItemByIdForUser(userId, itemId) {
    await this.ensureSchema();
    const [rows] = await this.client.getPool().execute(
      `SELECT ci.id, ci.cart_id, ci.product_id, ci.variant_id, ci.variant_key, ci.size, ci.color,
        ci.product_name, ci.product_sku, ci.product_image_url, ci.unit_price, ci.quantity,
        ci.total_price, ci.is_selected, ci.created_at, ci.updated_at
      FROM cart_items ci
      INNER JOIN carts c ON c.id = ci.cart_id
      WHERE ci.id = ? AND c.user_id = ? AND c.status = 'active' AND c.deleted_at IS NULL
      LIMIT 1`,
      [itemId, userId]
    );

    return rows[0] ? new CartItem(rows[0]) : null;
  }

  async updateItemSelection(itemId, isSelected, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    await executor.execute(
      `UPDATE cart_items
      SET is_selected = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [isSelected ? 1 : 0, itemId]
    );
  }

  async updateAllSelection(cartId, isSelected, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    await executor.execute(
      `UPDATE cart_items
      SET is_selected = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE cart_id = ?`,
      [isSelected ? 1 : 0, cartId]
    );
  }

  async deleteItem(itemId, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    await executor.execute(
      `DELETE FROM cart_items WHERE id = ?`,
      [itemId]
    );
  }

  async findItemsByCartId(cartId) {
    await this.ensureSchema();
    const [rows] = await this.client.getPool().execute(
      `SELECT id, cart_id, product_id, variant_id, variant_key, size, color, product_name,
        product_sku, product_image_url, unit_price, quantity, total_price, is_selected, created_at, updated_at
      FROM cart_items
      WHERE cart_id = ?
      ORDER BY updated_at DESC, id DESC`,
      [cartId]
    );

    logger.sql("Cart items query executed.", {
      repository: "CartRepository",
      operation: "findItemsByCartId",
      totalItems: rows.length
    });

    return rows.map((row) => new CartItem(row));
  }

  async findSelectedItemsByCartId(cartId, connection = null) {
    await this.ensureSchema();
    const executor = connection || this.client.getPool();
    const [rows] = await executor.execute(
      `SELECT id, cart_id, product_id, variant_id, variant_key, size, color, product_name,
        product_sku, product_image_url, unit_price, quantity, total_price, is_selected, created_at, updated_at
      FROM cart_items
      WHERE cart_id = ? AND is_selected = 1
      ORDER BY id ASC`,
      [cartId]
    );

    return rows.map((row) => new CartItem(row));
  }

  async findProductForUpdate(productId, connection) {
    const [rows] = await connection.execute(
      `SELECT
        id,
        name,
        slug,
        sku,
        category_id,
        brand,
        short_description,
        description,
        price,
        sale_price,
        stock,
        sold,
        status,
        thumbnail_url,
        gallery_urls,
        tags,
        created_at,
        updated_at
      FROM products
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE`,
      [productId]
    );

    return rows[0] ? new Product(rows[0]) : null;
  }

  async updateProductInventory(productId, quantity, connection) {
    await connection.execute(
      `UPDATE products
      SET stock = stock - ?,
        sold = sold + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND stock >= ? AND deleted_at IS NULL`,
      [quantity, quantity, productId, quantity]
    );
  }

  async countActiveVariantsForProduct(productId, connection) {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) AS total FROM product_variants
       WHERE product_id = ? AND deleted_at IS NULL AND status IN ('active', 'out_of_stock')`,
      [productId]
    );
    return Number(rows[0]?.total || 0);
  }

  async createOrder(payload, connection) {
    const [result] = await connection.execute(
      `INSERT INTO orders
        (order_code, customer_id, customer_name, customer_email, customer_phone, shipping_address, status, payment_status, payment_method, subtotal, discount_total, shipping_fee, tax_total, grand_total, paid_amount, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.orderCode,
        payload.customerId,
        payload.customerName,
        payload.customerEmail,
        payload.customerPhone,
        JSON.stringify(payload.shippingAddress || null),
        payload.status,
        payload.paymentStatus,
        payload.paymentMethod,
        payload.subtotal,
        payload.discountTotal,
        payload.shippingFee,
        payload.taxTotal,
        payload.grandTotal,
        payload.paidAmount,
        payload.note
      ]
    );

    return result.insertId;
  }

  async createOrderDetails(orderId, items, connection) {
    for (const item of items) {
      await connection.execute(
        `INSERT INTO order_details
          (order_id, product_id, product_name, product_sku, product_image_url, variant_id, size, color, quantity, unit_price, discount_amount, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.productName,
          item.productSku,
          item.productImageUrl,
          item.variantId,
          item.size,
          item.color,
          item.quantity,
          item.unitPrice,
          0,
          item.totalPrice
        ]
      );
    }
  }

  async addOrderHistory(orderId, payload, connection) {
    await connection.execute(
      `INSERT INTO order_histories
        (order_id, status, note, changed_by)
      VALUES (?, ?, ?, ?)`,
      [orderId, payload.status, payload.note, payload.changedBy]
    );
  }

  async createPaymentTransaction(payload, connection) {
    const [result] = await connection.execute(
      `INSERT INTO payment_transactions
        (order_id, payment_method_id, transaction_code, provider, method, amount, currency, status, paid_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.orderId,
        payload.paymentMethodId,
        payload.transactionCode,
        payload.provider,
        payload.method,
        payload.amount,
        payload.currency,
        payload.status,
        payload.paidAt,
        JSON.stringify(payload.metadata || null)
      ]
    );

    return result.insertId;
  }

  async addPaymentHistory(transactionId, payload, connection) {
    await connection.execute(
      `INSERT INTO payment_histories
        (transaction_id, status, note, changed_by)
      VALUES (?, ?, ?, ?)`,
      [transactionId, payload.status, payload.note, payload.changedBy]
    );
  }

  async deleteItems(itemIds, connection) {
    if (!itemIds.length) {
      return;
    }

    const placeholders = itemIds.map(() => "?").join(", ");
    await connection.execute(
      `DELETE FROM cart_items WHERE id IN (${placeholders})`,
      itemIds
    );
  }

  async findOrderById(orderId) {
    const [rows] = await this.client.getPool().execute(
      `SELECT
        id,
        order_code,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        status,
        payment_status,
        payment_method,
        subtotal,
        discount_total,
        shipping_fee,
        tax_total,
        grand_total,
        paid_amount,
        note,
        created_at,
        updated_at
      FROM orders
      WHERE id = ? AND deleted_at IS NULL
      LIMIT 1`,
      [orderId]
    );

    return rows[0] ? new Order(rows[0]) : null;
  }
}
