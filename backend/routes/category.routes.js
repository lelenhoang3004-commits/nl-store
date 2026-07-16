/**
 * Category routes.
 */
import { Router } from "express";
import { CategoryController } from "../controllers/category.controller.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCategoryIdRequest,
  validateCategoryListRequest
} from "../validators/category.validator.js";

const router = Router();
const categoryController = new CategoryController();

/*
  PUBLIC ROUTES
  Khách chưa đăng nhập vẫn xem được danh mục
*/
router.get(
  "/",
  validateRequest(validateCategoryListRequest),
  categoryController.index
);

router.get(
  "/:id",
  validateRequest(validateCategoryIdRequest),
  categoryController.show
);

export default router;