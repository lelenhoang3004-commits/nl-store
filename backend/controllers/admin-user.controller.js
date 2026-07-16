import { BaseController } from "./base.controller.js";
import { AdminUserService } from "../services/admin-user.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminUserController extends BaseController {
  constructor(service = new AdminUserService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getAdminUsers(request.query);

    return this.sendSuccess(
      response,
      {
        items: result.items,
        pagination: result.pagination
      },
      "Admin users retrieved successfully."
    );
  });

  show = asyncHandler(async (request, response) => {
    const user = await this.service.getAdminUserById(request.params.id);
    return this.sendSuccess(response, { user }, "Admin user retrieved successfully.");
  });

  update = asyncHandler(async (request, response) => {
    const user = await this.service.updateAdminUser(request.params.id, request.body, request.user);
    return this.sendSuccess(response, { user }, "User updated successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const user = await this.service.updateUserStatus(request.params.id, request.body?.status, request.user);
    return this.sendSuccess(response, { user }, "User status updated successfully.");
  });

  updateRole = asyncHandler(async (request, response) => {
    const user = await this.service.updateUserRole(request.params.id, request.body?.role, request.user);
    return this.sendSuccess(response, { user }, "User role updated successfully.");
  });

  updatePermissions = asyncHandler(async (request, response) => {
    const user = await this.service.updateUserPermissions(request.params.id, request.body?.permissions, request.user);
    return this.sendSuccess(response, { user }, "User permissions updated successfully.");
  });
}
