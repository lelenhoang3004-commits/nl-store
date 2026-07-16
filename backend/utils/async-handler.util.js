/**
 * Async route wrapper.
 * It forwards rejected promises to the central error handler and avoids repetitive try/catch in controllers.
 */
export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
