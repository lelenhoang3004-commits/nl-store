/**
 * Cart routes.
 * Customer cart routes require login but do not grant admin capabilities.
 */
import { Router } from "express";
import { CartController } from "../controllers/cart.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateAddCartItemRequest,
  validateCheckoutRequest,
  validateCartSelectionRequest,
  validateUpdateCartItemRequest
} from "../validators/cart.validator.js";

const router = Router();
const cartController = new CartController();

router.use(authenticate);

router.get("/", cartController.show);
router.post("/items", validateRequest(validateAddCartItemRequest), cartController.addItem);
router.post("/checkout", validateRequest(validateCheckoutRequest), cartController.checkout);
router.patch("/items/select-all", validateRequest(validateCartSelectionRequest), cartController.selectAll);
router.patch("/items/:itemId", validateRequest(validateUpdateCartItemRequest), cartController.updateItem);
router.delete("/items/:itemId", cartController.deleteItem);
router.patch("/items/:itemId/select", validateRequest(validateCartSelectionRequest), cartController.selectItem);

export default router;
