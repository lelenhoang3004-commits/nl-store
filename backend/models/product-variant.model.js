import { BaseModel } from "./base.model.js";

export class ProductVariant extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = Number(attributes.id);
    this.productId = Number(attributes.productId || attributes.product_id);
    this.sku = attributes.sku;
    this.size = attributes.size || null;
    this.color = attributes.color || null;
    this.colorCode = attributes.colorCode || attributes.color_code || null;
    this.price = attributes.price === null ? null : Number(attributes.price);
    this.salePrice = (attributes.salePrice ?? attributes.sale_price) === null ? null : Number(attributes.salePrice ?? attributes.sale_price);
    this.stock = Number(attributes.stock || 0);
    this.sold = Number(attributes.sold || 0);
    this.status = attributes.status || "active";
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return { id: this.id, productId: this.productId, sku: this.sku, size: this.size, color: this.color,
      colorCode: this.colorCode, price: this.price, salePrice: this.salePrice, stock: this.stock,
      sold: this.sold, status: this.status, createdAt: this.createdAt, updatedAt: this.updatedAt };
  }
}
