import { BaseModel } from "./base.model.js";

export class Voucher extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.code = attributes.code;
    this.name = attributes.name;
    this.description = attributes.description || "";
    this.discountType = attributes.discountType || attributes.discount_type;
    this.discountValue = Number(attributes.discountValue ?? attributes.discount_value ?? 0);
    this.minOrderAmount = Number(attributes.minOrderAmount ?? attributes.min_order_amount ?? 0);
    this.maxDiscountAmount = attributes.maxDiscountAmount ?? attributes.max_discount_amount ?? null;
    this.quantity = attributes.quantity ?? attributes.usageLimit ?? attributes.usage_limit ?? null;
    this.usedQuantity = Number(attributes.usedQuantity ?? attributes.used_quantity ?? attributes.usedCount ?? attributes.used_count ?? 0);
    this.startsAt = attributes.startsAt || attributes.starts_at || attributes.startDate || attributes.start_date || null;
    this.expiresAt = attributes.expiresAt || attributes.expires_at || attributes.endDate || attributes.end_date || null;
    this.status = attributes.status;
    this.conditions = attributes.conditions || null;
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    const quantity = this.quantity === null || this.quantity === undefined ? null : Number(this.quantity);
    const maxDiscountAmount = this.maxDiscountAmount === null || this.maxDiscountAmount === undefined ? null : Number(this.maxDiscountAmount);

    return {
      id: this.id,
      code: this.code,
      name: this.name,
      description: this.description,
      discountType: this.discountType,
      discount_type: this.discountType,
      discountValue: this.discountValue,
      discount_value: this.discountValue,
      minOrderAmount: this.minOrderAmount,
      min_order_amount: this.minOrderAmount,
      maxDiscountAmount,
      max_discount_amount: maxDiscountAmount,
      quantity,
      usageLimit: quantity,
      usage_limit: quantity,
      usedQuantity: this.usedQuantity,
      used_quantity: this.usedQuantity,
      usedCount: this.usedQuantity,
      used_count: this.usedQuantity,
      startsAt: this.startsAt,
      starts_at: this.startsAt,
      startDate: this.startsAt,
      start_date: this.startsAt,
      expiresAt: this.expiresAt,
      expires_at: this.expiresAt,
      endDate: this.expiresAt,
      end_date: this.expiresAt,
      status: this.status,
      conditions: this.conditions,
      createdAt: this.createdAt,
      created_at: this.createdAt,
      updatedAt: this.updatedAt,
      updated_at: this.updatedAt
    };
  }
}
