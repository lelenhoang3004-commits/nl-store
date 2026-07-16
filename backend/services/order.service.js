/**
 * Order service.
 * It owns order totals, status transitions, history records, payment transactions, and transaction boundaries.
 */
import crypto from "node:crypto";
import { OrderRepository } from "../repositories/order.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { withTransaction } from "../utils/database.util.js";

const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded"
});

const PAYMENT_STATUS = Object.freeze({
  UNPAID: "unpaid",
  PARTIAL: "partial",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded"
});

const TRANSACTION_STATUS = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded"
});

const ORDER_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "orderCode", "status", "paymentStatus", "grandTotal", "paidAmount"],
  allowedFilterFields: ["status", "paymentStatus", "paymentMethod", "customerId", "dateFrom", "dateTo"]
});

const STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: []
});

export class OrderService extends BaseService {
  constructor(repository = new OrderRepository()) {
    super(repository);
  }

  async getOrders(query) {
    const options = parseQueryOptions(query, ORDER_QUERY_OPTIONS);
    const [orders, totalItems] = await Promise.all([
      this.repository.findAll(options),
      this.repository.countAll(options)
    ]);

    return {
      orders: orders.map((order) => order.toJSON()),
      meta: {
        pagination: createPaginationMeta(options.pagination, totalItems),
        search: options.search,
        sort: options.sort,
        filter: options.filter
      }
    };
  }

  async getCustomerOrders(customerId, query) {
    const scopedQuery = {
      ...query,
      customerId
    };

    return this.getOrders(scopedQuery);
  }

  async getOrderById(id) {
    const order = await this.repository.findById(id);

    if (!order) {
      throw new AppError("Order was not found.", 404, "ORDER_NOT_FOUND");
    }

    return order.toJSON();
  }

  async getCustomerOrderById(id, customerId) {
    const order = await this.getOrderById(id);

    if (String(order.customerId) !== String(customerId)) {
      throw new AppError("Order was not found.", 404, "ORDER_NOT_FOUND");
    }

    return order;
  }

  async getOrderDetails(id) {
    await this.getOrderById(id);
    const details = await this.repository.findDetailsByOrderId(id);

    return details.map((detail) => detail.toJSON());
  }

  async getOrderHistory(id) {
    await this.getOrderById(id);
    const history = await this.repository.findHistoryByOrderId(id);

    return history.map((item) => item.toJSON());
  }

  async getOrderTransactions(id) {
    await this.getOrderById(id);
    const transactions = await this.repository.findTransactionsByOrderId(id);

    return transactions.map((transaction) => transaction.toJSON());
  }

  async createOrder(payload, currentUserId, options = {}) {
    const normalizedPayload = this.normalizeOrderPayload(payload, {
      customerId: options.usePayloadCustomerId ? payload.customerId : currentUserId
    });

    const orderId = await withTransaction(async (connection) => {
      const createdOrderId = await this.repository.create(normalizedPayload, connection);

      await this.repository.createDetails(createdOrderId, normalizedPayload.items, connection);
      await this.repository.addHistory(createdOrderId, {
        status: normalizedPayload.status,
        note: "Order created.",
        changedBy: currentUserId
      }, connection);

      return createdOrderId;
    });

    return this.getOrderById(orderId);
  }

  async updateOrderStatus(id, payload, currentUserId) {
    const order = await this.getOrderById(id);
    const nextStatus = payload.status;

    this.ensureStatusTransition(order.status, nextStatus);

    await withTransaction(async (connection) => {
      await this.repository.updateStatus(id, { status: nextStatus }, connection);
      await this.repository.addHistory(id, {
        status: nextStatus,
        note: payload.note || null,
        changedBy: currentUserId
      }, connection);
    });

    return this.getOrderById(id);
  }

  async addPaymentTransaction(id, payload, currentUserId) {
    const order = await this.getOrderById(id);
    const normalizedTransaction = this.normalizeTransactionPayload(payload);
    const paidAmount = this.calculatePaidAmount(order, normalizedTransaction);
    const paymentStatus = this.resolvePaymentStatus(order.grandTotal, paidAmount, normalizedTransaction.status);

    await withTransaction(async (connection) => {
      await this.repository.createTransaction(id, normalizedTransaction, connection);
      await this.repository.updatePaymentSummary(id, {
        paymentStatus,
        paymentMethod: normalizedTransaction.method,
        paidAmount
      }, connection);
      await this.repository.addHistory(id, {
        status: order.status,
        note: `Payment transaction ${normalizedTransaction.status}.`,
        changedBy: currentUserId
      }, connection);
    });

    return this.getOrderById(id);
  }

  async deleteOrder(id) {
    await this.getOrderById(id);

    const deleted = await this.repository.softDelete(id);

    if (!deleted) {
      throw new AppError("Order could not be deleted.", 409, "ORDER_DELETE_FAILED");
    }

    return {
      id,
      deleted: true
    };
  }

