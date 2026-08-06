import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { NotificationService } from "./notification.service.js";
import { AppError } from "../utils/app-error.util.js";
import { databaseClient } from "../utils/database.util.js";

const STATUSES = ["active", "inactive", "out_of_stock"];

export class ProductVariantService {
  constructor(repository = new ProductVariantRepository(), productRepository = new ProductRepository(), notificationService = new NotificationService()) { this.repository = repository; this.productRepository = productRepository; this.notificationService = notificationService; }

  async list(productId) {
    return this.listVariants(productId);
  }

  async listVariants(productId, customerOnly = false) {
    await this.ensureProduct(productId);
    return (await this.repository.findByProductId(productId, { customerOnly })).map((item) => item.toJSON());
  }

  async create(productId, payload) {
    return this.createVariant(productId, payload);
  }

  async createVariant(productId, payload) {
    await this.ensureProduct(productId);
    const normalized = this.normalize(productId, payload);

    const result = await this.withVariantTransaction(async (connection) => {
      return this.createOrRestoreVariant(normalized, { connection, single: true });
    });
    await this.repository.syncProductInventory(productId);

    if (result.action === "existing") {
      throw new AppError("Variant already exists for this product.", 409, "VARIANT_ALREADY_EXISTS", { id: result.variant?.id, color: normalized.color, size: normalized.size });
    }

    if (result.action === "created") {
      await this.notificationService.notifyWishlistCustomers(productId, {
        type: "WISHLIST_NEW_VARIANT",
        title: "Sản phẩm yêu thích có mẫu mới",
        message: "Một sản phẩm trong danh sách yêu thích của bạn vừa có mẫu mới.",
        link: `#product-detail/${productId}`,
        relatedId: productId,
        eventKey: `wishlist-new-variant:${productId}:${result.variant.id}`
      });
    }

    return result;
  }

  async bulkCreateVariants(productId, payload = {}) {
    const product = await this.ensureProduct(productId);
    const variants = Array.isArray(payload.variants) ? payload.variants : [];
    if (!variants.length) throw new AppError("Variant list is required.", 400, "VARIANT_BULK_REQUIRED");
    if (variants.length > 200) throw new AppError("Variant list is too large.", 400, "VARIANT_BULK_TOO_LARGE");

    const seen = new Set();
    const normalizedItems = [];
    const duplicateItems = [];
    variants.forEach((item, index) => {
      const normalized = this.normalize(productId, { ...item, sku: item?.sku || createVariantSku(product.sku, item?.color, item?.size) });
      const key = variantCombinationKey(normalized.color, normalized.size);
      if (seen.has(key)) {
        duplicateItems.push({ index, action: "duplicate_payload", color: normalized.color, size: normalized.size });
        return;
      }
      seen.add(key);
      normalizedItems.push({ index, normalized });
    });

    const result = await databaseClient.withTransaction(async (connection) => {
      const items = [...duplicateItems];
      let createdCount = 0;
      let restoredCount = 0;
      let existingCount = 0;
      let failedCount = 0;

      for (const item of normalizedItems) {
        try {
          const processed = await this.createOrRestoreVariant(item.normalized, { connection, single: false });
          items.push({ index: item.index, action: processed.action, variant: processed.variant });
          if (processed.action === "created") createdCount += 1;
          else if (processed.action === "restored") restoredCount += 1;
          else if (processed.action === "existing") existingCount += 1;
          else if (processed.action === "failed") failedCount += 1;
        } catch (error) {
          failedCount += 1;
          items.push({ index: item.index, action: "failed", message: error?.message || "Không thể tạo biến thể." });
        }
      }

      await this.repository.syncProductInventory(productId, connection);
      return {
        success: true,
        created_count: createdCount,
        restored_count: restoredCount,
        existing_count: existingCount + duplicateItems.length,
        failed_count: failedCount,
        items: items.sort((a, b) => a.index - b.index)
      };
    });

    return result;
  }

  async withVariantTransaction(callback) {
    if (typeof this.repository.ensureSchema !== "function") {
      return callback(null);
    }
    return databaseClient.withTransaction(callback);
  }

  async createOrRestoreVariant(normalized, { connection = null, single = false } = {}) {
    const existingCombination = await this.repository.findAnyByProductColorSize?.(normalized.productId, normalized.color, normalized.size, null, connection) || null;
    if (existingCombination && !existingCombination.deleted_at) {
      return { action: "existing", variant: new ProductVariantLike(existingCombination).toJSON() };
    }

    const skuOwner = await this.repository.findAnyBySku?.(normalized.sku, existingCombination?.id || null, connection) || null;
    if (skuOwner && !skuOwner.deleted_at) {
      if (single) throw new AppError("Variant SKU already exists.", 409, "VARIANT_SKU_EXISTS");
      return { action: "failed", message: "SKU đang được dùng bởi biến thể khác." };
    }

    if (existingCombination?.deleted_at) {
      const restored = await this.repository.restore(existingCombination.id, { ...normalized, sold: Number(existingCombination.sold || normalized.sold || 0) }, connection);
      return { action: "restored", variant: restored.toJSON() };
    }

    if (skuOwner?.deleted_at) {
      const restored = await this.repository.restore(skuOwner.id, { ...normalized, sold: Number(skuOwner.sold || normalized.sold || 0) }, connection);
      return { action: "restored", variant: restored.toJSON() };
    }

    try {
      const created = await this.repository.create(normalized, connection);
      return { action: "created", variant: created.toJSON() };
    } catch (error) {
      throw this.mapDuplicateVariantError(error, normalized);
    }
  }

