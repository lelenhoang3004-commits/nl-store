import { BaseController } from "./base.controller.js";
import { NewsletterService } from "../services/newsletter.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminNewsletterController extends BaseController {
  constructor(service = new NewsletterService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getSubscribers(request.query);
    return this.sendSuccess(response, { subscribers: result.subscribers }, "Newsletter subscribers retrieved successfully.", 200, result.meta);
  });

  show = asyncHandler(async (request, response) => {
    const subscriber = await this.service.getSubscriberById(request.params.id);
    return this.sendSuccess(response, { subscriber }, "Newsletter subscriber retrieved successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const subscriber = await this.service.updateSubscriberStatus(request.params.id, request.body?.status);
    return this.sendSuccess(response, { subscriber }, "Newsletter subscriber status updated successfully.");
  });

  destroy = asyncHandler(async (request, response) => {
    const subscriber = await this.service.deleteSubscriber(request.params.id);
    return this.sendSuccess(response, { subscriber }, "Newsletter subscriber deleted successfully.");
  });
}
