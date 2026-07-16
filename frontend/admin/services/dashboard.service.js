import { apiClient } from "./api/index.js";

class DashboardService {
  getOverview(params = {}, options = {}) {
    return apiClient.get("/admin/dashboard", { ...options, params });
  }

  getSummary(options = {}) {
    return apiClient.get("/admin/dashboard/summary", options);
  }

  getRevenue(params = {}, options = {}) {
    return apiClient.get("/admin/dashboard/revenue", { ...options, params });
  }

  getOrdersByStatus(options = {}) {
    return apiClient.get("/admin/dashboard/orders/status", options);
  }

  getPaymentsByMethod(options = {}) {
    return apiClient.get("/admin/dashboard/payments/methods", options);
  }

  getTopProducts(params = {}, options = {}) {
    return apiClient.get("/admin/dashboard/top-products", { ...options, params });
  }

  getRecentOrders(params = {}, options = {}) {
    return apiClient.get("/admin/dashboard/recent-orders", { ...options, params });
  }
}

export const dashboardService = new DashboardService();
export { DashboardService };
