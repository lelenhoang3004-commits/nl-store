import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminVoucherController } from "../controllers/admin-voucher.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCreateVoucherRequest,
  validateUpdateVoucherRequest,
  validateVoucherIdRequest,
  validateVoucherListRequest,
  validateVoucherStatusRequest
} from "../validators/voucher.validator.js";

const router = Router();
const controller = new AdminVoucherController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const view = authorize({ roles, permissions: [AUTH_PERMISSIONS.VOUCHER_VIEW] });
const create = authorize({ roles, permissions: [AUTH_PERMISSIONS.VOUCHER_MANAGE, AUTH_PERMISSIONS.VOUCHER_CREATE], permissionMode: "any" });
const update = authorize({ roles, permissions: [AUTH_PERMISSIONS.VOUCHER_MANAGE, AUTH_PERMISSIONS.VOUCHER_UPDATE], permissionMode: "any" });
const remove = authorize({ roles, permissions: [AUTH_PERMISSIONS.VOUCHER_MANAGE, AUTH_PERMISSIONS.VOUCHER_DELETE], permissionMode: "any" });

router.use(authenticate);
router.get("/", view, validateRequest(validateVoucherListRequest), controller.index);
router.get("/:id", view, validateRequest(validateVoucherIdRequest), controller.show);
router.post("/", create, validateRequest(validateCreateVoucherRequest), controller.store);
router.patch("/:id/status", update, validateRequest(validateVoucherStatusRequest), controller.updateStatus);
router.patch("/:id", update, validateRequest(validateUpdateVoucherRequest), controller.update);
router.delete("/:id", remove, validateRequest(validateVoucherIdRequest), controller.destroy);

export default router;

