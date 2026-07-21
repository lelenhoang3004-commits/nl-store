import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ChatbotController } from "../controllers/chatbot.controller.js";
import { optionalAuthenticate } from "../middleware/optional-authentication.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import { validateChatbotMessageRequest } from "../validators/chatbot.validator.js";
import { ApiResponse } from "../utils/api-response.util.js";

const router = Router();
const chatbotController = new ChatbotController();

const chatbotRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler(request, response) {
    return response
      .status(429)
      .json(ApiResponse.error("Bạn gửi tin nhắn hơi nhanh. Vui lòng thử lại sau ít phút.", "CHATBOT_RATE_LIMIT_EXCEEDED", null, 429));
  }
});

router.post(
  "/message",
  chatbotRateLimiter,
  optionalAuthenticate,
  validateRequest(validateChatbotMessageRequest),
  chatbotController.message
);

export default router;
