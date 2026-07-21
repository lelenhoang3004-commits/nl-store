import { BaseController } from "./base.controller.js";
import { ChatbotService } from "../services/chatbot.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class ChatbotController extends BaseController {
  constructor(service = new ChatbotService()) {
    super();
    this.service = service;
  }

  message = asyncHandler(async (request, response) => {
    const result = await this.service.replyToMessage({
      message: request.body.message,
      conversationId: request.body.conversationId,
      user: request.user
    });

    return this.sendSuccess(response, result, "Chatbot reply generated.");
  });
}
