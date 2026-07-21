import { BaseRepository } from "./base.repository.js";
import { normalizeSqlParams } from "../utils/sql-query.util.js";

const PRODUCT_COLUMNS = `
  p.id,
  p.name,
  p.slug,
  p.sku,
  c.name AS category_name,
  p.brand,
  p.short_description,
  p.description,
  p.price,
  p.sale_price,
  p.stock,
  p.status,
  p.thumbnail_url,
  p.tags,
  p.product_attributes
`;

export class ChatbotRepository extends BaseRepository {
  async searchProducts({ keywords = [], color = "", size = "", priceMin = null, priceMax = null, limit = 5 } = {}) {
    const conditions = ["p.deleted_at IS NULL", "p.status = 'active'"];
    const params = [];
    const searchableColumns = ["p.name", "p.slug", "p.sku", "p.brand", "p.short_description", "p.description", "c.name"];

    const allKeywords = [...keywords, color, size].map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
    if (allKeywords.length) {
      conditions.push(`(${allKeywords.map(() => `(${searchableColumns.map((column) => `${column} LIKE ?`).join(" OR ")})`).join(" AND ")})`);
      allKeywords.forEach((keyword) => {
        searchableColumns.forEach(() => params.push(`%${keyword}%`));
      });
    }

    if (Number.isFinite(Number(priceMax)) && Number(priceMax) > 0) {
      conditions.push("COALESCE(NULLIF(p.sale_price, 0), p.price) <= ?");
      params.push(Number(priceMax));
    }

    if (Number.isFinite(Number(priceMin)) && Number(priceMin) > 0) {
      conditions.push("COALESCE(NULLIF(p.sale_price, 0), p.price) >= ?");
      params.push(Number(priceMin));
    }

    const rows = await this.executeProductSelect(
      `SELECT ${PRODUCT_COLUMNS}
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE WHEN p.stock > 0 THEN 0 ELSE 1 END,
        p.sold DESC,
        p.created_at DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 5, 1), 5)}`,
      params
    );

    return rows.map(mapProduct);
  }

  async getActiveProductSamples(limit = 5) {
    const rows = await this.executeProductSelect(
      `SELECT ${PRODUCT_COLUMNS}
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'active'
      ORDER BY
        CASE WHEN p.stock > 0 THEN 0 ELSE 1 END,
        p.sold DESC,
        p.created_at DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 5, 1), 5)}`
    );

    return rows.map(mapProduct);
  }

  async getNewProducts(limit = 5) {
    const rows = await this.executeProductSelect(
      `SELECT ${PRODUCT_COLUMNS}
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'active'
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 5, 1), 5)}`
    );

    return rows.map(mapProduct);
  }

  async getBestSellingProducts(limit = 5) {
    const rows = await this.executeProductSelect(
      `SELECT ${PRODUCT_COLUMNS}
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'active'
      ORDER BY p.sold DESC, CASE WHEN p.stock > 0 THEN 0 ELSE 1 END, p.created_at DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 5, 1), 5)}`
    );

    return rows.map(mapProduct);
  }

  async getActiveVouchers(limit = 5) {
    const [rows] = await this.execute(
      `SELECT
        id,
        code,
        name,
        description,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount_amount,
        quantity,
        used_quantity,
        starts_at,
        expires_at,
        status
      FROM vouchers
      WHERE status = 'active'
        AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
        AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)
        AND (quantity IS NULL OR used_quantity < quantity)
      ORDER BY created_at DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 5, 1), 5)}`
    );

    return rows.map(mapVoucher);
  }

  async getRecentOrdersByCustomer(customerId, limit = 5) {
    const [rows] = await this.execute(
      `SELECT
        id,
        order_code,
        status,
        payment_status,
        payment_method,
        grand_total,
        created_at,
        updated_at
      FROM orders
      WHERE deleted_at IS NULL AND customer_id = ?
      ORDER BY created_at DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 5, 1), 5)}`,
      [customerId]
    );

    return rows.map((row) => ({
      id: row.id,
      orderCode: row.order_code,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      grandTotal: Number(row.grand_total || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  execute(sql, params = []) {
    return this.client.getPool().execute(sql, normalizeSqlParams(params));
  }

  async executeProductSelect(sql, params = []) {
    try {
      const [rows] = await this.execute(sql, params);
      return rows;
    } catch (error) {
      if (error?.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }

      const legacySql = sql
        .replace("  p.tags,\n  p.product_attributes", "  NULL AS tags,\n  NULL AS product_attributes")
        .replace("  p.product_attributes", "  NULL AS product_attributes");
      const [rows] = await this.execute(legacySql, params);
      return rows;
    }
  }
}

function mapProduct(row = {}) {
  const salePrice = row.sale_price === null || row.sale_price === undefined ? null : Number(row.sale_price);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    categoryName: row.category_name || "Sản phẩm",
    brand: row.brand || "",
    shortDescription: row.short_description || "",
    description: row.description || "",
    price: Number(row.price || 0),
    salePrice,
    finalPrice: salePrice && salePrice > 0 ? salePrice : Number(row.price || 0),
    stock: Number(row.stock || 0),
    status: row.status,
    thumbnailUrl: row.thumbnail_url || null,
    tags: parseJson(row.tags, []),
    productAttributes: parseJson(row.product_attributes, {})
  };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapVoucher(row = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || "",
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    minOrderAmount: Number(row.min_order_amount || 0),
    maxDiscountAmount: row.max_discount_amount === null || row.max_discount_amount === undefined ? null : Number(row.max_discount_amount),
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    usedQuantity: Number(row.used_quantity || 0),
    startsAt: row.starts_at || null,
    expiresAt: row.expires_at || null,
    status: row.status
  };
}
