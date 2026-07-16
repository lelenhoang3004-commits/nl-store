import { BaseService } from "./base.service.js";

class VoucherService extends BaseService {
  constructor() { super("/admin/vouchers"); }
  getAll(params = {}, options = {}) { return this.list(params, options); }
  updateStatus(id, status, options = {}) { return this.patch(`${id}/status`, { status }, options); }
}

export const voucherService = new VoucherService();
export { VoucherService };
