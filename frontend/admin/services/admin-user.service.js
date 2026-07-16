import { BaseService } from "./base.service.js";

class AdminUserService extends BaseService {
  constructor() {
    super("/admin/users");
  }

  getAll(params = {}, options = {}) {
    return this.list(params, options);
  }

  updateStatus(id, status, options = {}) {
    return this.patch(`${id}/status`, { status }, options);
  }

  updateRole(id, role, options = {}) {
    return this.patch(`${id}/role`, { role }, options);
  }

  updatePermissions(id, permissions, options = {}) {
    return this.patch(`${id}/permissions`, { permissions }, options);
  }
}

export const adminUserService = new AdminUserService();
export { AdminUserService };
