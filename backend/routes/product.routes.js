/**
 * Product routes.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS } from "../config/auth.config.js";
import { ProductController } from "../controllers/product.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { handleUploadError, uploadImage } from "../middleware/upload.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCreateProductRequest,
  validateProductIdRequest,
  validateProductListRequest,
  validateUpdateProductRequest
} from "../validators/product.validator.js";

const router = Router();
const productController = new ProductController();

/*
  PUBLIC ROUTES
  Khách chưa đăng nhập vẫn xem được sản phẩm
*/
router.get(
  "/",
  validateRequest(validateProductListRequest),
  productController.index
);

router.get(
  "/:id",
  validateRequest(validateProductIdRequest),
  productController.show
);

/*
  ADMIN ROUTES
  Từ đây trở xuống mới cần đăng nhập
*/
router.use(authenticate);

router.post(
  "/images",
  authorizePermissions(AUTH_PERMISSIONS.PRODUCT_MANAGE),
  uploadImage.array("images", 10),
  handleUploadError,
  productController.uploadImages
);

router.post(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.PRODUCT_MANAGE),
  validateRequest(validateCreateProductRequest),
  productController.store
);

router.put(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.PRODUCT_MANAGE),
  validateRequest(validateUpdateProductRequest),
  productController.update
);

router.delete(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.PRODUCT_MANAGE),
  validateRequest(validateProductIdRequest),
  productController.destroy
);

export default router;