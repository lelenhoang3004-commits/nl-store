/**
 * Security utility routes.
 * These endpoints expose browser security primitives such as CSRF token bootstrap.
 */
import { Router } from "express";
import { issueCsrfToken } from "../middleware/csrf.middleware.js";
import { ApiResponse } from "../utils/api-response.util.js";

const router = Router();

router.get("/csrf-token", (request, response) => {
  const csrfToken = issueCsrfToken(request, response);

  return response.json(ApiResponse.success({ csrfToken }, "CSRF token issued."));
});

export default router;
