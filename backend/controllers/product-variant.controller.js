import { BaseController } from "./base.controller.js";
import { ProductVariantService } from "../services/product-variant.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class ProductVariantController extends BaseController {
  constructor(service = new ProductVariantService()) { super(); this.service = service; }
  list = asyncHandler(async (req, res) => this.sendSuccess(res, { variants: await this.service.listVariants(req.params.productId ?? req.params.id) }, "Product variants retrieved successfully."));
  create = asyncHandler(async (req, res) => this.sendSuccess(res, { variant: await this.service.createVariant(req.params.productId ?? req.params.id, req.body) }, "Product variant created successfully.", 201));
  update = asyncHandler(async (req, res) => this.sendSuccess(res, { variant: await this.service.updateVariant(req.params.productId ?? req.params.id, req.params.variantId, req.body) }, "Product variant updated successfully."));
  updateStock = asyncHandler(async (req, res) => this.sendSuccess(res, { variant: await this.service.updateVariantStock(req.params.productId ?? req.params.id, req.params.variantId, req.body) }, "Product variant stock updated successfully."));
  updateStatus = asyncHandler(async (req, res) => this.sendSuccess(res, { variant: await this.service.updateVariantStatus(req.params.productId ?? req.params.id, req.params.variantId, req.body?.status) }, "Product variant status updated successfully."));
  remove = asyncHandler(async (req, res) => this.sendSuccess(res, { variant: await this.service.deleteVariant(req.params.productId ?? req.params.id, req.params.variantId) }, "Product variant deleted successfully."));
}
