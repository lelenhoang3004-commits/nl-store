/**
 * Product model.
 * It maps product database rows to API-safe product objects.
 */
import { BaseModel } from "./base.model.js";

export class Product extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.name = attributes.name;
    this.slug = attributes.slug;
    this.sku = attributes.sku;
    this.categoryId = attributes.categoryId || attributes.category_id || null;
    this.categoryName = attributes.categoryName || attributes.category_name || null;
    this.brand = attributes.brand || "";
    this.shortDescription = attributes.shortDescription || attributes.short_description || "";
    this.description = attributes.description || "";
    this.price = Number(attributes.price || 0);
    this.salePrice = attributes.salePrice ?? attributes.sale_price ?? null;
    this.stock = Number(attributes.stock || 0);
    this.sold = Number(attributes.sold || 0);
    this.ratingAverage = attributes.ratingAverage ?? attributes.rating_average ?? attributes.rating ?? null;
    this.ratingCount = Number(attributes.ratingCount ?? attributes.rating_count ?? 0);
    this.status = attributes.status;
    this.thumbnailUrl = attributes.thumbnailUrl || attributes.thumbnail_url || null;
    this.galleryUrls = normalizeJsonArray(attributes.galleryUrls || attributes.gallery_urls);
    this.tags = normalizeJsonArray(attributes.tags);
    this.productAttributes = normalizeJsonObject(attributes.productAttributes || attributes.product_attributes);
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      sku: this.sku,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      brand: this.brand,
      shortDescription: this.shortDescription,
      description: this.description,
      price: this.price,
      salePrice: this.salePrice === null ? null : Number(this.salePrice),
      stock: this.stock,
      sold: this.sold,
      ratingAverage: this.ratingAverage === null ? null : Number(this.ratingAverage),
      rating_average: this.ratingAverage === null ? null : Number(this.ratingAverage),
      rating: this.ratingAverage === null ? null : Number(this.ratingAverage),
      ratingCount: this.ratingCount,
      rating_count: this.ratingCount,
      status: this.status,
      thumbnailUrl: this.thumbnailUrl,
      galleryUrls: this.galleryUrls,
      tags: this.tags,
      productAttributes: this.productAttributes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

function normalizeJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (!value) return {};
  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue) ? parsedValue : {};
  } catch {
    return {};
  }
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
}
