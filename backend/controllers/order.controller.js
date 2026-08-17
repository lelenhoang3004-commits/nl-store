/**
 * Order controller.
 * It handles HTTP request/response concerns for orders, details, status history, payments, and transactions.
 */
import { BaseController } from "./base.controller.js";
import { OrderService } from "../services/order.service.js";
import { PaymentService } from "../services/payment.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class OrderController extends BaseController {
  constructor(service = new OrderService()) {
    super();
    this.service = service;
    this.paymentService = new PaymentService();
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


  cancelMyOrder = asyncHandler(async (request, response) => {
    const order = await this.service.cancelCustomerOrder(request.params.id, request.user.id, request.body || {});

    return this.sendSuccess(response, {
      order
    }, "Hủy đơn hàng thành công");
  });
  confirmMyOrderReceived = asyncHandler(async (request, response) => {
    const order = await this.service.confirmCustomerOrderReceived(request.params.id, request.user.id);

    return this.sendSuccess(response, {
      order
    }, "Xác nhận nhận hàng thành công.");
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

  customerPayment = asyncHandler(async (request, response) => {
    const payment = await this.paymentService.getCustomerOrderPayment(request.params.id, request.user.id);
    return this.sendSuccess(response, { payment }, "Order payment retrieved successfully.");
  });

  retryCustomerPayment = asyncHandler(async (request, response) => {
    const payment = await this.paymentService.retryCustomerOrderPayment(request.params.id, request.user.id, request.user.id);
    return this.sendSuccess(response, { payment }, "Order payment retry prepared successfully.");
  });

  changeCustomerPaymentMethod = asyncHandler(async (request, response) => {
    const paymentMethod = request.body?.payment_method ?? request.body?.paymentMethod;
    const payment = await this.paymentService.changeCustomerOrderPaymentMethod(
      request.params.id,
      request.user.id,
      paymentMethod,
      request.user.id
    );

    return this.sendSuccess(response, { payment }, "Payment method changed successfully.");
  });

  destroy = asyncHandler(async (request, response) => {
    const order = await this.service.deleteOrder(request.params.id);

    return this.sendSuccess(response, {
      order
    }, "Order deleted successfully.");
  });
}