  async update(productId, variantId, payload) {
    return this.updateVariant(productId, variantId, payload);
  }

  async updateVariant(productId, variantId, payload) {
    await this.ensureProduct(productId);
    const current = await this.ensureVariant(productId, variantId);
    const normalized = this.normalize(productId, payload, current.toJSON());
    await this.ensureUniqueSku(normalized.sku, variantId);
    await this.ensureUniqueCombination(productId, normalized.color, normalized.size, variantId);

    try {
      const variant = await this.repository.update(variantId, normalized);
      await this.repository.syncProductInventory(productId);
      return variant.toJSON();
    } catch (error) {
      throw this.mapDuplicateVariantError(error, normalized);
    }
  }

  async updateVariantStock(productId, variantId, payload) {
    await this.ensureProduct(productId);
    const current = await this.ensureVariant(productId, variantId);
    const hasStock = Object.prototype.hasOwnProperty.call(payload, "stock");
    const hasAdjustment = Object.prototype.hasOwnProperty.call(payload, "adjustment");
    let nextStock;

    if (hasStock) {
      nextStock = Number(payload.stock);
    } else if (hasAdjustment) {
      nextStock = Number(current.stock) + Number(payload.adjustment);
    } else {
      throw new AppError("Variant stock is required.", 422, "VARIANT_STOCK_REQUIRED");
    }

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      throw new AppError("Variant stock cannot be negative.", 422, "INVALID_VARIANT_STOCK");
    }

