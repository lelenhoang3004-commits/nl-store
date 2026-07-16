import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminDashboardController } from "../controllers/admin-dashboard.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateAdminDashboardLimitRequest,
  validateAdminDashboardOverviewRequest,
  validateAdminDashboardRevenueRequest
} from "../validators/admin-dashboard.validator.js";

const router = Router();
const controller = new AdminDashboardController();

router.use(
  authenticate,
  authorizeRoles(AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF),
  authorizePermissions(AUTH_PERMISSIONS.DASHBOARD_VIEW)
);

router.get("/", validateRequest(validateAdminDashboardOverviewRequest), controller.overview);
router.get("/summary", controller.summary);
router.get("/revenue", validateRequest(validateAdminDashboardRevenueRequest), controller.revenue);
router.get("/orders/status", controller.ordersByStatus);
router.get("/payments/methods", controller.paymentsByMethod);
router.get("/top-products", validateRequest(validateAdminDashboardLimitRequest), controller.topProducts);
router.get("/recent-orders", validateRequest(validateAdminDashboardLimitRequest), controller.recentOrders);

export default router;
