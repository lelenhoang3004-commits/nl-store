import { BaseService } from "./base.service.js";

class PaymentService extends BaseService {
  constructor() {
    super("/admin/payments");
  }

  updateStatus(id, status, options = {}) {
    return this.client.patch(this.path(id, "status"), { status }, options);
  }

  getByOrder(orderId, options = {}) {
    return this.client.get(this.path("order", orderId), options);
  }
}

export const paymentService = new PaymentService();
export { PaymentService };

