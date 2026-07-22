import { CategoryRepository } from "../repositories/category.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { createSlug } from "../utils/slug.util.js";

const PRODUCT_STATUSES = ["active", "inactive", "out_of_stock"];
const LEGACY_UPLOAD_LOST_MESSAGE = "Ảnh cũ đã mất, vui lòng tải lại ảnh.";
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
    await this.expandCategoryFilter(options);
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
    await this.ensureProductImageUrls(normalized);
    return (await this.repository.create(normalized)).toJSON();
  }

  async updateProduct(id, payload) {
    const current = await this.getProductById(id);
    const normalized = this.normalizePayload(payload, current);
    logger.info("AdminProductService.updateProduct normalized payload.", { productId: id, ratingAverage: normalized.ratingAverage, ratingCount: normalized.ratingCount });
    await this.ensureUnique(normalized, id);
    await this.ensureCategoryExists(normalized.categoryId);
    await this.ensureProductImageUrls(normalized, current);
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
    const ratingCountProvided = has(payload, "ratingCount") || has(payload, "rating_count");
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
    const rawRatingAverage = value("ratingAverage", "rating_average");
    const ratingAverage = rawRatingAverage === undefined || rawRatingAverage === null || rawRatingAverage === "" ? null : Number(rawRatingAverage);
    const ratingCount = Number(value("ratingCount", "rating_count") ?? 0);
    const status = String(value("status") || "active").trim().toLowerCase();

    if (!name || !sku) throw new AppError("Product name and SKU are required.", 422, "PRODUCT_REQUIRED_FIELDS");
    if (!Number.isFinite(price) || price < 0) throw new AppError("Product price is invalid.", 422, "INVALID_PRODUCT_PRICE");
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price)) {
      throw new AppError("Sale price must be between zero and price.", 422, "INVALID_PRODUCT_SALE_PRICE");
    }
    if (!Number.isInteger(stock) || stock < 0) throw new AppError("Product stock is invalid.", 422, "INVALID_PRODUCT_STOCK");
    if (ratingAverage !== null && (!Number.isFinite(ratingAverage) || ratingAverage < 0 || ratingAverage > 5 || Math.round(ratingAverage * 10) !== ratingAverage * 10)) {
      throw new AppError("Product rating must be between 0 and 5 with one decimal place.", 422, "INVALID_PRODUCT_RATING");
    }
    if (!Number.isInteger(ratingCount) || ratingCount < 0) throw new AppError("Product rating count is invalid.", 422, "INVALID_PRODUCT_RATING_COUNT");
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
      ratingAverage: ratingAverage !== null ? Number(ratingAverage.toFixed(1)) : null,
      ratingCount,
      ratingCountProvided,
      status,
      thumbnailUrl: nullableString(value("thumbnailUrl", "thumbnail_url")),
      galleryUrls: normalizeArray(value("galleryUrls", "gallery_urls")),
      tags: normalizeArray(value("tags")),
      productAttributes: normalizeProductAttributes(value("productAttributes", "product_attributes"))
    };
  }


  async ensureProductImageUrls(payload, current = null) {
    payload.thumbnailUrl = normalizeProductImageUrl(payload.thumbnailUrl);
    payload.galleryUrls = (payload.galleryUrls || []).map(normalizeProductImageUrl).filter(Boolean);

    const originalThumbnailUrl = normalizeProductImageUrl(current?.thumbnailUrl || current?.thumbnail_url);
    const originalGalleryUrls = normalizeArray(current?.galleryUrls || current?.gallery_urls).map(normalizeProductImageUrl).filter(Boolean);
    const selectedNewMainImage = Boolean(payload.thumbnailUrl && payload.thumbnailUrl !== originalThumbnailUrl);

    logger.info("Admin product image URLs normalized.", {
      thumbnail_url: payload.thumbnailUrl,
      gallery_urls: payload.galleryUrls,
      original_thumbnail_url: originalThumbnailUrl,
      selected_new_main_image: selectedNewMainImage
    });

    const urlsToCheck = [
      payload.thumbnailUrl ? { field: "thumbnail_url", url: payload.thumbnailUrl, isNewMainImage: selectedNewMainImage } : null,
      ...payload.galleryUrls.map((url, index) => ({ field: `gallery_urls[${index}]`, url, isNewMainImage: false }))
    ].filter((item) => item && shouldCheckImageUrl(item.url));

    const unreachableUrls = [];
    for (const item of urlsToCheck) {
      if (!await imageUrlExists(item.url)) {
        logger.warn("Admin product image URL is not reachable.", { field: item.field, url: item.url, productId: current?.id || null });
        unreachableUrls.push(item);
      }
    }

    const lostLegacyImage = unreachableUrls.find((item) => isLegacyUploadUrl(item.url));
    if (lostLegacyImage) {
      throw new AppError(LEGACY_UPLOAD_LOST_MESSAGE, 422, "OLD_PRODUCT_IMAGE_LOST", { field: lostLegacyImage.field, url: lostLegacyImage.url });
    }

    const selectedMainImageError = unreachableUrls.find((item) => item.field === "thumbnail_url" && item.isNewMainImage);
    if (selectedMainImageError) {
      throw new AppError("Ảnh sản phẩm hiện không truy cập được. Vui lòng tải lại ảnh hoặc chọn một ảnh hợp lệ.", 422, "PRODUCT_IMAGE_URL_UNREACHABLE", { field: selectedMainImageError.field, url: selectedMainImageError.url });
    }

    if (selectedNewMainImage && unreachableUrls.length) {
      const unreachableGalleryUrls = new Set(unreachableUrls.filter((item) => item.field.startsWith("gallery_urls")).map((item) => item.url));
      const originalGallerySet = new Set(originalGalleryUrls);
      payload.galleryUrls = payload.galleryUrls.filter((url) => !(unreachableGalleryUrls.has(url) && originalGallerySet.has(url)));
    }
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

  async expandCategoryFilter(options) {
    const categoryId = Number(options.filter.categoryId);
    if (!Number.isInteger(categoryId) || categoryId < 1) return;
    const descendantIds = await this.categoryRepository.findDescendantIds(categoryId);
    options.filter.categoryIds = [categoryId, ...descendantIds];
  }
}

function normalizeProductImageUrl(value) {
  const url = nullableString(value);
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads") || url.startsWith("uploads")) return url;
  return url;
}

function shouldCheckImageUrl(value) {
  const url = String(value || "");
  if (!url || url.startsWith("data:")) return false;
  return /^https?:\/\//i.test(url) || isLegacyUploadUrl(url);
}

async function imageUrlExists(url) {
  if (isLegacyUploadUrl(url) && !/^https?:\/\//i.test(url)) return false;

  try {
    const headResponse = await fetch(url, { method: "HEAD" });
    if (headResponse.ok) return true;
    if (![403, 405].includes(headResponse.status)) return false;
  } catch {}

  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}
function isLegacyUploadUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.pathname.startsWith("/uploads/");
  } catch {
    const url = String(value || "").trim();
    return url.startsWith("/uploads/") || url.startsWith("uploads/");
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
