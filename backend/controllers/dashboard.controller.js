/**
 * Dashboard controller.
 * It exposes read-only admin statistics, charts, rankings, and monthly summaries.
 */
import { BaseController } from "./base.controller.js";
import { DashboardService } from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class DashboardController extends BaseController {
  constructor(service = new DashboardService()) {
    super();
    this.service = service;
  }

  overview = asyncHandler(async (request, response) => {
    const overview = await this.service.getOverview();
    return this.sendSuccess(response, { overview }, "Dashboard overview retrieved successfully.");
  });

  revenueChart = asyncHandler(async (request, response) => {
    const chart = await this.service.getRevenueChart(request.query);
    return this.sendSuccess(response, { chart }, "Revenue chart retrieved successfully.");
  });

  topProducts = asyncHandler(async (request, response) => {
    const products = await this.service.getTopProducts(request.query);
    return this.sendSuccess(response, { products }, "Top products retrieved successfully.");
  });

  topCustomers = asyncHandler(async (request, response) => {
    const customers = await this.service.getTopCustomers(request.query);
    return this.sendSuccess(response, { customers }, "Top customers retrieved successfully.");
  });

  monthlyStats = asyncHandler(async (request, response) => {
    const stats = await this.service.getMonthlyStats(request.query);
    return this.sendSuccess(response, { stats }, "Monthly statistics retrieved successfully.");
  });
}
