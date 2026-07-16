/**
 * Order model.
 * It maps order aggregate rows to API-safe objects with details, history, and transactions.
 */
import { BaseModel } from "./base.model.js";

export class Order extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.orderCode = attributes.orderCode || attributes.order_code;
    this.customerId = attributes.customerId || attributes.customer_id || null;
    this.customerName = attributes.customerName || attributes.customer_name || "";
    this.customerEmail = attributes.customerEmail || attributes.customer_email || "";
    this.customerPhone = attributes.customerPhone || attributes.customer_phone || "";
    this.shippingAddress = normalizeJson(attributes.shippingAddress || attributes.shipping_address);
    this.status = attributes.status;
    this.paymentStatus = attributes.paymentStatus || attributes.payment_status;
    this.paymentMethod = attributes.paymentMethod || attributes.payment_method || null;
    this.subtotal = Number(attributes.subtotal || 0);
    this.discountTotal = Number(attributes.discountTotal || attributes.discount_total || 0);
    this.shippingFee = Number(attributes.shippingFee || attributes.shipping_fee || 0);
    this.taxTotal = Number(attributes.taxTotal || attributes.tax_total || 0);
    this.grandTotal = Number(attributes.grandTotal || attributes.grand_total || 0);
    this.paidAmount = Number(attributes.paidAmount || attributes.paid_amount || 0);
    this.note = attributes.note || "";
    this.items = attributes.items || [];
    this.history = attributes.history || [];
    this.transactions = attributes.transactions || [];
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      orderCode: this.orderCode,
      customerId: this.customerId,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      shippingAddress: this.shippingAddress,
      status: this.status,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      subtotal: this.subtotal,
      discountTotal: this.discountTotal,
      shippingFee: this.shippingFee,
      taxTotal: this.taxTotal,
      grandTotal: this.grandTotal,
      paidAmount: this.paidAmount,
      note: this.note,
      items: this.items,
      history: this.history,
      transactions: this.transactions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export class OrderDetail extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.orderId = attributes.orderId || attributes.order_id;
    this.productId = attributes.productId || attributes.product_id || null;
    this.productName = attributes.productName || attributes.product_name;
    this.productSku = attributes.productSku || attributes.product_sku;
    this.productImageUrl = attributes.productImageUrl || attributes.product_image_url || null;
    this.quantity = Number(attributes.quantity || 0);
    this.unitPrice = Number(attributes.unitPrice || attributes.unit_price || 0);
    this.discountAmount = Number(attributes.discountAmount || attributes.discount_amount || 0);
    this.totalPrice = Number(attributes.totalPrice || attributes.total_price || 0);
  }

  toJSON() {
    return { ...this };
  }
}

export class OrderHistory extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.orderId = attributes.orderId || attributes.order_id;
    this.status = attributes.status;
    this.note = attributes.note || "";
    this.changedBy = attributes.changedBy || attributes.changed_by || null;
    this.createdAt = attributes.createdAt || attributes.created_at || null;
  }

  toJSON() {
    return { ...this };
  }
}

export class OrderTransaction extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.orderId = attributes.orderId || attributes.order_id;
    this.transactionCode = attributes.transactionCode || attributes.transaction_code;
    this.provider = attributes.provider;
    this.method = attributes.method;
    this.amount = Number(attributes.amount || 0);
    this.status = attributes.status;
    this.paidAt = attributes.paidAt || attributes.paid_at || null;
    this.metadata = normalizeJson(attributes.metadata);
    this.createdAt = attributes.createdAt || attributes.created_at || null;
  }

  toJSON() {
    return { ...this };
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
