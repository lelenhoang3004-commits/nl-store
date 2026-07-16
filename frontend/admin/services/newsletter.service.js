import { BaseService } from "./base.service.js";

class NewsletterService extends BaseService {
  constructor() { super("/admin/newsletter"); }
  getAll(params = {}, options = {}) { return this.list(params, options); }
  updateStatus(id, status, options = {}) { return this.patch(`${id}/status`, { status }, options); }
}

export const newsletterService = new NewsletterService();
export { NewsletterService };
