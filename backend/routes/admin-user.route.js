import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminUserController } from "../controllers/admin-user.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateAdminUserIdRequest,
  validateAdminUserListRequest,
  validateAdminUserPermissionsRequest,
  validateAdminUserRoleRequest,
  validateAdminUserStatusRequest,
  validateAdminUserUpdateRequest
} from "../validators/admin-user.validator.js";

const router = Router();
const controller = new AdminUserController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const view = authorize({ roles, permissions: [AUTH_PERMISSIONS.USER_VIEW] });
const manage = authorize({ roles, permissions: [AUTH_PERMISSIONS.USER_MANAGE] });

router.use(authenticate);
router.get("/", view, validateRequest(validateAdminUserListRequest), controller.index);
router.get("/:id", view, validateRequest(validateAdminUserIdRequest), controller.show);
router.patch("/:id/status", manage, validateRequest(validateAdminUserStatusRequest), controller.updateStatus);
router.patch("/:id/role", manage, validateRequest(validateAdminUserRoleRequest), controller.updateRole);
router.patch("/:id/permissions", manage, validateRequest(validateAdminUserPermissionsRequest), controller.updatePermissions);
router.patch("/:id", manage, validateRequest(validateAdminUserUpdateRequest), controller.update);

export default router;
