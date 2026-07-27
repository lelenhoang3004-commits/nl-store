import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminSidebarController } from "../controllers/admin-sidebar.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";

const router = Router();
const controller = new AdminSidebarController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const permissions = [
  AUTH_PERMISSIONS.PRODUCT_VIEW,
  AUTH_PERMISSIONS.ORDER_VIEW,
  AUTH_PERMISSIONS.PAYMENT_VIEW,
  AUTH_PERMISSIONS.NEWSLETTER_VIEW,
  AUTH_PERMISSIONS.EMAIL_VIEW
];

router.get(
  "/sidebar-counts",
  authenticate,
  authorize({ roles, permissions, permissionMode: "any" }),
  controller.counts
);

export default router;
