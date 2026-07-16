import { CategoryRepository } from "../repositories/category.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { createSlug } from "../utils/slug.util.js";

const PRODUCT_STATUSES = ["active", "inactive", "out_of_stock"];
const QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "name", "sku", "price", "salePrice", "stock", "sold", "status"],
  allowedFilterFields: ["categoryId", "status", "brand", "lowStock", "stockStatus"]
});

export class AdminProductService {
  constructor(repository = new ProductRepository(), categoryRepository = new CategoryRepository(), variantRepository = new ProductVariantRepository()) {
    this.repository = repository;
    this.categoryRepository = categoryRepository;
    this.variantRepository = variantRepository;
  }

  async listProducts(query = {}) {
    const options = parseQueryOptions(query, QUERY_OPTIONS);
    const [products, totalItems] = await Promise.all([
      this.repository.findAll(options),
      this.repository.countAll(options)
    ]);
    const pagination = createPaginationMeta(options.pagination, totalItems);
    const items = products.map((product) => product.toJSON());
    const variants = await this.variantRepository.findByProductIds(items.map((item) => item.id));
    return {
      items: items.map((item) => ({ ...item, variantCount: (variants.get(Number(item.id)) || []).length })),
      pagination,
      meta: { pagination, search: options.search, sort: options.sort, filter: options.filter }
    };
  }

  async getProductById(id) {
    const product = await this.repository.findById(id);
    if (!product) throw new AppError("Product was not found.", 404, "PRODUCT_NOT_FOUND");
    const variants = await this.variantRepository.findByProductId(id);
    return { ...product.toJSON(), variants: variants.map((item) => item.toJSON()), variantCount: variants.length };
  }

  async createProduct(payload) {
    const normalized = this.normalizePayload(payload);
    await this.ensureUnique(normalized);
    await this.ensureCategoryExists(normalized.categoryId);
    return (await this.repository.create(normalized)).toJSON();
  }

  async updateProduct(id, payload) {
    const current = await this.getProductById(id);
    const normalized = this.normalizePayload(payload, current);
    await this.ensureUnique(normalized, id);
    await this.ensureCategoryExists(normalized.categoryId);
    return (await this.repository.update(id, normalized)).toJSON();
  }

  async updateStock(id, payload) {
    const current = await this.getProductById(id);
    const stock = has(payload, "stock")
      ? Number(payload.stock)
      : Number(current.stock) + Number(payload.adjustment);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new AppError("Product stock cannot be negative.", 422, "INVALID_PRODUCT_STOCK");
    }
    return (await this.repository.updateStock(id, stock)).toJSON();
  }

  async updateStatus(id, status) {
    await this.getProductById(id);
    const normalizedStatus = String(status || "").trim().toLowerCase();
    if (!PRODUCT_STATUSES.includes(normalizedStatus)) {
      throw new AppError("Product status is invalid.", 422, "INVALID_PRODUCT_STATUS");
    }
    return (await this.repository.updateStatus(id, normalizedStatus)).toJSON();
  }

  async deleteProduct(id) {
    await this.getProductById(id);
    const deleted = await this.repository.softDelete(id);
    if (!deleted) throw new AppError("Product could not be deleted.", 409, "PRODUCT_DELETE_FAILED");
    return { id: Number(id), deleted: true };
  }

  normalizePayload(payload, current = {}) {
    const value = (camel, snake = camel) => has(payload, camel)
      ? payload[camel]
      : has(payload, snake)
        ? payload[snake]
        : current[camel];
    const name = String(value("name") || "").trim();
    const sku = String(value("sku") || "").trim().toUpperCase();
    const requestedSlug = value("slug");
    const price = Number(value("price") ?? 0);
    const rawSalePrice = value("salePrice", "sale_price");
    const salePrice = rawSalePrice === undefined || rawSalePrice === null || rawSalePrice === "" ? null : Number(rawSalePrice);
    const stock = Number(value("stock") ?? 0);
    const status = String(value("status") || "active").trim().toLowerCase();

    if (!name || !sku) throw new AppError("Product name and SKU are required.", 422, "PRODUCT_REQUIRED_FIELDS");
    if (!Number.isFinite(price) || price < 0) throw new AppError("Product price is invalid.", 422, "INVALID_PRODUCT_PRICE");
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price)) {
      throw new AppError("Sale price must be between zero and price.", 422, "INVALID_PRODUCT_SALE_PRICE");
    }
    if (!Number.isInteger(stock) || stock < 0) throw new AppError("Product stock is invalid.", 422, "INVALID_PRODUCT_STOCK");
    if (!PRODUCT_STATUSES.includes(status)) throw new AppError("Product status is invalid.", 422, "INVALID_PRODUCT_STATUS");

    return {
      name,
      slug: requestedSlug ? createSlug(requestedSlug) : createSlug(name),
      sku,
      categoryId: nullableNumber(value("categoryId", "category_id")),
      brand: nullableString(value("brand")),
      shortDescription: nullableString(value("shortDescription", "short_description")),
      description: nullableString(value("description")),
      price,
      salePrice,
      stock,
      sold: Number(value("sold") ?? 0),
      status,
      thumbnailUrl: nullableString(value("thumbnailUrl", "thumbnail_url")),
      galleryUrls: normalizeArray(value("galleryUrls", "gallery_urls")),
      tags: normalizeArray(value("tags")),
      productAttributes: normalizeProductAttributes(value("productAttributes", "product_attributes"))
    };
  }

  async ensureUnique(payload, excludedId = null) {
    const [slug, sku] = await Promise.all([
      this.repository.findBySlug(payload.slug, excludedId),
      this.repository.findBySku(payload.sku, excludedId)
    ]);
    if (sku) throw new AppError("Product SKU already exists.", 409, "PRODUCT_SKU_EXISTS");
    if (slug) throw new AppError("Product slug already exists.", 409, "PRODUCT_SLUG_EXISTS");
  }

  async ensureCategoryExists(categoryId) {
    if (!categoryId) return;
    if (!await this.categoryRepository.findById(categoryId)) {
      throw new AppError("Category was not found.", 422, "PRODUCT_CATEGORY_NOT_FOUND");
    }
  }
}

function has(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
const PRODUCT_ATTRIBUTE_KEYS = ["material", "chain_length", "pendant_type", "stone_color", "pendant_size", "warranty"];
function normalizeProductAttributes(value) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { value = {}; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(PRODUCT_ATTRIBUTE_KEYS.map((key) => [key, nullableString(value[key])]).filter(([, item]) => item !== null));
}
function nullableString(value) { return value === undefined || value === null || value === "" ? null : String(value).trim(); }
function nullableNumber(value) { return value === undefined || value === null || value === "" ? null : Number(value); }
function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean); } catch {}
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
