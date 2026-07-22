/**
 * User routes.
 * This REST module manages users, profile, avatar, role, permission, and address data without Dashboard logic.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS } from "../config/auth.config.js";
import { UserController } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { handleUploadError, uploadImage } from "../middleware/upload.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCreateUserRequest,
  validateChangePasswordRequest,
  validatePaymentMethodRequest,
  validateProfileUpdateRequest,
  validateUpdateUserRequest,
  validateUserIdRequest,
  validateUserListRequest
} from "../validators/user.validator.js";

const router = Router();
const userController = new UserController();

router.use(authenticate);

router.get("/profile", userController.profile);
router.put("/profile", validateRequest(validateProfileUpdateRequest), userController.updateProfile);
router.post("/profile/avatar", uploadImage.single("avatar"), handleUploadError, userController.uploadAvatar);
router.put("/profile/password", validateRequest(validateChangePasswordRequest), userController.changePassword);
router.get("/profile/social-connections", userController.socialConnections);
router.post("/profile/social-connections/:provider/link-intent", userController.socialLinkIntent);
router.delete("/profile/social-connections/:provider", userController.unlinkSocialConnection);
router.get("/profile/payment-methods", userController.paymentMethods);
router.post("/profile/payment-methods", validateRequest(validatePaymentMethodRequest), userController.storePaymentMethod);
router.patch("/profile/payment-methods/:id/default", validateRequest(validateUserIdRequest), userController.setDefaultPaymentMethod);
router.delete("/profile/payment-methods/:id", validateRequest(validateUserIdRequest), userController.deletePaymentMethod);

router.get(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.USER_VIEW),
  validateRequest(validateUserListRequest),
  userController.index
);

router.get(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.USER_VIEW),
  validateRequest(validateUserIdRequest),
  userController.show
);

router.post(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.USER_MANAGE),
  validateRequest(validateCreateUserRequest),
  userController.store
);

router.put(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.USER_MANAGE),
  validateRequest(validateUpdateUserRequest),
  userController.update
);

router.delete(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.USER_MANAGE),
  validateRequest(validateUserIdRequest),
  userController.destroy
);

export default router;
