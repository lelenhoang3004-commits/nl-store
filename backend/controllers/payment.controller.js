/**
 * Payment controller.
 * It handles HTTP concerns for payment methods, COD, transactions, history, and status updates.
 */
import { BaseController } from "./base.controller.js";
import { PaymentService } from "../services/payment.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class PaymentController extends BaseController {
  constructor(service = new PaymentService()) {
    super();
    this.service = service;
  }

  list = asyncHandler(async (request, response) => {
    const result = await this.service.listPayments(request.query);
    return this.sendSuccess(response, { payments: result.transactions }, "Payments retrieved successfully.", 200, result.meta);
  });

  getById = asyncHandler(async (request, response) => {
    const payment = await this.service.getPaymentById(request.params.id);
    return this.sendSuccess(response, { payment }, "Payment retrieved successfully.");
  });

  getByOrder = asyncHandler(async (request, response) => {
    const payment = await this.service.getPaymentByOrder(request.params.orderId);
    return this.sendSuccess(response, { payment }, payment ? "Payment retrieved successfully." : "No payment transaction exists for this order.");
  });

  create = asyncHandler(async (request, response) => {
    const payment = await this.service.createPayment(request.body, request.user?.id || null);
    return this.sendSuccess(response, { payment }, "Payment created successfully.", 201);
  });

  updateStatus = asyncHandler(async (request, response) => {
    const payment = await this.service.updatePaymentStatus(
      request.params.id,
      request.body.status,
      request.user?.id || null,
      request.body
    );
    return this.sendSuccess(response, { payment }, "Payment status updated successfully.");
  });

  methods = asyncHandler(async (request, response) => {
    const result = await this.service.getMethods(request.query);
    return this.sendSuccess(response, { methods: result.methods }, "Payment methods retrieved successfully.", 200, result.meta);
  });

  showMethod = asyncHandler(async (request, response) => {
    const method = await this.service.getMethodById(request.params.id);
    return this.sendSuccess(response, { method }, "Payment method retrieved successfully.");
  });

  createMethod = asyncHandler(async (request, response) => {
    const method = await this.service.createMethod(request.body);
    return this.sendSuccess(response, { method }, "Payment method created successfully.", 201);
  });

  updateMethod = asyncHandler(async (request, response) => {
    const method = await this.service.updateMethod(request.params.id, request.body);
    return this.sendSuccess(response, { method }, "Payment method updated successfully.");
  });

  deleteMethod = asyncHandler(async (request, response) => {
    const method = await this.service.deleteMethod(request.params.id);
    return this.sendSuccess(response, { method }, "Payment method deleted successfully.");
  });

  transactions = asyncHandler(async (request, response) => {
    const result = await this.service.getTransactions(request.query);
    return this.sendSuccess(response, { transactions: result.transactions }, "Payment transactions retrieved successfully.", 200, result.meta);
  });

  showTransaction = asyncHandler(async (request, response) => {
    const transaction = await this.service.getTransactionById(request.params.id);
    return this.sendSuccess(response, { transaction }, "Payment transaction retrieved successfully.");
  });

  createTransaction = asyncHandler(async (request, response) => {
    const transaction = await this.service.createTransaction(request.body, request.user.id);
    return this.sendSuccess(response, { transaction }, "Payment transaction created successfully.", 201);
  });

  updateTransactionStatus = asyncHandler(async (request, response) => {
    const transaction = await this.service.updateTransactionStatus(request.params.id, request.body, request.user.id);
    return this.sendSuccess(response, { transaction }, "Payment transaction status updated successfully.");
  });

  transactionHistory = asyncHandler(async (request, response) => {
    const history = await this.service.getTransactionHistory(request.params.id);
    return this.sendSuccess(response, { history }, "Payment transaction history retrieved successfully.");
  });
}
