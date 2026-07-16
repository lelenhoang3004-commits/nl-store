/**
 * Payment routes.
 */
import { Router } from "express";
import { AUTH_PERMISSIONS } from "../config/auth.config.js";
import { PaymentController } from "../controllers/payment.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizePermissions } from "../middleware/permission.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCreatePaymentMethodRequest,
  validateCreatePaymentRequest,
  validateCreatePaymentTransactionRequest,
  validatePaymentMethodIdRequest,
  validatePaymentMethodListRequest,
  validatePaymentOrderIdRequest,
  validatePaymentTransactionIdRequest,
  validatePaymentTransactionListRequest,
  validateUpdatePaymentMethodRequest,
  validateUpdatePaymentStatusRequest,
  validateUpdatePaymentTransactionStatusRequest
} from "../validators/payment.validator.js";

const router = Router();
const paymentController = new PaymentController();

/*
  PUBLIC ROUTES
  Khách chưa đăng nhập vẫn xem được phương thức thanh toán
*/
router.get(
  "/methods",
  validateRequest(validatePaymentMethodListRequest),
  paymentController.methods
);

router.get(
  "/methods/:id",
  validateRequest(validatePaymentMethodIdRequest),
  paymentController.showMethod
);

/*
  ADMIN ROUTES
  Từ đây trở xuống mới cần đăng nhập
*/
router.use(authenticate);

router.get(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validatePaymentTransactionListRequest),
  paymentController.list
);

router.get(
  "/order/:orderId",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validatePaymentOrderIdRequest),
  paymentController.getByOrder
);

router.post(
  "/",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validateCreatePaymentRequest),
  paymentController.create
);

router.patch(
  "/:id/status",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validateUpdatePaymentStatusRequest),
  paymentController.updateStatus
);

router.post(
  "/methods",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validateCreatePaymentMethodRequest),
  paymentController.createMethod
);

router.put(
  "/methods/:id",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validateUpdatePaymentMethodRequest),
  paymentController.updateMethod
);

router.delete(
  "/methods/:id",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validatePaymentMethodIdRequest),
  paymentController.deleteMethod
);

router.get(
  "/transactions",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validatePaymentTransactionListRequest),
  paymentController.transactions
);

router.post(
  "/transactions",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validateCreatePaymentTransactionRequest),
  paymentController.createTransaction
);

router.get(
  "/transactions/:id",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validatePaymentTransactionIdRequest),
  paymentController.showTransaction
);

router.patch(
  "/transactions/:id/status",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_MANAGE),
  validateRequest(validateUpdatePaymentTransactionStatusRequest),
  paymentController.updateTransactionStatus
);

router.get(
  "/transactions/:id/history",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validatePaymentTransactionIdRequest),
  paymentController.transactionHistory
);

router.get(
  "/:id",
  authorizePermissions(AUTH_PERMISSIONS.PAYMENT_VIEW),
  validateRequest(validatePaymentTransactionIdRequest),
  paymentController.getById
);

export default router;
