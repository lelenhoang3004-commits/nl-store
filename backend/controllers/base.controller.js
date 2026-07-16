/**
 * Base controller.
 * Feature controllers can extend this class to keep HTTP responses consistent.
 */
import { ApiResponse } from "../utils/api-response.util.js";

export class BaseController {
  sendSuccess(response, data = null, message = "Success", statusCode = 200, meta = null) {
    return response.status(statusCode).json(ApiResponse.success(data, message, meta, statusCode));
  }
}
