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
