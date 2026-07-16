import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminOrderController } from "../controllers/admin-order.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateAdminOrderCancelRequest,
  validateAdminOrderIdRequest,
  validateAdminOrderListRequest,
  validateAdminOrderStatusRequest
} from "../validators/admin-order.validator.js";

const router = Router();
const controller = new AdminOrderController();

router.use(authenticate, authorizeRoles(AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF));

router.get("/", authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW), validateRequest(validateAdminOrderListRequest), controller.list);
router.get("/:id/payments", authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW, AUTH_PERMISSIONS.PAYMENT_VIEW), validateRequest(validateAdminOrderIdRequest), controller.getPayments);
router.patch("/:id/status", authorizePermissions(AUTH_PERMISSIONS.ORDER_MANAGE), validateRequest(validateAdminOrderStatusRequest), controller.updateStatus);
router.patch("/:id/cancel", authorizePermissions(AUTH_PERMISSIONS.ORDER_MANAGE), validateRequest(validateAdminOrderCancelRequest), controller.cancel);
router.get("/:id", authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW), validateRequest(validateAdminOrderIdRequest), controller.getById);

export default router;
