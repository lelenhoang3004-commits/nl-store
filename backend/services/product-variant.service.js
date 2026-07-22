import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { NotificationService } from "./notification.service.js";
import { AppError } from "../utils/app-error.util.js";

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
    await this.ensureUniqueSku(normalized.sku);
    await this.ensureUniqueCombination(productId, normalized.color, normalized.size);

    try {
      const variant = await this.repository.create(normalized);
      await this.repository.syncProductInventory(productId);
      await this.notificationService.notifyWishlistCustomers(productId, {
        type: "WISHLIST_NEW_VARIANT",
        title: "Sản phẩm yêu thích có mẫu mới",
        message: "Một sản phẩm trong danh sách yêu thích của bạn vừa có mẫu mới.",
        link: `#product-detail/${productId}`,
        relatedId: productId,
        eventKey: `wishlist-new-variant:${productId}:${variant.id}`
      });
      return variant.toJSON();
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
    if (colorCode && !/^#[0-9a-f]{6}$/i.test(colorCode)) throw new AppError("Color code must be a valid hex value.", 422, "INVALID_VARIANT_COLOR_CODE");
    return { productId: Number(productId), sku, size, color, colorCode, price, salePrice, stock, sold, status };
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

function nullableString(value) { return value === undefined || value === null || value === "" ? null : String(value).trim(); }
function nullableNumber(value) { return value === undefined || value === null || value === "" ? null : Number(value); }
