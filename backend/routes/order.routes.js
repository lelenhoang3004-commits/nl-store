/**
 * Order routes.
 * This REST module manages orders, order details, status history, payments, and transactions.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS } from "../config/auth.config.js";
import { OrderController } from "../controllers/order.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCreateOrderRequest,
  validateCreateTransactionRequest,
  validateOrderIdRequest,
  validateOrderListRequest,
  validateUpdateOrderStatusRequest
} from "../validators/order.validator.js";

const router = Router();
const orderController = new OrderController();

router.use(authenticate);

router.get(
  "/my",
  validateRequest(validateOrderListRequest),
  orderController.myOrders
);

router.get(
  "/my/:id",
  validateRequest(validateOrderIdRequest),
  orderController.showMyOrder
);

router.post(
  "/my",
  validateRequest(validateCreateOrderRequest),
  orderController.storeMyOrder
);

router.get(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW),
  validateRequest(validateOrderListRequest),
  orderController.index
);

router.post(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_MANAGE),
  validateRequest(validateCreateOrderRequest),
  orderController.store
);

router.get(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW),
  validateRequest(validateOrderIdRequest),
  orderController.show
);

router.get(
  "/:id/details",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW),
  validateRequest(validateOrderIdRequest),
  orderController.details
);

router.get(
  "/:id/history",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_VIEW),
  validateRequest(validateOrderIdRequest),
  orderController.history
);

router.get(
  "/:id/transactions",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validateOrderIdRequest),
  orderController.transactions
);

router.patch(
  "/:id/status",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_MANAGE),
  validateRequest(validateUpdateOrderStatusRequest),
  orderController.updateStatus
);

router.post(
  "/:id/transactions",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_MANAGE),
  validateRequest(validateCreateTransactionRequest),
  orderController.addTransaction
);

router.delete(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.ORDER_MANAGE),
  validateRequest(validateOrderIdRequest),
  orderController.destroy
);

export default router;
