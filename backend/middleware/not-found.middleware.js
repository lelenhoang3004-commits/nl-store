/**
 * Not found middleware.
 * It catches unknown backend routes after the route registry has had a chance to match them.
 */
import { AppError } from "../utils/app-error.util.js";

export function notFoundHandler(request, response, next) {
  next(new AppError(`Route ${request.method} ${request.originalUrl} was not found.`, 404, "ROUTE_NOT_FOUND"));
}