    const updated = await this.repository.updateStock(variantId, { stock: nextStock });
    await this.repository.syncProductInventory(productId);
    return { id: Number(variantId), stock: nextStock, updated: updated };
  }

  async updateVariantStatus(productId, variantId, status) {
    await this.ensureProduct(productId);
    await this.ensureVariant(productId, variantId);
    const normalizedStatus = String(status || "active").toLowerCase();
    if (!STATUSES.includes(normalizedStatus)) {
      throw new AppError("Variant status is invalid.", 422, "INVALID_VARIANT_STATUS");
    }
    const updated = await this.repository.updateStatus(variantId, normalizedStatus);
    await this.repository.syncProductInventory(productId);
    return { id: Number(variantId), status: normalizedStatus, updated };
  }

  async remove(productId, variantId) {
    return this.deleteVariant(productId, variantId);
  }

  async deleteVariant(productId, variantId) {
    await this.ensureVariant(productId, variantId);
    if (!await this.repository.softDelete(variantId)) throw new AppError("Variant could not be deleted.", 409, "VARIANT_DELETE_FAILED");
    await this.repository.syncProductInventory(productId);
    return { id: Number(variantId), deleted: true };
  }

  async deleteAllVariants(productId) {
    await this.ensureProduct(productId);
    const normalizedProductId = Number(productId);

    return databaseClient.withTransaction(async (connection) => {
      const variants = await this.repository.findByProductId(normalizedProductId, { connection, forUpdate: true });
      if (!variants.length) throw new AppError("Sản phẩm không có biến thể để xóa.", 404, "PRODUCT_VARIANTS_EMPTY");

      const variantIds = variants.map((variant) => variant.id);
      const orderReferenceCount = await this.repository.countOrderReferencesByVariantIds(variantIds, connection);
      const removedCartItems = await this.repository.deleteCartItemsByVariantIds(variantIds, connection);
      const deletedCount = await this.repository.softDeleteByProductId(normalizedProductId, connection);
      if (deletedCount !== variants.length) throw new AppError("Không thể xóa toàn bộ biến thể. Vui lòng thử lại.", 409, "VARIANT_BULK_DELETE_FAILED");

      await this.repository.syncProductInventory(normalizedProductId, connection);
      return {
        success: true,
        deleted_count: deletedCount,
        deletedCount,
        orderReferenceCount,
        removedCartItems,
        message: "Đã xóa tất cả biến thể."
      };
    });
  }

  normalize(productId, payload, current = {}) {
    const pick = (key) => Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : current[key];
    const price = nullableNumber(pick("price")); const salePrice = nullableNumber(pick("salePrice") ?? payload.sale_price);
    const stock = Number(pick("stock") ?? 0); const sold = Number(pick("sold") ?? 0); const status = String(pick("status") || "active").toLowerCase();
    const sku = String(pick("sku") || "").trim().toUpperCase();
    const size = nullableString(pick("size")); const color = nullableString(pick("color"));
    if (!sku) throw new AppError("Variant SKU is required.", 422, "VARIANT_SKU_REQUIRED");
    if (!size) throw new AppError("Please enter a variant size.", 422, "VARIANT_SIZE_REQUIRED");
    if (!color) throw new AppError("Please enter a variant color.", 422, "VARIANT_COLOR_REQUIRED");
    if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(sold) || sold < 0) throw new AppError("Variant inventory is invalid.", 422, "INVALID_VARIANT_INVENTORY");
    if (price !== null && price < 0 || salePrice !== null && (salePrice < 0 || price !== null && salePrice > price)) throw new AppError("Variant price is invalid.", 422, "INVALID_VARIANT_PRICE");
    if (!STATUSES.includes(status)) throw new AppError("Variant status is invalid.", 422, "INVALID_VARIANT_STATUS");
    const colorCode = nullableString(pick("colorCode") ?? payload.color_code);
    const imageUrl = nullableString(pick("imageUrl") ?? payload.image_url);
    if (colorCode && !/^#[0-9a-f]{6}$/i.test(colorCode)) throw new AppError("Color code must be a valid hex value.", 422, "INVALID_VARIANT_COLOR_CODE");
    if (imageUrl && imageUrl.length > 255) throw new AppError("Variant image URL is too long.", 422, "VARIANT_IMAGE_TOO_LONG");
    return { productId: Number(productId), sku, size, color, colorCode, imageUrl, price, salePrice, stock, sold, status };
  }

  async ensureProduct(id) { const product = await this.productRepository.findById(id); if (!product) throw new AppError("Product was not found.", 404, "PRODUCT_NOT_FOUND"); return product; }
  async ensureVariant(productId, id) { const variant = await this.repository.findById(id); if (!variant || Number(variant.productId) !== Number(productId)) throw new AppError("Product variant was not found.", 404, "VARIANT_NOT_FOUND"); return variant; }
  async ensureUniqueSku(sku, excludedId = null) { if (await this.repository.findBySku(sku, excludedId)) throw new AppError("Variant SKU already exists.", 409, "VARIANT_SKU_EXISTS"); }
  async ensureUniqueCombination(productId, color, size, excludedId = null) { if (await this.repository.findByProductColorSize(productId, color, size, excludedId)) throw new AppError("Variant color/size already exists.", 409, "VARIANT_DUPLICATE_EXISTS"); }

  mapDuplicateVariantError(error, normalized) {
    if (error instanceof AppError) return error;
    const details = normalized ? { sku: normalized.sku, color: normalized.color, size: normalized.size } : null;
    const message = String(error?.message || "").toLowerCase();
    const code = String(error?.code || "").toUpperCase();
    const isDuplicate = code.includes("DUP") || code.includes("ER_DUP") || message.includes("duplicate") || message.includes("unique");

    if (!isDuplicate) throw error;
    return new AppError("Variant already exists for this product.", 409, "VARIANT_DUPLICATE_EXISTS", details);
  }
}


class ProductVariantLike {
  constructor(row = {}) {
    this.row = row;
  }
  toJSON() {
    return {
      id: Number(this.row.id),
      productId: Number(this.row.product_id || this.row.productId),
      sku: this.row.sku,
      size: this.row.size || null,
      color: this.row.color || null,
      colorCode: this.row.color_code || this.row.colorCode || null,
      imageUrl: this.row.image_url || this.row.imageUrl || null,
      price: this.row.price === null ? null : Number(this.row.price),
      salePrice: (this.row.sale_price ?? this.row.salePrice) === null ? null : Number(this.row.sale_price ?? this.row.salePrice),
      stock: Number(this.row.stock || 0),
      sold: Number(this.row.sold || 0),
      status: this.row.status || "active",
      createdAt: this.row.created_at || this.row.createdAt || null,
      updatedAt: this.row.updated_at || this.row.updatedAt || null
    };
  }
}


function createVariantSku(baseSku, color, size) {
  const base = String(baseSku || "SP").trim().toUpperCase().replace(/[^A-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "SP";
  const colorPart = skuPart(color);
  const sizePart = skuPart(size);
  return [base, colorPart, sizePart].filter(Boolean).join("-").slice(0, 120);
}

function skuPart(value) {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/Đ/g, "D").replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function variantCombinationKey(color, size) {
  return `${String(color || "").trim().toLowerCase()}::${String(size || "").trim().toLowerCase()}`;
}
function nullableString(value) { return value === undefined || value === null || value === "" ? null : String(value).trim(); }
function nullableNumber(value) { return value === undefined || value === null || value === "" ? null : Number(value); }
