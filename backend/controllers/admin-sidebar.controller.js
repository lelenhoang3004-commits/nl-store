import { BaseController } from "./base.controller.js";
import { AdminSidebarService } from "../services/admin-sidebar.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminSidebarController extends BaseController {
  constructor(service = new AdminSidebarService()) {
    super();
    this.service = service;
  }

  counts = asyncHandler(async (request, response) => {
    const data = await this.service.getCounts(request.user);
    return this.sendSuccess(response, data, "Sidebar counts retrieved successfully.");
  });
}
