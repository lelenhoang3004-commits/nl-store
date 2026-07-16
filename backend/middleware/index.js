/**
 * Middleware barrel file.
 * It keeps middleware imports consistent as the backend grows.
 */
export { authenticate } from "./authentication.middleware.js";
export { authorize } from "./authorization.middleware.js";
export { authorizePermissions } from "./permission.middleware.js";
export { authorizeRoles } from "./role.middleware.js";
export { errorHandler } from "./error-handler.middleware.js";
export { handleUploadError, upload, uploadImage } from "./upload.middleware.js";
export { apiRateLimiter } from "./rate-limit.middleware.js";
export { notFoundHandler } from "./not-found.middleware.js";
export { requestLogger } from "./request-logger.middleware.js";
export { csrfProtection, issueCsrfToken } from "./csrf.middleware.js";
export { sanitizeRequest } from "./sanitize-request.middleware.js";
export { applySecurityMiddleware } from "./security.middleware.js";
export { validateRequest } from "./validate-request.middleware.js";
