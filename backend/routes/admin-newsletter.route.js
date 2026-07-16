import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminNewsletterController } from "../controllers/admin-newsletter.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateNewsletterIdRequest,
  validateNewsletterListRequest,
  validateNewsletterStatusRequest
} from "../validators/newsletter.validator.js";

const router = Router();
const controller = new AdminNewsletterController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const view = authorize({ roles, permissions: [AUTH_PERMISSIONS.NEWSLETTER_VIEW, AUTH_PERMISSIONS.EMAIL_VIEW], permissionMode: "any" });
const update = authorize({ roles, permissions: [AUTH_PERMISSIONS.NEWSLETTER_MANAGE, AUTH_PERMISSIONS.NEWSLETTER_UPDATE], permissionMode: "any" });
const remove = authorize({ roles, permissions: [AUTH_PERMISSIONS.NEWSLETTER_MANAGE, AUTH_PERMISSIONS.NEWSLETTER_DELETE], permissionMode: "any" });

router.use(authenticate);
router.get("/", view, validateRequest(validateNewsletterListRequest), controller.index);
router.get("/:id", view, validateRequest(validateNewsletterIdRequest), controller.show);
router.patch("/:id/status", update, validateRequest(validateNewsletterStatusRequest), controller.updateStatus);
router.delete("/:id", remove, validateRequest(validateNewsletterIdRequest), controller.destroy);

export default router;


