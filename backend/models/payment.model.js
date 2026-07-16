/**
 * Payment models.
 * They map payment methods, transactions, and histories to API-safe objects.
 */
import { BaseModel } from "./base.model.js";

export class PaymentMethod extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.code = attributes.code;
    this.name = attributes.name;
    this.provider = attributes.provider;
    this.type = attributes.type;
    this.description = attributes.description || "";
    this.isActive = Boolean(attributes.isActive ?? attributes.is_active);
    this.config = normalizeJson(attributes.config);
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }
}

export class PaymentTransaction extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.orderId = attributes.orderId || attributes.order_id;
    this.orderCode = attributes.orderCode || attributes.order_code || null;
    this.customerName = attributes.customerName || attributes.customer_name || null;
    this.customerEmail = attributes.customerEmail || attributes.customer_email || null;
    this.customerPhone = attributes.customerPhone || attributes.customer_phone || null;
    this.paymentMethodId = attributes.paymentMethodId || attributes.payment_method_id || null;
    this.transactionCode = attributes.transactionCode || attributes.transaction_code;
    this.provider = attributes.provider;
    this.method = attributes.method;
    this.amount = Number(attributes.amount || 0);
    this.currency = attributes.currency || "VND";
    this.status = attributes.status;
    this.paidAt = attributes.paidAt || attributes.paid_at || null;
    this.metadata = normalizeJson(attributes.metadata);
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }
}

export class PaymentHistory extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.transactionId = attributes.transactionId || attributes.transaction_id;
    this.status = attributes.status;
    this.note = attributes.note || "";
    this.changedBy = attributes.changedBy || attributes.changed_by || null;
    this.createdAt = attributes.createdAt || attributes.created_at || null;
  }
}

function normalizeJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
