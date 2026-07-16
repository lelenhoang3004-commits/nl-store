/**
 * Request logger middleware.
 * It uses Morgan for production-ready HTTP access logs without logging sensitive request bodies.
 */
import morgan from "morgan";
import { logger } from "../utils/logger.util.js";

export const requestLogger = morgan("combined", {
  stream: {
    write(message) {
      logger.request(message.trim());
    }
  },
  skip(request) {
    return request.path === "/health";
  }
});
