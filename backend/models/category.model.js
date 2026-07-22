/**
 * Category model.
 * It maps database rows to API-safe category objects.
 */
import { BaseModel } from "./base.model.js";

export class Category extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.name = attributes.name;
    this.slug = attributes.slug;
    this.description = attributes.description || "";
    this.parentId = attributes.parentId || attributes.parent_id || null;
    this.imageUrl = attributes.imageUrl || attributes.resolved_image_url || attributes.image_url || null;
    this.configuredImageUrl = attributes.configuredImageUrl || attributes.image_url || null;
    this.status = attributes.status;
    this.sortOrder = attributes.sortOrder ?? attributes.sort_order ?? 0;
    this.productCount = attributes.productCount ?? attributes.product_count ?? 0;
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      parentId: this.parentId,
      imageUrl: this.imageUrl,
      image_url: this.imageUrl,
      configuredImageUrl: this.configuredImageUrl,
      status: this.status,
      sortOrder: this.sortOrder,
      productCount: this.productCount,
      product_count: this.productCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
