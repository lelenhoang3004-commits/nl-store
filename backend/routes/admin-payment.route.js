import { Router } from "express";
import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { PaymentController } from "../controllers/payment.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorize } from "../middleware/authorization.middleware.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import {
  validateCreatePaymentMethodRequest,
  validateCreatePaymentRequest,
  validateCreatePaymentTransactionRequest,
  validatePaymentMethodIdRequest,
  validatePaymentOrderIdRequest,
  validatePaymentTransactionIdRequest,
  validatePaymentTransactionListRequest,
  validateUpdatePaymentMethodRequest,
  validateUpdatePaymentStatusRequest,
  validateUpdatePaymentTransactionStatusRequest
} from "../validators/payment.validator.js";

const router = Router();
const controller = new PaymentController();
const roles = [AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF];
const view = authorize({ roles, permissions: [AUTH_PERMISSIONS.PAYMENT_VIEW] });
const manage = authorize({ roles, permissions: [AUTH_PERMISSIONS.PAYMENT_MANAGE, AUTH_PERMISSIONS.PAYMENT_UPDATE], permissionMode: "any" });

router.use(authenticate);
router.get("/", view, validateRequest(validatePaymentTransactionListRequest), controller.list);
router.get("/order/:orderId", view, validateRequest(validatePaymentOrderIdRequest), controller.getByOrder);
router.post("/", manage, validateRequest(validateCreatePaymentRequest), controller.create);
router.patch("/:id/status", manage, validateRequest(validateUpdatePaymentStatusRequest), controller.updateStatus);
router.get("/transactions", view, validateRequest(validatePaymentTransactionListRequest), controller.transactions);
router.post("/transactions", manage, validateRequest(validateCreatePaymentTransactionRequest), controller.createTransaction);
router.get("/transactions/:id", view, validateRequest(validatePaymentTransactionIdRequest), controller.showTransaction);
router.patch("/transactions/:id/status", manage, validateRequest(validateUpdatePaymentTransactionStatusRequest), controller.updateTransactionStatus);
router.get("/transactions/:id/history", view, validateRequest(validatePaymentTransactionIdRequest), controller.transactionHistory);
router.post("/methods", manage, validateRequest(validateCreatePaymentMethodRequest), controller.createMethod);
router.put("/methods/:id", manage, validateRequest(validateUpdatePaymentMethodRequest), controller.updateMethod);
router.delete("/methods/:id", manage, validateRequest(validatePaymentMethodIdRequest), controller.deleteMethod);
router.get("/:id", view, validateRequest(validatePaymentTransactionIdRequest), controller.getById);

export default router;
