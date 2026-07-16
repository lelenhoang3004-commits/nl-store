/**
 * Wishlist routes.
 */
import { Router } from "express";
import { WishlistController } from "../controllers/wishlist.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import { validateWishlistProductIdRequest } from "../validators/wishlist.validator.js";

const router = Router();
const controller = new WishlistController();

router.use(authenticate);

router.get("/", controller.index);
router.post("/:productId", validateRequest(validateWishlistProductIdRequest), controller.store);
router.delete("/:productId", validateRequest(validateWishlistProductIdRequest), controller.destroy);

export default router;
