import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminProductController } from "../controllers/admin-product.controller.js";
import { ProductVariantController } from "../controllers/product-variant.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateAdminProductIdRequest,
  validateAdminProductListRequest,
  validateAdminProductStatusRequest,
  validateAdminProductStockRequest,
  validateCreateAdminProductRequest,
  validateUpdateAdminProductRequest
} from "../validators/admin-product.validator.js";
import { validateCreateVariantRequest, validateDeleteVariantRequest, validateStatusUpdateVariantRequest, validateStockUpdateVariantRequest, validateUpdateVariantRequest, validateVariantListRequest } from "../validators/product-variant.validator.js";

const router = Router();
const controller = new AdminProductController();
const variantController = new ProductVariantController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const view = authorize({ roles, permissions: [AUTH_PERMISSIONS.PRODUCT_VIEW] });
const create = authorize({ roles, permissions: [AUTH_PERMISSIONS.PRODUCT_MANAGE, AUTH_PERMISSIONS.PRODUCT_CREATE], permissionMode: "any" });
const update = authorize({ roles, permissions: [AUTH_PERMISSIONS.PRODUCT_MANAGE, AUTH_PERMISSIONS.PRODUCT_UPDATE], permissionMode: "any" });
const remove = authorize({ roles, permissions: [AUTH_PERMISSIONS.PRODUCT_MANAGE, AUTH_PERMISSIONS.PRODUCT_DELETE], permissionMode: "any" });

router.use(authenticate);
router.get("/:productId/variants", view, validateRequest(validateVariantListRequest), variantController.list);
router.post("/:productId/variants", create, validateRequest(validateCreateVariantRequest), variantController.create);
router.patch("/:productId/variants/:variantId", update, validateRequest(validateUpdateVariantRequest), variantController.update);
router.patch("/:productId/variants/:variantId/stock", update, validateRequest(validateStockUpdateVariantRequest), variantController.updateStock);
router.patch("/:productId/variants/:variantId/status", update, validateRequest(validateStatusUpdateVariantRequest), variantController.updateStatus);
router.delete("/:productId/variants/:variantId", remove, validateRequest(validateDeleteVariantRequest), variantController.remove);
router.get("/", view, validateRequest(validateAdminProductListRequest), controller.list);
router.get("/:id", view, validateRequest(validateAdminProductIdRequest), controller.getById);
router.post("/", create, validateRequest(validateCreateAdminProductRequest), controller.create);
router.patch("/:id/stock", update, validateRequest(validateAdminProductStockRequest), controller.updateStock);
router.patch("/:id/status", update, validateRequest(validateAdminProductStatusRequest), controller.updateStatus);
router.patch("/:id", update, validateRequest(validateUpdateAdminProductRequest), controller.update);
router.delete("/:id", remove, validateRequest(validateAdminProductIdRequest), controller.remove);

export default router;
