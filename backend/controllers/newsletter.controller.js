/**
 * Newsletter controller.
 * It handles HTTP request/response concerns for subscribe, unsubscribe, and admin subscriber listing.
 */
import { BaseController } from "./base.controller.js";
import { NewsletterService } from "../services/newsletter.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class NewsletterController extends BaseController {
  constructor(service = new NewsletterService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getSubscribers(request.query);

    return this.sendSuccess(response, {
      subscribers: result.subscribers
    }, "Newsletter subscribers retrieved successfully.", 200, result.meta);
  });

  show = asyncHandler(async (request, response) => {
    const subscriber = await this.service.getSubscriberById(request.params.id);

    return this.sendSuccess(response, {
      subscriber
    }, "Newsletter subscriber retrieved successfully.");
  });

  subscribe = asyncHandler(async (request, response) => {
    const subscriber = await this.service.subscribe(request.body);
    const alreadySubscribed = Boolean(subscriber.alreadySubscribed);

    return this.sendSuccess(response, {
      subscriber
    }, alreadySubscribed ? "Email đã đăng ký nhận tin." : "Newsletter subscription successful.", 201);
  });

  unsubscribe = asyncHandler(async (request, response) => {
    const subscriber = await this.service.unsubscribeByEmail(request.body.email);

    return this.sendSuccess(response, {
      subscriber
    }, "Newsletter unsubscribe successful.");
  });

  unsubscribeByToken = asyncHandler(async (request, response) => {
    const subscriber = await this.service.unsubscribeByToken(request.params.token);

    return this.sendSuccess(response, {
      subscriber
    }, "Newsletter unsubscribe successful.");
  });
}