  normalizeOrderPayload(payload, options = {}) {
    const items = payload.items.map((item) => normalizeOrderItem(item));
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountTotal = Number(payload.discountTotal || 0);
    const shippingFee = Number(payload.shippingFee || 0);
    const taxTotal = Number(payload.taxTotal || 0);
    const grandTotal = Math.max(subtotal - discountTotal + shippingFee + taxTotal, 0);

    return {
      orderCode: payload.orderCode || createOrderCode(),
      customerId: options.customerId || payload.customerId || null,
      customerName: String(payload.customerName).trim(),
      customerEmail: String(payload.customerEmail).trim().toLowerCase(),
      customerPhone: String(payload.customerPhone).trim(),
      shippingAddress: normalizeShippingAddress(payload.shippingAddress),
      status: payload.status || ORDER_STATUS.PENDING,
      paymentStatus: payload.paymentStatus || PAYMENT_STATUS.UNPAID,
      paymentMethod: payload.paymentMethod || null,
      subtotal,
      discountTotal,
      shippingFee,
      taxTotal,
      grandTotal,
      paidAmount: Number(payload.paidAmount || 0),
      note: payload.note ? String(payload.note).trim() : null,
      items
    };
  }

  normalizeTransactionPayload(payload) {
    return {
      transactionCode: payload.transactionCode || createTransactionCode(),
      provider: String(payload.provider).trim(),
      method: String(payload.method).trim(),
      amount: Number(payload.amount),
      status: payload.status || TRANSACTION_STATUS.PENDING,
      paidAt: payload.paidAt || (payload.status === TRANSACTION_STATUS.SUCCESS ? new Date() : null),
      metadata: payload.metadata || null
    };
  }

  ensureStatusTransition(currentStatus, nextStatus) {
    const allowedStatuses = STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedStatuses.includes(nextStatus)) {
      throw new AppError("Order status transition is not allowed.", 409, "ORDER_STATUS_TRANSITION_NOT_ALLOWED", {
        currentStatus,
        nextStatus,
        allowedStatuses
      });
    }
  }

  calculatePaidAmount(order, transaction) {
    if (transaction.status === TRANSACTION_STATUS.SUCCESS) {
      return Math.min(Number(order.paidAmount || 0) + transaction.amount, Number(order.grandTotal || 0));
    }

    if (transaction.status === TRANSACTION_STATUS.REFUNDED) {
      return Math.max(Number(order.paidAmount || 0) - transaction.amount, 0);
    }

    return Number(order.paidAmount || 0);
  }

  resolvePaymentStatus(grandTotal, paidAmount, transactionStatus) {
    if (transactionStatus === TRANSACTION_STATUS.FAILED) {
      return PAYMENT_STATUS.FAILED;
    }

    if (transactionStatus === TRANSACTION_STATUS.REFUNDED) {
      return paidAmount === 0 ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIAL;
    }

    if (paidAmount <= 0) {
      return PAYMENT_STATUS.UNPAID;
    }

    return paidAmount >= grandTotal ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIAL;
  }
}

function normalizeOrderItem(item) {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const discountAmount = Number(item.discountAmount || 0);

  return {
    productId: item.productId || null,
    productName: String(item.productName).trim(),
    productSku: String(item.productSku).trim(),
    productImageUrl: item.productImageUrl ? String(item.productImageUrl).trim() : null,
    quantity,
    unitPrice,
    discountAmount,
    totalPrice: Math.max(quantity * unitPrice - discountAmount, 0)
  };
}

function normalizeShippingAddress(address = {}) {
  const detailAddress = address.detail_address || address.detailAddress || address.line1 || null;
  const provinceName = address.province_name || address.province || address.city || null;
  const wardName = address.ward_name || address.ward || null;

  return {
    fullName: address.fullName ? String(address.fullName).trim() : address.receiver_name ? String(address.receiver_name).trim() : null,
    phone: address.phone ? String(address.phone).trim() : address.receiver_phone ? String(address.receiver_phone).trim() : null,
    line1: detailAddress ? String(detailAddress).trim() : null,
    line2: address.line2 ? String(address.line2).trim() : null,
    ward: wardName ? String(wardName).trim() : null,
    city: provinceName ? String(provinceName).trim() : null,
    province: provinceName ? String(provinceName).trim() : null,
    country: address.country ? String(address.country).trim() : "Vietnam",
    postalCode: address.postalCode ? String(address.postalCode).trim() : null,
    detail_address: detailAddress ? String(detailAddress).trim() : null,
    province_code: address.province_code ? String(address.province_code).trim() : null,
    province_name: provinceName ? String(provinceName).trim() : null,
    ward_code: address.ward_code ? String(address.ward_code).trim() : null,
    ward_name: wardName ? String(wardName).trim() : null,
    full_address: address.full_address ? String(address.full_address).trim() : null
  };
}

function createOrderCode() {
  return `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function createTransactionCode() {
  return `TRX-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export { ORDER_STATUS, PAYMENT_STATUS, TRANSACTION_STATUS };
