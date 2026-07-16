/**
 * Order controller.
 * It handles HTTP request/response concerns for orders, details, status history, payments, and transactions.
 */
import { BaseController } from "./base.controller.js";
import { OrderService } from "../services/order.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class OrderController extends BaseController {
  constructor(service = new OrderService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getOrders(request.query);

    return this.sendSuccess(response, {
      orders: result.orders
    }, "Orders retrieved successfully.", 200, result.meta);
  });

  myOrders = asyncHandler(async (request, response) => {
    const result = await this.service.getCustomerOrders(request.user.id, request.query);

    return this.sendSuccess(response, {
      orders: result.orders
    }, "Customer orders retrieved successfully.", 200, result.meta);
  });

  show = asyncHandler(async (request, response) => {
    const order = await this.service.getOrderById(request.params.id);

    return this.sendSuccess(response, {
      order
    }, "Order retrieved successfully.");
  });

  showMyOrder = asyncHandler(async (request, response) => {
    const order = await this.service.getCustomerOrderById(request.params.id, request.user.id);

    return this.sendSuccess(response, {
      order
    }, "Customer order retrieved successfully.");
  });

  store = asyncHandler(async (request, response) => {
    const order = await this.service.createOrder(request.body, request.user.id, {
      usePayloadCustomerId: true
    });

    return this.sendSuccess(response, {
      order
    }, "Order created successfully.", 201);
  });

  storeMyOrder = asyncHandler(async (request, response) => {
    const order = await this.service.createOrder(request.body, request.user.id);

    return this.sendSuccess(response, {
      order
    }, "Customer order created successfully.", 201);
  });

  details = asyncHandler(async (request, response) => {
    const details = await this.service.getOrderDetails(request.params.id);

    return this.sendSuccess(response, {
      details
    }, "Order details retrieved successfully.");
  });

  history = asyncHandler(async (request, response) => {
    const history = await this.service.getOrderHistory(request.params.id);

    return this.sendSuccess(response, {
      history
    }, "Order history retrieved successfully.");
  });

  transactions = asyncHandler(async (request, response) => {
    const transactions = await this.service.getOrderTransactions(request.params.id);

    return this.sendSuccess(response, {
      transactions
    }, "Order transactions retrieved successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const order = await this.service.updateOrderStatus(request.params.id, request.body, request.user.id);

    return this.sendSuccess(response, {
      order
    }, "Order status updated successfully.");
  });

  addTransaction = asyncHandler(async (request, response) => {
    const order = await this.service.addPaymentTransaction(request.params.id, request.body, request.user.id);

    return this.sendSuccess(response, {
      order
    }, "Order transaction recorded successfully.", 201);
  });

  destroy = asyncHandler(async (request, response) => {
    const order = await this.service.deleteOrder(request.params.id);

    return this.sendSuccess(response, {
      order
    }, "Order deleted successfully.");
  });
}
