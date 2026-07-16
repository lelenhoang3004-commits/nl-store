import { BaseService } from "./base.service.js";

// Order service keeps order, detail, status, history and transaction calls together.
class OrderService extends BaseService {
  constructor() {
    super("/admin/orders");
  }

  getPayments(id, options = {}) {
    return this.client.get(this.path(id, "payments"), options);
  }

  updateStatus(id, payload, options = {}) {
    return this.client.patch(this.path(id, "status"), payload, options);
  }

  cancel(id, payload, options = {}) {
    return this.client.patch(this.path(id, "cancel"), payload, options);
  }
}

export const orderService = new OrderService();
export { OrderService };
