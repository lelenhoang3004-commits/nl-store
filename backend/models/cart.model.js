/**
 * Cart models.
 * They map cart aggregate rows to API-safe objects for the customer storefront.
 */
import { BaseModel } from "./base.model.js";

export class Cart extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.userId = attributes.userId || attributes.user_id;
    this.status = attributes.status || "active";
    this.items = Array.isArray(attributes.items) ? attributes.items : [];
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    const items = this.items.map((item) => item.toJSON());
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      items,
      totalQuantity,
      subtotal,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export class CartItem extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.cartId = attributes.cartId || attributes.cart_id;
    this.productId = attributes.productId || attributes.product_id;
    this.variantId = attributes.variantId || attributes.variant_id || null;
    this.variantKey = attributes.variantKey || attributes.variant_key;
    this.size = attributes.size || null;
    this.color = attributes.color || null;
    this.productName = attributes.productName || attributes.product_name;
    this.productSku = attributes.productSku || attributes.product_sku;
    this.productImageUrl = attributes.productImageUrl || attributes.product_image_url || null;
    this.unitPrice = Number(attributes.unitPrice || attributes.unit_price || 0);
    this.quantity = Number(attributes.quantity || 0);
    this.totalPrice = Number(attributes.totalPrice || attributes.total_price || 0);
    this.isSelected = Boolean(attributes.isSelected ?? attributes.is_selected ?? true);
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      cartId: this.cartId,
      productId: this.productId,
      variantId: this.variantId,
      variantKey: this.variantKey,
      size: this.size,
      color: this.color,
      productName: this.productName,
      productSku: this.productSku,
      productImageUrl: this.productImageUrl,
      unitPrice: this.unitPrice,
      quantity: this.quantity,
      totalPrice: this.totalPrice,
      isSelected: this.isSelected,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
