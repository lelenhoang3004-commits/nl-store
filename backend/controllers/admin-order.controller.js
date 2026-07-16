import { BaseController } from "./base.controller.js";
import { AdminOrderService } from "../services/admin-order.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminOrderController extends BaseController {
  constructor(service = new AdminOrderService()) {
    super();
    this.service = service;
  }

  list = asyncHandler(async (request, response) => {
    const result = await this.service.listOrders(request.query);
    return this.sendSuccess(response, { orders: result.orders }, "Admin orders retrieved successfully.", 200, {
      pagination: result.pagination
    });
  });

  getById = asyncHandler(async (request, response) => {
    const detail = await this.service.getOrderDetail(request.params.id);
    return this.sendSuccess(response, detail, "Admin order detail retrieved successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const detail = await this.service.updateOrderStatus(request.params.id, request.body.status, request.user, request.body.note);
    return this.sendSuccess(response, detail, "Order status updated successfully.");
  });

  cancel = asyncHandler(async (request, response) => {
    const detail = await this.service.cancelOrder(request.params.id, request.body.reason, request.user);
    return this.sendSuccess(response, detail, "Order cancelled and inventory restored successfully.");
  });

  getPayments = asyncHandler(async (request, response) => {
    const payments = await this.service.getOrderPayments(request.params.id);
    return this.sendSuccess(response, { payments }, "Order payments retrieved successfully.");
  });
}
