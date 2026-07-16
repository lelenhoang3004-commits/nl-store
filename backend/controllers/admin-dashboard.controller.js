import { BaseController } from "./base.controller.js";
import { AdminDashboardService } from "../services/admin-dashboard.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminDashboardController extends BaseController {
  constructor(service = new AdminDashboardService()) {
    super();
    this.service = service;
  }

  overview = asyncHandler(async (request, response) => {
    const dashboard = await this.service.getDashboardOverview(request.query);
    return this.sendSuccess(response, dashboard, "Admin dashboard retrieved successfully.");
  });

  summary = asyncHandler(async (_request, response) => {
    return this.sendSuccess(response, { summary: await this.service.getSummary() }, "Dashboard summary retrieved successfully.");
  });

  revenue = asyncHandler(async (request, response) => {
    return this.sendSuccess(response, { revenueChart: await this.service.getRevenue(request.query) }, "Dashboard revenue retrieved successfully.");
  });

  ordersByStatus = asyncHandler(async (_request, response) => {
    return this.sendSuccess(response, { ordersByStatus: await this.service.getOrdersByStatus() }, "Order status statistics retrieved successfully.");
  });

  paymentsByMethod = asyncHandler(async (_request, response) => {
    return this.sendSuccess(response, { paymentsByMethod: await this.service.getPaymentsByMethod() }, "Payment method statistics retrieved successfully.");
  });

  topProducts = asyncHandler(async (request, response) => {
    return this.sendSuccess(response, { topProducts: await this.service.getTopProducts(request.query) }, "Top products retrieved successfully.");
  });

  recentOrders = asyncHandler(async (request, response) => {
    return this.sendSuccess(response, { recentOrders: await this.service.getRecentOrders(request.query) }, "Recent orders retrieved successfully.");
  });
}
