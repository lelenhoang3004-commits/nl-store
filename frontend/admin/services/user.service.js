import { BaseService } from "./base.service.js";

// User service centralizes admin user, profile, role and avatar requests.
class UserService extends BaseService {
  constructor() {
    super("/users");
  }

  getProfile(options = {}) {
    return this.client.get(this.path("profile"), options);
  }

  updateProfile(payload, options = {}) {
    return this.client.put(this.path("profile"), payload, options);
  }

  uploadAvatar(file, options = {}) {
    const formData = new FormData();
    formData.append("avatar", file);
    return this.client.upload(this.path("profile/avatar"), formData, options);
  }

  updateRole(id, payload, options = {}) {
    return this.client.patch(this.path(id, "role"), payload, options);
  }

  updatePermissions(id, payload, options = {}) {
    return this.client.patch(this.path(id, "permissions"), payload, options);
  }
}

export const userService = new UserService();
export { UserService };
