import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminCategoryController } from "../controllers/admin-category.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCategoryIdRequest,
  validateCategoryListRequest,
  validateCreateCategoryRequest,
  validateUpdateCategoryRequest,
  validateCategoryStatusRequest
} from "../validators/category.validator.js";

const router = Router();
const controller = new AdminCategoryController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const view = authorize({ roles, permissions: [AUTH_PERMISSIONS.CATEGORY_VIEW] });
const create = authorize({ roles, permissions: [AUTH_PERMISSIONS.CATEGORY_MANAGE, AUTH_PERMISSIONS.CATEGORY_CREATE], permissionMode: "any" });
const update = authorize({ roles, permissions: [AUTH_PERMISSIONS.CATEGORY_MANAGE, AUTH_PERMISSIONS.CATEGORY_UPDATE], permissionMode: "any" });
const remove = authorize({ roles, permissions: [AUTH_PERMISSIONS.CATEGORY_MANAGE, AUTH_PERMISSIONS.CATEGORY_DELETE], permissionMode: "any" });

router.use(authenticate);
router.get("/", view, validateRequest(validateCategoryListRequest), controller.index);
router.get("/:id", view, validateRequest(validateCategoryIdRequest), controller.show);
router.post("/", create, validateRequest(validateCreateCategoryRequest), controller.store);
router.patch("/:id/status", update, validateRequest(validateCategoryStatusRequest), controller.updateStatus);
router.patch("/:id", update, validateRequest(validateUpdateCategoryRequest), controller.update);
router.delete("/:id", remove, validateRequest(validateCategoryIdRequest), controller.destroy);

export default router;
