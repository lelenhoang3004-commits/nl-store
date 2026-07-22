/**
 * Payment service.
 * It owns payment method rules, COD support, transaction lifecycle, history, and order payment summary updates.
 */
import crypto from "node:crypto";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { withTransaction } from "../utils/database.util.js";
import { NotificationService } from "./notification.service.js";

const PAYMENT_METHOD_TYPE = Object.freeze({
  COD: "cod",
  ONLINE: "online",
  BANK_TRANSFER: "bank_transfer"
});

const PAYMENT_PROVIDER = Object.freeze({
  COD: "cod",
  MANUAL: "manual",
  BANK: "bank",
  MOMO: "momo",
  VNPAY: "vnpay",
  PAYPAL: "paypal",
  STRIPE: "stripe"
});

const PAYMENT_TRANSACTION_STATUS = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded"
});

const ORDER_PAYMENT_STATUS = Object.freeze({
  UNPAID: "unpaid",
  PARTIAL: "partial",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded"
});

const METHOD_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "name", "code", "provider", "type"],
  allowedFilterFields: ["provider", "type", "isActive"]
});

const TRANSACTION_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "amount", "status", "paidAt"],
  allowedFilterFields: ["orderId", "paymentMethodId", "provider", "method", "status"]
});

export class PaymentService extends BaseService {
  constructor(repository = new PaymentRepository(), notificationService = new NotificationService()) {
    super(repository);
    this.notificationService = notificationService;
  }

  async getMethods(query) {
    const options = parseQueryOptions(query, METHOD_QUERY_OPTIONS);
    const [methods, totalItems] = await Promise.all([
      this.repository.findMethods(options),
      this.repository.countMethods(options)
    ]);

    return {
      methods: methods.map((method) => method.toJSON()),
      meta: {
        pagination: createPaginationMeta(options.pagination, totalItems),
        search: options.search,
        sort: options.sort,
        filter: options.filter
      }
    };
  }

  async getMethodById(id) {
    const method = await this.repository.findMethodById(id);

    if (!method) {
      throw new AppError("Payment method was not found.", 404, "PAYMENT_METHOD_NOT_FOUND");
    }

    return method.toJSON();
  }

  async createMethod(payload) {
    const normalizedPayload = this.normalizeMethodPayload(payload);
    await this.ensureUniqueMethodCode(normalizedPayload.code);

    const method = await this.repository.createMethod(normalizedPayload);
    return method.toJSON();
  }

  async updateMethod(id, payload) {
    await this.getMethodById(id);
    const normalizedPayload = this.normalizeMethodPayload(payload);
    await this.ensureUniqueMethodCode(normalizedPayload.code, id);

    const method = await this.repository.updateMethod(id, normalizedPayload);
    return method.toJSON();
  }

  async deleteMethod(id) {
    await this.getMethodById(id);
    const deleted = await this.repository.softDeleteMethod(id);

    if (!deleted) {
      throw new AppError("Payment method could not be deleted.", 409, "PAYMENT_METHOD_DELETE_FAILED");
    }

    return { id, deleted: true };
  }

  async getTransactions(query) {
    const options = parseQueryOptions(query, TRANSACTION_QUERY_OPTIONS);
    const [transactions, totalItems] = await Promise.all([
      this.repository.findTransactions(options),
      this.repository.countTransactions(options)
    ]);

    return {
      transactions: transactions.map((transaction) => transaction.toJSON()),
      meta: {
        pagination: createPaginationMeta(options.pagination, totalItems),
        search: options.search,
        sort: options.sort,
        filter: options.filter
      }
    };
  }

