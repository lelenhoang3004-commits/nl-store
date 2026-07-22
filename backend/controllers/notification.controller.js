import { BaseController } from "./base.controller.js";
import { NotificationService } from "../services/notification.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class NotificationController extends BaseController {
  constructor(service = new NotificationService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.listForUser({ ...request.user, notificationAudience: request.notificationAudience }, request.query);
    return this.sendSuccess(response, result, "Notifications retrieved successfully.");
  });

  markRead = asyncHandler(async (request, response) => {
    const result = await this.service.markRead(request.params.id, { ...request.user, notificationAudience: request.notificationAudience });
    return this.sendSuccess(response, result, "Notification marked as read.");
  });

  markAllRead = asyncHandler(async (request, response) => {
    const result = await this.service.markAllRead({ ...request.user, notificationAudience: request.notificationAudience });
    return this.sendSuccess(response, result, "Notifications marked as read.");
  });
}
