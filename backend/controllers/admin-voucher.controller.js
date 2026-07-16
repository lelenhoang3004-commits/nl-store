import { BaseController } from "./base.controller.js";
import { VoucherService } from "../services/voucher.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminVoucherController extends BaseController {
  constructor(service = new VoucherService()) { super(); this.service = service; }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getVouchers(request.query);
    return this.sendSuccess(response, { vouchers: result.vouchers }, "Admin vouchers retrieved successfully.", 200, result.meta);
  });

  show = asyncHandler(async (request, response) => {
    const voucher = await this.service.getVoucherById(request.params.id);
    return this.sendSuccess(response, { voucher }, "Admin voucher retrieved successfully.");
  });

  store = asyncHandler(async (request, response) => {
    const voucher = await this.service.createVoucher(request.body);
    return this.sendSuccess(response, { voucher }, "Voucher created successfully.", 201);
  });

  update = asyncHandler(async (request, response) => {
    const voucher = await this.service.updateVoucher(request.params.id, request.body);
    return this.sendSuccess(response, { voucher }, "Voucher updated successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const voucher = await this.service.updateVoucherStatus(request.params.id, request.body?.status);
    return this.sendSuccess(response, { voucher }, "Voucher status updated successfully.");
  });

  destroy = asyncHandler(async (request, response) => {
    const voucher = await this.service.deleteVoucher(request.params.id);
    return this.sendSuccess(response, { voucher }, "Voucher deleted successfully.");
  });
}
