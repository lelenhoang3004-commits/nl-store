/**
 * Upload routes.
 * These endpoints manage shared uploaded files only and do not belong to Product CRUD.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { UploadController } from "../controllers/upload.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { uploadRateLimiter } from "../middleware/rate-limit.middleware.js";
import { handleUploadError, upload, uploadImage, validateUploadedFiles, validateUploadedImages } from "../middleware/upload.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import { validateUploadParams } from "../validators/upload.validator.js";

const router = Router();
const uploadController = new UploadController();
const authorizeProductImageUpload = authorize({
  roles: [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF],
  permissions: [AUTH_PERMISSIONS.PRODUCT_CREATE, AUTH_PERMISSIONS.PRODUCT_UPDATE, AUTH_PERMISSIONS.PRODUCT_MANAGE],
  permissionMode: "any"
});

router.post(
  "/images",
  authenticate,
  authorizeProductImageUpload,
  uploadRateLimiter,
  uploadImage.fields([{ name: "image", maxCount: 1 }, { name: "images", maxCount: 10 }]),
  validateUploadedImages,
  handleUploadError,
  uploadController.uploadImages
);
router.post("/files", authenticate, uploadRateLimiter, upload.single("file"), validateUploadedFiles, handleUploadError, uploadController.uploadFile);
router.get("/preview/:folder/:fileName", authenticate, validateRequest(validateUploadParams), uploadController.preview);
router.delete("/:folder/:fileName", authenticate, validateRequest(validateUploadParams), uploadController.delete);

export default router;
