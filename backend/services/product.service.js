/**
 * Product service.
 * It owns product business rules such as unique SKU, slug, category validation, and upload payload shaping.
 */
import { CategoryRepository } from "../repositories/category.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { BaseService } from "./base.service.js";
import { UploadService } from "./upload.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { createSlug } from "../utils/slug.util.js";

const PRODUCT_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive"
});

const PRODUCT_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "name", "slug", "sku", "price", "salePrice", "stock", "sold", "status"],
  allowedFilterFields: ["status", "categoryId", "brand", "stockStatus", "priceMin", "priceMax"]
});

export class ProductService extends BaseService {
  constructor(
    repository = new ProductRepository(),
    categoryRepository = new CategoryRepository(),
    uploadService = new UploadService(),
    variantRepository = new ProductVariantRepository()
  ) {
    super(repository);
    this.categoryRepository = categoryRepository;
    this.uploadService = uploadService;
    this.variantRepository = variantRepository;
  }

  async getProducts(query) {
    const options = parseQueryOptions(query, PRODUCT_QUERY_OPTIONS);
    await this.expandCategoryFilter(options);
    const [products, totalItems] = await Promise.all([
      this.repository.findAll(options),
      this.repository.countAll(options)
    ]);

    const productJson = products.map((product) => product.toJSON());
    const variantsByProduct = await this.variantRepository.findByProductIds(productJson.map((product) => product.id), { customerOnly: true });
    return {
      products: productJson.map((product) => attachVariants(product, variantsByProduct.get(Number(product.id)) || [])),
      meta: {
        pagination: createPaginationMeta(options.pagination, totalItems),
        search: options.search,
        sort: options.sort,
        filter: options.filter
      }
    };
  }

  async getProductById(id) {
    const product = await this.repository.findById(id);

    if (!product) {
      throw new AppError("Product was not found.", 404, "PRODUCT_NOT_FOUND");
    }

    const variants = await this.variantRepository.findByProductId(id, { customerOnly: true });
    return attachVariants(product.toJSON(), variants);
  }

  async getPublishedProductById(id) {
    const product = await this.getProductById(id);
    if (product.status !== PRODUCT_STATUS.ACTIVE) {
      throw new AppError("Product was not found.", 404, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  async createProduct(payload) {
    const normalizedPayload = await this.normalizePayload(payload);

    await this.ensureUniqueProduct(normalizedPayload);
    await this.ensureCategoryExists(normalizedPayload.categoryId);

    const product = await this.repository.create(normalizedPayload);
    return product.toJSON();
  }

  async updateProduct(id, payload) {
    await this.getProductById(id);

    const normalizedPayload = await this.normalizePayload(payload);

    await this.ensureUniqueProduct(normalizedPayload, id);
    await this.ensureCategoryExists(normalizedPayload.categoryId);

    const product = await this.repository.update(id, normalizedPayload);
    return product.toJSON();
  }

  async deleteProduct(id) {
    await this.getProductById(id);

    const deleted = await this.repository.softDelete(id);

    if (!deleted) {
      throw new AppError("Product could not be deleted.", 409, "PRODUCT_DELETE_FAILED");
    }

    return {
      id,
      deleted: true
    };
  }

  createUploadedImagesPayload(files = []) {
    return this.uploadService.createUploadedFilesPayload(files, "images");
  }

  async normalizePayload(payload) {
    const name = String(payload.name).trim();
    const sku = String(payload.sku).trim().toUpperCase();
    const slug = payload.slug ? createSlug(payload.slug) : createSlug(name);
    const price = Number(payload.price);
    const salePrice = payload.salePrice === undefined || payload.salePrice === null || payload.salePrice === ""
      ? null
      : Number(payload.salePrice);
    const rawRatingAverage = payload.ratingAverage ?? payload.rating_average;
    const ratingAverage = rawRatingAverage === undefined || rawRatingAverage === null || rawRatingAverage === "" ? 4.8 : Number(rawRatingAverage);
    const ratingCount = Number(payload.ratingCount ?? payload.rating_count ?? 0);

    if (salePrice !== null && salePrice > price) {
      throw new AppError("Sale price must be less than or equal to price.", 422, "SALE_PRICE_GREATER_THAN_PRICE");
    }
    if (!Number.isFinite(ratingAverage) || ratingAverage < 0 || ratingAverage > 5 || Math.round(ratingAverage * 10) !== ratingAverage * 10) {
      throw new AppError("Product rating must be between 0 and 5 with one decimal place.", 422, "INVALID_PRODUCT_RATING");
    }

    return {
      name,
      slug,
      sku,
      categoryId: payload.categoryId || null,
      brand: payload.brand ? String(payload.brand).trim() : null,
      shortDescription: payload.shortDescription ? String(payload.shortDescription).trim() : null,
      description: payload.description ? String(payload.description).trim() : null,
      price,
      salePrice,
      stock: Number(payload.stock || 0),
      sold: Number(payload.sold || 0),
      ratingAverage: Number(ratingAverage.toFixed(1)),
      ratingCount: Number.isInteger(ratingCount) && ratingCount >= 0 ? ratingCount : 0,
      status: payload.status || PRODUCT_STATUS.DRAFT,
      thumbnailUrl: payload.thumbnailUrl ? String(payload.thumbnailUrl).trim() : null,
      galleryUrls: normalizeArray(payload.galleryUrls),
      tags: normalizeArray(payload.tags).map((tag) => String(tag).trim()).filter(Boolean),
      productAttributes: normalizeProductAttributes(payload.productAttributes)
    };
  }

  async ensureUniqueProduct(payload, excludedId = null) {
    const [duplicatedSlug, duplicatedSku] = await Promise.all([
      this.repository.findBySlug(payload.slug, excludedId),
      this.repository.findBySku(payload.sku, excludedId)
    ]);

    if (duplicatedSlug) {
      throw new AppError("Product slug already exists.", 409, "PRODUCT_SLUG_EXISTS");
    }

    if (duplicatedSku) {
      throw new AppError("Product SKU already exists.", 409, "PRODUCT_SKU_EXISTS");
    }
  }

  async ensureCategoryExists(categoryId) {
    if (!categoryId) {
      return;
    }

    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
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

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value);
      return Array.isArray(parsedValue) ? parsedValue : value.split(",").map((item) => item.trim());
    } catch {
      return value.split(",").map((item) => item.trim());
    }
  }

  return [];
}

function normalizeProductAttributes(value) {
  const keys = ["material", "chain_length", "pendant_type", "stone_color", "pendant_size", "warranty"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(keys.map((key) => [key, value[key] == null ? "" : String(value[key]).trim()]).filter(([, item]) => item));
}

export { PRODUCT_STATUS };

function attachVariants(product, variants) {
  const items = variants.map((variant) => variant.toJSON());
  const colors = [...new Map(items.filter((item) => item.color).map((item) => [item.color.toLowerCase(), { name: item.color, code: item.colorCode }])).values()];
  const sizes = [...new Set(items.map((item) => item.size).filter(Boolean))];
  return { ...product, variants: items, colors, sizes, variantCount: items.length };
}
