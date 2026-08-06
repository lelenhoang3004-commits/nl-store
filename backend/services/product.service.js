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
import { databaseClient } from "../utils/database.util.js";

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
    const { product: productPayload, variants: variantPayloads } = splitCreatePayload(payload);
    const normalizedPayload = await this.normalizePayload(productPayload);
    const normalizedVariants = this.normalizeCreateVariants(variantPayloads, normalizedPayload);

    await this.ensureUniqueProduct(normalizedPayload);
    await this.ensureCategoryExists(normalizedPayload.categoryId);
    await this.ensureUniqueCreateVariants(normalizedVariants);

    const createdProduct = await databaseClient.withTransaction(async (connection) => {
      const productStock = normalizedVariants.length
        ? normalizedVariants.reduce((total, variant) => total + variant.stock, 0)
        : normalizedPayload.stock;
      const product = await this.repository.create({ ...normalizedPayload, stock: productStock }, connection);

      for (const variant of normalizedVariants) {
        await this.variantRepository.create({ ...variant, productId: Number(product.id) }, connection);
      }

      if (normalizedVariants.length) {
        await this.variantRepository.syncProductInventory(Number(product.id), connection);
      }

      return product;
    });

    return this.getProductById(createdProduct.id);
  }

  normalizeCreateVariants(variants = [], productPayload = {}) {
    if (!Array.isArray(variants) || !variants.length) return [];
    if (variants.length > 200) throw new AppError("Variant list is too large.", 400, "VARIANT_BULK_TOO_LARGE");

    const seenCombinations = new Set();
    const seenSkus = new Set();
    return variants.map((variant, index) => {
      const sku = String(variant?.sku || createVariantSku(productPayload.sku, variant?.color, variant?.size)).trim().toUpperCase();
      const color = nullableString(variant?.color);
      const size = nullableString(variant?.size);
      const colorCode = nullableString(variant?.colorCode ?? variant?.color_code);
      const imageUrl = nullableString(variant?.imageUrl ?? variant?.image_url);
      const price = nullableNumber(variant?.price);
      const salePrice = nullableNumber(variant?.salePrice ?? variant?.sale_price);
      const stock = Number(variant?.stock ?? 0);
      const sold = Number(variant?.sold ?? 0);
      const status = String(variant?.status || "active").trim().toLowerCase();
      const effectivePrice = price === null ? Number(productPayload.price) : price;

      if (!sku) throw new AppError(`Variant #${index + 1} SKU is required.`, 422, "VARIANT_SKU_REQUIRED");
      if (!color) throw new AppError(`Variant #${index + 1} color is required.`, 422, "VARIANT_COLOR_REQUIRED");
      if (!size) throw new AppError(`Variant #${index + 1} size is required.`, 422, "VARIANT_SIZE_REQUIRED");
      if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(sold) || sold < 0) throw new AppError("Variant inventory is invalid.", 422, "INVALID_VARIANT_INVENTORY");
      if (price !== null && price < 0) throw new AppError("Variant price is invalid.", 422, "INVALID_VARIANT_PRICE");
      if (salePrice !== null && (salePrice < 0 || salePrice > effectivePrice)) throw new AppError("Variant sale price is invalid.", 422, "INVALID_VARIANT_PRICE");
      if (colorCode && !/^#[0-9a-f]{6}$/i.test(colorCode)) throw new AppError("Color code must be a valid hex value.", 422, "INVALID_VARIANT_COLOR_CODE");
      if (!PRODUCT_STATUSES.includes(status) && status !== "out_of_stock") throw new AppError("Variant status is invalid.", 422, "INVALID_VARIANT_STATUS");
      if (imageUrl && imageUrl.length > 255) throw new AppError("Variant image URL is too long.", 422, "VARIANT_IMAGE_TOO_LONG");

      const combinationKey = `${color.toLowerCase()}::${size.toLowerCase()}`;
      if (seenCombinations.has(combinationKey)) throw new AppError("Variant color/size already exists in payload.", 422, "VARIANT_DUPLICATE_IN_PAYLOAD", { index, color, size });
      if (seenSkus.has(sku)) throw new AppError("Variant SKU is duplicated in payload.", 422, "VARIANT_SKU_DUPLICATED_IN_PAYLOAD", { index, sku });
      seenCombinations.add(combinationKey);
      seenSkus.add(sku);

      return { productId: null, sku, size, color, colorCode, imageUrl, price, salePrice, stock, sold, status: stock > 0 ? status : "out_of_stock" };
    });
  }

  async ensureUniqueCreateVariants(variants = []) {
    for (const variant of variants) {
      const skuOwner = await this.variantRepository.findAnyBySku(variant.sku);
      if (skuOwner && !skuOwner.deleted_at) throw new AppError("Variant SKU already exists.", 409, "VARIANT_SKU_EXISTS", { sku: variant.sku });
    }
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
    const [category, descendantIds] = await Promise.all([
      this.categoryRepository.findById(categoryId, { isCustomer: true }),
      this.categoryRepository.findDescendantIds(categoryId)
    ]);
    if (!category) return;
    options.filter.categoryIds = [categoryId, ...descendantIds];
    options.filter.categoryMatch = {
      name: category.name,
      slug: category.slug
    };
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

function splitCreatePayload(payload = {}) {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && payload.product && typeof payload.product === "object") {
    return { product: payload.product, variants: Array.isArray(payload.variants) ? payload.variants : [] };
  }
  return { product: payload, variants: Array.isArray(payload.variants) ? payload.variants : [] };
}

function nullableString(value) {
  return value === undefined || value === null || value === "" ? null : String(value).trim();
}

function nullableNumber(value) {
  return value === undefined || value === null || value === "" ? null : Number(value);
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