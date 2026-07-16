import { BaseController } from "./base.controller.js";
import { VoucherService } from "../services/voucher.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class VoucherController extends BaseController {
  constructor(service = new VoucherService()) { super(); this.service = service; }

  validate = asyncHandler(async (request, response) => {
    const result = await this.service.validateVoucher(request.body);
    return this.sendSuccess(response, result, "Voucher validated successfully.");
  });
}