  async getTransactionById(id) {
    const transaction = await this.repository.findTransactionById(id);

    if (!transaction) {
      throw new AppError("Payment transaction was not found.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
    }

    return transaction.toJSON();
  }

  async listPayments(query) {
    return this.getTransactions(query);
  }

  async getPaymentById(id) {
    return this.getTransactionById(id);
  }

  async getPaymentByOrder(orderId) {
    const order = await this.repository.findOrderForPayment(orderId);

    if (!order) {
      throw new AppError("Order was not found.", 404, "PAYMENT_ORDER_NOT_FOUND");
    }

    const transaction = await this.repository.findByOrderId(orderId);
    return transaction ? transaction.toJSON() : null;
  }

  async createPayment(payload, changedBy = null) {
    const normalizedMethod = normalizeSupportedMethod(
      payload.paymentMethod ?? payload.payment_method ?? payload.method
    );
    const orderId = Number(payload.orderId ?? payload.order_id);

    const transactionId = await withTransaction(async (connection) => {
      const order = await this.repository.findOrderForPayment(orderId, connection, true);

      if (!order) {
        throw new AppError("Order was not found.", 404, "PAYMENT_ORDER_NOT_FOUND");
      }

      if (order.payment_status === ORDER_PAYMENT_STATUS.PAID) {
        throw new AppError("Paid orders cannot be paid again.", 409, "ORDER_ALREADY_PAID");
      }

      const existingTransaction = await this.repository.findByOrderId(orderId, connection);
      if (existingTransaction) {
        throw new AppError("A payment transaction already exists for this order.", 409, "PAYMENT_TRANSACTION_EXISTS", {
          paymentId: existingTransaction.id
        });
      }

      const amount = payload.amount === undefined || payload.amount === null || payload.amount === ""
        ? Number(order.grand_total)
        : Number(payload.amount);
      this.validateAmount(order, amount);

      const paymentMethod = await this.repository.findPaymentMethodByCode(normalizedMethod, connection);
      const transactionPayload = {
        orderId,
        paymentMethodId: paymentMethod?.id || null,
        transactionCode: payload.transactionCode || payload.transaction_code || createPaymentTransactionCode(),
        provider: normalizedMethod,
        method: normalizedMethod,
        amount,
        currency: String(payload.currency || "VND").toUpperCase(),
        status: PAYMENT_TRANSACTION_STATUS.PENDING,
        paidAt: null,
        metadata: payload.metadata || null
      };

      const createdTransactionId = await this.repository.createTransaction(transactionPayload, connection);
      await this.repository.createHistory({
        transactionId: createdTransactionId,
        status: PAYMENT_TRANSACTION_STATUS.PENDING,
        note: "Payment transaction created.",
        changedBy
      }, connection);
      await this.repository.updateOrderPaymentStatus(orderId, {
        paymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
        paymentMethod: normalizedMethod,
        paidAmount: 0
      }, connection);

      return createdTransactionId;
    });

    return this.getPaymentById(transactionId);
  }

  async updatePaymentStatus(id, status, changedBy = null, options = {}) {
    const normalizedStatus = normalizeTransactionStatus(status);
    const currentTransaction = await this.getPaymentById(id);

    await withTransaction(async (connection) => {
      const order = await this.repository.findOrderForPayment(currentTransaction.orderId, connection, true);

      if (!order) {
        throw new AppError("Order was not found.", 404, "PAYMENT_ORDER_NOT_FOUND");
      }

      const transaction = await this.repository.findById(id, connection);
      if (!transaction) {
        throw new AppError("Payment transaction was not found.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
      }

      if (order.payment_status === ORDER_PAYMENT_STATUS.PAID && normalizedStatus !== PAYMENT_TRANSACTION_STATUS.REFUNDED) {
        throw new AppError("Paid orders can only be moved to refunded status.", 409, "ORDER_ALREADY_PAID");
      }

      const paidAt = normalizedStatus === PAYMENT_TRANSACTION_STATUS.PAID
        ? new Date()
        : transaction.paidAt;

      await this.repository.updateStatus(id, {
        status: normalizedStatus,
        paidAt,
        metadata: options.metadata || transaction.metadata
      }, connection);
      await this.repository.createHistory({
        transactionId: Number(id),
        status: normalizedStatus,
        note: options.note || `Payment status changed to ${normalizedStatus}.`,
        changedBy
      }, connection);
      await this.syncOrderPaymentStatus(transaction, normalizedStatus, connection, order);
      await this.notificationService.notifyAdmin({
        type: "PAYMENT_UPDATED",
        title: normalizedStatus === PAYMENT_TRANSACTION_STATUS.FAILED ? "Thanh toán thất bại" : "Thanh toán đã xác nhận",
        message: `Giao dịch ${transaction.transactionCode || id} chuyển sang ${normalizedStatus}.`, 
        link: "#payments",
        relatedId: id,
        eventKey: `payment-status:${id}:${normalizedStatus}`
      }, connection);
    });

    return this.getPaymentById(id);
  }

  validateAmount(order, amount) {
    const normalizedAmount = Number(amount);
    const grandTotal = Number(order?.grand_total ?? order?.grandTotal ?? 0);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new AppError("Payment amount must be greater than zero.", 422, "INVALID_PAYMENT_AMOUNT");
    }

    if (Math.abs(normalizedAmount - grandTotal) > 0.001) {
      throw new AppError("Payment amount must equal the order grand total.", 422, "PAYMENT_AMOUNT_MISMATCH", {
        grandTotal
      });
    }

    return true;
  }

  async syncOrderPaymentStatus(transaction, status, connection, order = null) {
    const orderSummary = order || await this.repository.findOrderForPayment(transaction.orderId, connection);
    const normalizedStatus = normalizeTransactionStatus(status);
    const paymentStatus = normalizedStatus === PAYMENT_TRANSACTION_STATUS.PENDING
      ? ORDER_PAYMENT_STATUS.UNPAID
      : normalizedStatus;
    const paidAmount = normalizedStatus === PAYMENT_TRANSACTION_STATUS.PAID
      ? Number(orderSummary.grand_total)
      : 0;

    await this.repository.updateOrderPaymentStatus(transaction.orderId, {
      paymentStatus,
      paymentMethod: transaction.method,
      paidAmount
    }, connection);
  }

  async createTransaction(payload, currentUserId) {
    return this.createPayment({
      ...payload,
      orderId: payload.orderId ?? payload.order_id,
      paymentMethod: payload.paymentMethod ?? payload.payment_method ?? payload.method
    }, currentUserId);
  }

  async updateTransactionStatus(id, payload, currentUserId) {
    return this.updatePaymentStatus(id, payload.status, currentUserId, payload);
  }

  async getTransactionHistory(id) {
    await this.getTransactionById(id);
    const history = await this.repository.findHistoriesByTransactionId(id);

    return history.map((item) => item.toJSON());
  }

  normalizeMethodPayload(payload) {
    return {
      code: String(payload.code).trim().toLowerCase(),
      name: String(payload.name).trim(),
      provider: String(payload.provider || PAYMENT_PROVIDER.COD).trim().toLowerCase(),
      type: String(payload.type || PAYMENT_METHOD_TYPE.COD).trim().toLowerCase(),
      description: payload.description ? String(payload.description).trim() : null,
      isActive: payload.isActive !== false,
      config: payload.config || null
    };
  }

  async normalizeTransactionPayload(payload) {
    const method = payload.paymentMethodId
      ? await this.repository.findMethodById(payload.paymentMethodId)
      : null;
    const provider = method?.provider || String(payload.provider || PAYMENT_PROVIDER.MANUAL).trim().toLowerCase();
    const methodCode = method?.code || String(payload.method || PAYMENT_METHOD_TYPE.COD).trim().toLowerCase();

    return {
      orderId: payload.orderId,
      paymentMethodId: payload.paymentMethodId || null,
      transactionCode: payload.transactionCode || createPaymentTransactionCode(),
      provider,
      method: methodCode,
      amount: Number(payload.amount),
      currency: payload.currency || "VND",
      status: payload.status || PAYMENT_TRANSACTION_STATUS.PENDING,
      paidAt: payload.paidAt || (payload.status === PAYMENT_TRANSACTION_STATUS.SUCCESS ? new Date() : null),
      metadata: payload.metadata || null
    };
  }

  async ensureUniqueMethodCode(code, excludedId = null) {
    const method = await this.repository.findMethodByCode(code, excludedId);

    if (method) {
      throw new AppError("Payment method code already exists.", 409, "PAYMENT_METHOD_CODE_EXISTS");
    }
  }

  async ensureOrderExists(orderId, connection) {
    const order = await this.repository.findOrderPaymentSummary(orderId, connection);

    if (!order) {
      throw new AppError("Order was not found.", 404, "PAYMENT_ORDER_NOT_FOUND");
    }
  }

  async syncOrderPaymentSummary(orderId, transaction, connection) {
    const order = await this.repository.findOrderPaymentSummary(orderId, connection);
    const currentPaidAmount = Number(order.paid_amount || 0);
    const grandTotal = Number(order.grand_total || 0);
    const paidAmount = this.resolvePaidAmount(currentPaidAmount, Number(transaction.amount || 0), transaction.status, grandTotal);
    const paymentStatus = this.resolveOrderPaymentStatus(grandTotal, paidAmount, transaction.status);

    await this.repository.updateOrderPaymentSummary(orderId, {
      paymentStatus,
      paymentMethod: transaction.method,
      paidAmount
    }, connection);
  }

  resolvePaidAmount(currentPaidAmount, amount, status, grandTotal) {
    if (status === PAYMENT_TRANSACTION_STATUS.SUCCESS) {
      return Math.min(currentPaidAmount + amount, grandTotal);
    }

    if (status === PAYMENT_TRANSACTION_STATUS.REFUNDED) {
      return Math.max(currentPaidAmount - amount, 0);
    }

    return currentPaidAmount;
  }

  resolveOrderPaymentStatus(grandTotal, paidAmount, transactionStatus) {
    if (transactionStatus === PAYMENT_TRANSACTION_STATUS.FAILED) {
      return ORDER_PAYMENT_STATUS.FAILED;
    }

    if (transactionStatus === PAYMENT_TRANSACTION_STATUS.REFUNDED) {
      return paidAmount === 0 ? ORDER_PAYMENT_STATUS.REFUNDED : ORDER_PAYMENT_STATUS.PARTIAL;
    }

    if (paidAmount <= 0) {
      return ORDER_PAYMENT_STATUS.UNPAID;
    }

    return paidAmount >= grandTotal ? ORDER_PAYMENT_STATUS.PAID : ORDER_PAYMENT_STATUS.PARTIAL;
  }
}

function createPaymentTransactionCode() {
  return `PAY-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalizeSupportedMethod(value) {
  const method = String(value || "").trim().toLowerCase();
  const supportedMethods = ["cod", "bank_transfer", "vnpay", "momo"];

  if (!supportedMethods.includes(method)) {
    throw new AppError("Payment method is invalid.", 422, "INVALID_PAYMENT_METHOD");
  }

  return method;
}

function normalizeTransactionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  const normalizedStatus = status === PAYMENT_TRANSACTION_STATUS.SUCCESS
    ? PAYMENT_TRANSACTION_STATUS.PAID
    : status;
  const supportedStatuses = [
    PAYMENT_TRANSACTION_STATUS.PENDING,
    PAYMENT_TRANSACTION_STATUS.PAID,
    PAYMENT_TRANSACTION_STATUS.FAILED,
    PAYMENT_TRANSACTION_STATUS.REFUNDED
  ];

  if (!supportedStatuses.includes(normalizedStatus)) {
    throw new AppError("Payment status is invalid.", 422, "INVALID_PAYMENT_TRANSACTION_STATUS");
  }

  return normalizedStatus;
}

export { ORDER_PAYMENT_STATUS, PAYMENT_METHOD_TYPE, PAYMENT_PROVIDER, PAYMENT_TRANSACTION_STATUS };

