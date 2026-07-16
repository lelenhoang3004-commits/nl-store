/**
 * Dashboard routes.
 * This module exposes read-only statistics for admin dashboards.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS } from "../config/auth.config.js";
import { DashboardController } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import { validateDashboardLimitRequest, validateDashboardMonthsRequest } from "../validators/dashboard.validator.js";

const router = Router();
const dashboardController = new DashboardController();

router.use(authenticate);
router.use(authorizePermissions(AUTH_PERMISSIONS.DASHBOARD_VIEW));

router.get("/overview", dashboardController.overview);
router.get("/charts/revenue", validateRequest(validateDashboardMonthsRequest), dashboardController.revenueChart);
router.get("/top-products", validateRequest(validateDashboardLimitRequest), dashboardController.topProducts);
router.get("/top-customers", validateRequest(validateDashboardLimitRequest), dashboardController.topCustomers);
router.get("/monthly", validateRequest(validateDashboardMonthsRequest), dashboardController.monthlyStats);

export default router;
