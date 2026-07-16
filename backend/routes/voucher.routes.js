import { Router } from "express";
import { VoucherController } from "../controllers/voucher.controller.js";
import { validateRequest } from "../middleware/validate-request.middleware.js";
import { validateVoucherApplyRequest } from "../validators/voucher.validator.js";

const router = Router();
const controller = new VoucherController();

router.post("/validate", validateRequest(validateVoucherApplyRequest), controller.validate);

export default router;
