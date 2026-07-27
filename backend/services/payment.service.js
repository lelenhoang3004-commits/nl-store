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
import { createPaymentProviderAdapter } from "./payment-providers/index.js";

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
  CREDIT_CARD: "credit_card",
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

    if (normalizeTransactionStatus(currentTransaction.status) === normalizedStatus) {
      return currentTransaction;
    }

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
      await this.repository.createOrderHistory({
        orderId: transaction.orderId,
        status: normalizedStatus === PAYMENT_TRANSACTION_STATUS.PAID ? "confirmed" : order.status || "pending",
        note: `Payment ${transaction.transactionCode || id} changed to ${normalizedStatus}.`,
        changedBy
      }, connection);
      await this.notificationService.notifyAdmin({
        type: "PAYMENT_UPDATED",
        title: normalizedStatus === PAYMENT_TRANSACTION_STATUS.FAILED ? "Thanh toán thất bại" : "Thanh toán đã xác nhận",
        message: `Giao dịch ${transaction.transactionCode || id} chuyển sang ${normalizedStatus}.`, 
        link: "#payments",
        relatedId: id,
        eventKey: `payment-status:${id}:${normalizedStatus}`
      }, connection);
      if (normalizedStatus === PAYMENT_TRANSACTION_STATUS.PAID) {
        await this.notificationService.notifyCustomer(order.customer_id, {
          type: "PAYMENT_CONFIRMED",
          title: "Thanh toan da duoc xac nhan",
          message: `Don hang ${order.order_code || transaction.orderId} da duoc xac nhan thanh toan.`,
          link: "#orders",
          relatedId: transaction.orderId,
          eventKey: `payment-paid-customer:${transaction.orderId}:${id}`
        }, connection);
      }
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

  async getCustomerOrderPayment(orderId, customerId) {
    const order = await this.repository.findOrderForCustomerPayment(orderId, customerId);
    if (!order) throw new AppError("Order was not found.", 404, "ORDER_NOT_FOUND");

    const transaction = await this.repository.findByOrderIdForCustomer(orderId, customerId);
    if (!transaction) {
      return this.formatCustomerPaymentResponse(order, null, null);
    }

    const tx = transaction.toJSON();
    const paymentGuide = tx.metadata?.paymentGuide || null;
    return this.formatCustomerPaymentResponse(order, tx, paymentGuide);
  }

  async retryCustomerOrderPayment(orderId, customerId, changedBy = null) {
    let createdTransactionId = null;

    await withTransaction(async (connection) => {
      const order = await this.repository.findOrderForCustomerPayment(orderId, customerId, connection, true);
      if (!order) throw new AppError("Order was not found.", 404, "ORDER_NOT_FOUND");
      if (order.payment_status === ORDER_PAYMENT_STATUS.PAID) throw new AppError("Order is already paid.", 409, "ORDER_ALREADY_PAID");

      const existing = await this.repository.findByOrderIdForCustomer(orderId, customerId, connection);
      if (existing) {
        const existingJson = existing.toJSON();
        const state = this.resolveTransactionClientState(existingJson);
        if (state.isReusable) {
          createdTransactionId = existingJson.id;
          return;
        }
        if (String(existingJson.status || "").toLowerCase() === PAYMENT_TRANSACTION_STATUS.PENDING) {
          await this.repository.updateStatus(existingJson.id, {
            status: PAYMENT_TRANSACTION_STATUS.FAILED,
            paidAt: existingJson.paidAt || null,
            metadata: { ...(existingJson.metadata || {}), expiredAt: new Date().toISOString(), expiredReason: "Customer requested a new QR." }
          }, connection);
          await this.repository.createHistory({ transactionId: existingJson.id, status: PAYMENT_TRANSACTION_STATUS.FAILED, note: "Payment QR expired before retry.", changedBy }, connection);
        }
      }

      const method = normalizeSupportedMethod(order.payment_method || existing?.method || "bank_transfer");
      const transactionCode = createPaymentTransactionCode();
      const paymentGuide = await this.createPaymentGuide({ method, order, transactionCode });
      const paymentMethod = await this.repository.findPaymentMethodByCode(method, connection);
      createdTransactionId = await this.repository.createTransaction({
        orderId: order.id,
        paymentMethodId: paymentMethod?.id || null,
        transactionCode,
        provider: paymentGuide?.provider || method,
        method,
        amount: Number(order.grand_total || 0),
        currency: "VND",
        status: PAYMENT_TRANSACTION_STATUS.PENDING,
        paidAt: null,
        metadata: { source: "customer_order_payment_retry", paymentGuide: sanitizePaymentGuideForMetadata(paymentGuide) }
      }, connection);
      await this.repository.createHistory({ transactionId: createdTransactionId, status: PAYMENT_TRANSACTION_STATUS.PENDING, note: "Payment transaction retried for existing order.", changedBy }, connection);
      await this.repository.updateOrderPaymentStatus(order.id, { paymentStatus: ORDER_PAYMENT_STATUS.UNPAID, paymentMethod: method, paidAmount: 0 }, connection);
    });

    const refreshed = await this.repository.findTransactionById(createdTransactionId);
    const order = await this.repository.findOrderForCustomerPayment(orderId, customerId);
    const tx = refreshed?.toJSON() || null;
    return this.formatCustomerPaymentResponse(order, tx, tx?.metadata?.paymentGuide || null);
  }

  async getCustomerTransactionStatus(transactionId, customerId) {
    const transaction = await this.repository.findTransactionById(transactionId);
    if (!transaction) throw new AppError("Payment transaction was not found.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
    const order = await this.repository.findOrderForCustomerPayment(transaction.orderId, customerId);
    if (!order) throw new AppError("Payment transaction was not found.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
    const tx = transaction.toJSON();
    return this.formatCustomerPaymentResponse(order, tx, tx.metadata?.paymentGuide || null);
  }

  async changeCustomerOrderPaymentMethod(orderId, customerId, paymentMethod, changedBy = null) {
    const normalizedInput = String(paymentMethod || "").trim().toLowerCase();
    const methodMap = { cod: "cod", momo: "momo", momo_personal_qr: "momo", bank_transfer: "bank_transfer", bank_personal_qr: "bank_transfer" };
    const method = methodMap[normalizedInput];
    if (!method) throw new AppError("Phương thức thanh toán không hợp lệ.", 422, "INVALID_PAYMENT_METHOD");
    let activeTransactionId = null;

    await withTransaction(async (connection) => {
      const order = await this.repository.findOrderForCustomerPayment(orderId, customerId, connection, true);
      if (!order) throw new AppError("Không tìm thấy đơn hàng.", 404, "ORDER_NOT_FOUND");
      if (order.payment_status === ORDER_PAYMENT_STATUS.PAID) throw new AppError("Đơn hàng đã được thanh toán nên không thể đổi phương thức.", 409, "ORDER_ALREADY_PAID");
      const existing = await this.repository.findByOrderIdForCustomer(orderId, customerId, connection);
      if (existing) {
        const existingJson = existing.toJSON();
        if (existingJson.metadata?.customerReportedPaymentAt) throw new AppError("Giao dịch đang chờ cửa hàng xác nhận nên không thể đổi phương thức thanh toán.", 409, "PAYMENT_WAITING_CONFIRMATION");
        if (String(existingJson.status || "").toLowerCase() === PAYMENT_TRANSACTION_STATUS.PAID) throw new AppError("Đơn hàng đã được thanh toán nên không thể đổi phương thức.", 409, "ORDER_ALREADY_PAID");
        if ([PAYMENT_TRANSACTION_STATUS.PENDING, PAYMENT_TRANSACTION_STATUS.FAILED, PAYMENT_TRANSACTION_STATUS.CANCELLED].includes(String(existingJson.status || "").toLowerCase())) {
          await this.repository.updateStatus(existingJson.id, { status: PAYMENT_TRANSACTION_STATUS.CANCELLED, paidAt: existingJson.paidAt || null, metadata: { ...(existingJson.metadata || {}), cancelledAt: new Date().toISOString(), cancelledReason: "Customer changed payment method." } }, connection);
          await this.repository.createHistory({ transactionId: existingJson.id, status: PAYMENT_TRANSACTION_STATUS.CANCELLED, note: "Khách đổi phương thức thanh toán.", changedBy }, connection);
        }
      }
      await this.repository.updateOrderPaymentStatus(order.id, { paymentStatus: ORDER_PAYMENT_STATUS.UNPAID, paymentMethod: method, paidAmount: 0 }, connection);
      if (method === "cod") { activeTransactionId = null; return; }
      const transactionCode = createPaymentTransactionCode();
      const paymentGuide = await this.createPaymentGuide({ method, order: { ...order, payment_method: method }, transactionCode });
      const paymentMethodRecord = await this.repository.findPaymentMethodByCode(method, connection);
      activeTransactionId = await this.repository.createTransaction({ orderId: order.id, paymentMethodId: paymentMethodRecord?.id || null, transactionCode, provider: paymentGuide?.provider || method, method, amount: Number(order.grand_total || 0), currency: "VND", status: PAYMENT_TRANSACTION_STATUS.PENDING, paidAt: null, metadata: { source: "customer_payment_method_change", paymentGuide: sanitizePaymentGuideForMetadata(paymentGuide) } }, connection);
      await this.repository.createHistory({ transactionId: activeTransactionId, status: PAYMENT_TRANSACTION_STATUS.PENDING, note: "Tạo giao dịch mới sau khi khách đổi phương thức thanh toán.", changedBy }, connection);
    });
    if (!activeTransactionId) { const order = await this.repository.findOrderForCustomerPayment(orderId, customerId); return this.formatCustomerPaymentResponse(order, null, null); }
    const refreshed = await this.repository.findTransactionById(activeTransactionId);
    const order = await this.repository.findOrderForCustomerPayment(orderId, customerId);
    const tx = refreshed?.toJSON() || null;
    return this.formatCustomerPaymentResponse(order, tx, tx?.metadata?.paymentGuide || null);
  }
  async reportCustomerPayment(transactionId, customerId) {
    const transaction = await this.repository.findTransactionById(transactionId);
    if (!transaction) throw new AppError("Không tìm thấy giao dịch thanh toán.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
    const order = await this.repository.findOrderForCustomerPayment(transaction.orderId, customerId);
    if (!order) throw new AppError("Không tìm thấy giao dịch thanh toán.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
    const tx = transaction.toJSON();
    const guide = tx.metadata?.paymentGuide || {};
    const guideProvider = String(guide.provider || tx.provider || "").toUpperCase();
    const txMethod = String(tx.method || "").toLowerCase();
    const canCustomerReport = (txMethod === "momo" && guideProvider === "MOMO_PERSONAL_QR") || (txMethod === "bank_transfer" && guideProvider === "BANK_PERSONAL_QR");
    if (!canCustomerReport) throw new AppError("Phương thức thanh toán này không hỗ trợ khách tự báo thanh toán.", 422, "PAYMENT_REPORT_NOT_SUPPORTED");
    const status = String(tx.status || "").toLowerCase();
    if (status === PAYMENT_TRANSACTION_STATUS.PAID) throw new AppError("Đơn hàng đã được thanh toán.", 409, "ORDER_ALREADY_PAID");
    if (tx.metadata?.customerReportedPaymentAt) return this.formatCustomerPaymentResponse(order, tx, guide);

    let updated = null;
    await withTransaction(async (connection) => {
      const locked = await this.repository.findTransactionById(transactionId, connection);
      if (!locked) throw new AppError("Không tìm thấy giao dịch thanh toán.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");
      const lockedTx = locked.toJSON();
      if (lockedTx.metadata?.customerReportedPaymentAt) { updated = lockedTx; return; }
      const metadata = { ...(lockedTx.metadata || {}), customerReportedPaymentAt: new Date().toISOString(), customerReportedPaymentBy: customerId };
      const refreshed = await this.repository.updateStatus(transactionId, { status: PAYMENT_TRANSACTION_STATUS.PENDING, paidAt: lockedTx.paidAt || null, metadata }, connection);
      await this.repository.createHistory({ transactionId: Number(transactionId), status: PAYMENT_TRANSACTION_STATUS.PENDING, note: guideProvider === "BANK_PERSONAL_QR" ? "Khách đã báo đã chuyển khoản, đang chờ cửa hàng xác nhận." : "Khách đã báo đã thanh toán MoMo, đang chờ cửa hàng xác nhận.", changedBy: customerId }, connection);
      await this.notificationService.notifyAdmin({
        type: "PAYMENT_REPORTED",
        title: "Khách đã báo thanh toán",
        message: `Giao dịch ${lockedTx.transactionCode || transactionId} đang chờ cửa hàng xác nhận.`,
        link: "#payments",
        relatedId: transactionId,
        eventKey: `payment-reported:${transactionId}`
      }, connection);
      updated = refreshed?.toJSON ? refreshed.toJSON() : refreshed;
    });

    const finalTx = updated || (await this.repository.findTransactionById(transactionId))?.toJSON();
    return this.formatCustomerPaymentResponse(order, finalTx, finalTx?.metadata?.paymentGuide || guide);
  }

  formatCustomerPaymentResponse(order, transaction, paymentGuide) {
    const state = this.resolveTransactionClientState(transaction);
    return {
      orderId: order?.id || transaction?.orderId || null,
      orderCode: order?.order_code || transaction?.orderCode || null,
      paymentStatus: order?.payment_status || "unpaid",
      paymentTransactionId: transaction?.id || null,
      paymentMethod: order?.payment_method || transaction?.method || null,
      amount: Number(order?.grand_total ?? transaction?.amount ?? 0),
      currency: transaction?.currency || "VND",
      transactionStatus: transaction?.metadata?.customerReportedPaymentAt && String(transaction?.status || "").toLowerCase() === PAYMENT_TRANSACTION_STATUS.PENDING ? "processing" : transaction?.status || null,
      actualTransactionStatus: transaction?.status || null,
      customerReportedPaymentAt: transaction?.metadata?.customerReportedPaymentAt || null,
      paidAt: transaction?.paidAt || null,
      createdAt: transaction?.createdAt || null,
      updatedAt: transaction?.updatedAt || null,
      expiresAt: paymentGuide?.expiresAt || null,
      isExpired: state.isExpired,
      canRetry: state.canRetry,
      canReuse: state.isReusable,
      paymentGuide: sanitizePaymentGuideForClient(paymentGuide)
    };
  }

  resolveTransactionClientState(transaction) {
    const status = String(transaction?.status || "").toLowerCase();
    const expiresAt = transaction?.metadata?.paymentGuide?.expiresAt || null;
    const expiredByTime = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;
    const reusableStatuses = [PAYMENT_TRANSACTION_STATUS.PENDING];
    const terminalStatuses = [PAYMENT_TRANSACTION_STATUS.PAID, PAYMENT_TRANSACTION_STATUS.FAILED, PAYMENT_TRANSACTION_STATUS.CANCELLED, PAYMENT_TRANSACTION_STATUS.EXPIRED, PAYMENT_TRANSACTION_STATUS.REFUNDED];
    const isReusable = reusableStatuses.includes(status) && !expiredByTime;
    const isExpired = status === PAYMENT_TRANSACTION_STATUS.EXPIRED || (reusableStatuses.includes(status) && expiredByTime);
    const canRetry = isExpired || [PAYMENT_TRANSACTION_STATUS.FAILED, PAYMENT_TRANSACTION_STATUS.CANCELLED].includes(status);
    return { isReusable, isExpired, canRetry, isTerminal: terminalStatuses.includes(status) || isExpired };
  }

  async createPaymentGuide({ method, order, transactionCode }) {
    const adapter = createPaymentProviderAdapter(method);
    if (!adapter) return null;
    return adapter.createPaymentSession({ orderId: order.id, orderCode: order.order_code, amount: Number(order.grand_total || 0), transactionCode });
  }

  async handleMomoIpn(payload = {}) {
    const verification = verifyMomoIpnSignature(payload);
    if (!verification.verified) {
      throw new AppError("Invalid MoMo IPN signature.", 400, "INVALID_MOMO_SIGNATURE");
    }

    if (String(payload.partnerCode || "") !== String(process.env.MOMO_PARTNER_CODE || "")) {
      throw new AppError("Invalid MoMo partner code.", 400, "INVALID_MOMO_PARTNER");
    }

    const transaction = await this.repository.findByMomoIdentifiers({
      momoOrderId: payload.orderId,
      requestId: payload.requestId
    });
    if (!transaction) throw new AppError("Payment transaction was not found.", 404, "PAYMENT_TRANSACTION_NOT_FOUND");

    const tx = transaction.toJSON();
    const expectedAmount = Math.round(Number(tx.amount || 0));
    if (Number(payload.amount) !== expectedAmount) {
      throw new AppError("Invalid MoMo amount.", 400, "MOMO_AMOUNT_MISMATCH");
    }

    const expectedGuide = tx.metadata?.paymentGuide || {};
    if (String(expectedGuide.momoOrderId || "") !== String(payload.orderId || "") || String(expectedGuide.requestId || "") !== String(payload.requestId || "")) {
      throw new AppError("Invalid MoMo order identifiers.", 400, "MOMO_ORDER_MISMATCH");
    }

    if (String(tx.status || "").toLowerCase() === PAYMENT_TRANSACTION_STATUS.PAID) {
      return this.formatCustomerPaymentResponse(await this.repository.findOrderForPayment(tx.orderId), tx, tx.metadata?.paymentGuide || null);
    }

    const isSuccess = Number(payload.resultCode) === 0;
    const nextStatus = isSuccess ? PAYMENT_TRANSACTION_STATUS.PAID : PAYMENT_TRANSACTION_STATUS.FAILED;
    const nextMetadata = {
      ...(tx.metadata || {}),
      momoIpn: sanitizeMomoIpnForMetadata(payload),
      momoIpnReceivedAt: new Date().toISOString()
    };

    const updated = await this.updatePaymentStatus(tx.id, nextStatus, null, {
      metadata: nextMetadata,
      note: isSuccess ? "MoMo IPN confirmed payment." : "MoMo IPN reported payment failure."
    });
    return this.formatCustomerPaymentResponse(await this.repository.findOrderForPayment(tx.orderId), updated, updated.metadata?.paymentGuide || null);
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
      code: String(payload.code).trim(),
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
  const supportedMethods = ["cod", "bank_transfer", "vnpay", "credit_card", "momo", "momo_personal_qr"];

  if (!supportedMethods.includes(method)) {
    throw new AppError("Payment method is invalid.", 422, "INVALID_PAYMENT_METHOD");
  }

  if (method === "credit_card") return "CREDIT_CARD";
  return method === "momo_personal_qr" ? "momo" : method;
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
    PAYMENT_TRANSACTION_STATUS.CANCELLED,
    PAYMENT_TRANSACTION_STATUS.REFUNDED
  ];

  if (!supportedStatuses.includes(normalizedStatus)) {
    throw new AppError("Trạng thái thanh toán không hợp lệ.", 422, "INVALID_PAYMENT_TRANSACTION_STATUS");
  }

  return normalizedStatus;
}

export { ORDER_PAYMENT_STATUS, PAYMENT_METHOD_TYPE, PAYMENT_PROVIDER, PAYMENT_TRANSACTION_STATUS };

function sanitizePaymentGuideForMetadata(guide) {
  if (!guide) return null;
  const { rawAccountNumber, signature, secretKey, accessKey, ...safeGuide } = guide;
  return safeGuide;
}

function sanitizePaymentGuideForClient(guide) {
  return sanitizePaymentGuideForMetadata(guide);
}

function verifyMomoIpnSignature(payload = {}) {
  const secretKey = process.env.MOMO_SECRET_KEY || "";
  if (!secretKey || !payload.signature) return { verified: false };
  const rawSignature = [
    "accessKey=" + (process.env.MOMO_ACCESS_KEY || ""),
    "amount=" + String(payload.amount ?? ""),
    "extraData=" + String(payload.extraData ?? ""),
    "message=" + String(payload.message ?? ""),
    "orderId=" + String(payload.orderId ?? ""),
    "orderInfo=" + String(payload.orderInfo ?? ""),
    "orderType=" + String(payload.orderType ?? ""),
    "partnerCode=" + String(payload.partnerCode ?? ""),
    "payType=" + String(payload.payType ?? ""),
    "requestId=" + String(payload.requestId ?? ""),
    "responseTime=" + String(payload.responseTime ?? ""),
    "resultCode=" + String(payload.resultCode ?? ""),
    "transId=" + String(payload.transId ?? "")
  ].join("&");
  const expected = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
  try {
    return { verified: crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(payload.signature))) };
  } catch {
    return { verified: false };
  }
}

function sanitizeMomoIpnForMetadata(payload = {}) {
  const { signature, ...safePayload } = payload;
  return safePayload;
}


