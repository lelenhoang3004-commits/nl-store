import { UserService } from "./user.service.js";
import { AdminUserRepository } from "../repositories/admin-user.repository.js";

export class AdminUserService extends UserService {
  constructor(repository = new AdminUserRepository()) {
    super(repository);
  }

  async getAdminUsers(query) {
    const result = await this.getUsers(query);

    return {
      items: result.users.map(toAdminUserJson),
      pagination: {
        page: result.meta.pagination.page,
        limit: result.meta.pagination.limit,
        total: result.meta.pagination.totalItems,
        totalPages: result.meta.pagination.totalPages,
        hasNextPage: result.meta.pagination.hasNextPage,
        hasPreviousPage: result.meta.pagination.hasPreviousPage
      },
      meta: result.meta
    };
  }

  async getAdminUserById(id) {
    return toAdminUserJson(await this.getUserById(id));
  }

  async updateAdminUser(id, payload, actor = {}) {
    return toAdminUserJson(await super.updateAdminUser(id, payload, actor));
  }

  async updateUserStatus(id, status, actor = {}) {
    return toAdminUserJson(await super.updateUserStatus(id, status, actor));
  }

  async updateUserRole(id, role, actor = {}) {
    return toAdminUserJson(await super.updateUserRole(id, role, actor));
  }

  async updateUserPermissions(id, permissions, actor = {}) {
    return toAdminUserJson(await super.updateUserPermissions(id, permissions, actor));
  }
}

function toAdminUserJson(user = {}) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName ?? user.full_name ?? "",
    fullName: user.fullName ?? user.full_name ?? "",
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    created_at: user.createdAt ?? user.created_at ?? null,
    createdAt: user.createdAt ?? user.created_at ?? null,
    updated_at: user.updatedAt ?? user.updated_at ?? null,
    updatedAt: user.updatedAt ?? user.updated_at ?? null
  };
}
