import { BaseService } from "./base.service.js";

class SidebarCountsService extends BaseService {
  constructor() {
    super("/admin/sidebar-counts");
  }

  getCounts(options = {}) {
    return this.client.get(this.endpoint, options);
  }
}

export const sidebarCountsService = new SidebarCountsService();
export { SidebarCountsService };
