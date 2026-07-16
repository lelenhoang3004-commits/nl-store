/**
 * Newsletter routes.
 * Public routes handle subscribe/unsubscribe; admin routes list subscribers with email permission.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS } from "../config/auth.config.js";
import { NewsletterController } from "../controllers/newsletter.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateNewsletterIdRequest,
  validateNewsletterListRequest,
  validateSubscribeRequest,
  validateUnsubscribeRequest,
  validateUnsubscribeTokenRequest
} from "../validators/newsletter.validator.js";

const router = Router();
const newsletterController = new NewsletterController();

router.post("/subscribe", validateRequest(validateSubscribeRequest), newsletterController.subscribe);
router.post("/unsubscribe", validateRequest(validateUnsubscribeRequest), newsletterController.unsubscribe);
router.get("/unsubscribe/:token", validateRequest(validateUnsubscribeTokenRequest), newsletterController.unsubscribeByToken);

router.get(
  "/subscribers",
  authenticate,
  authorizePermissions(AUTH_PERMISSIONS.EMAIL_VIEW),
  validateRequest(validateNewsletterListRequest),
  newsletterController.index
);

router.get(
  "/subscribers/:id",
  authenticate,
  authorizePermissions(AUTH_PERMISSIONS.EMAIL_VIEW),
  validateRequest(validateNewsletterIdRequest),
  newsletterController.show
);

export default router;
