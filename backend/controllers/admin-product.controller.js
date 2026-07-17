import { BaseController } from "./base.controller.js";
import { AdminProductService } from "../services/admin-product.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";
import { logger } from "../utils/logger.util.js";

export class AdminProductController extends BaseController {
  constructor(service = new AdminProductService()) {
    super();
    this.service = service;
  }

  list = asyncHandler(async (request, response) => {
    const result = await this.service.listProducts(request.query);
    return this.sendSuccess(response, { items: result.items, pagination: result.pagination }, "Admin products retrieved successfully.", 200, result.meta);
  });

  getById = asyncHandler(async (request, response) => {
    const product = await this.service.getProductById(request.params.id);
    return this.sendSuccess(response, { product }, "Admin product retrieved successfully.");
  });

  create = asyncHandler(async (request, response) => {
    const product = await this.service.createProduct(request.body, request.user);
    return this.sendSuccess(response, { product }, "Product created successfully.", 201);
  });

  update = asyncHandler(async (request, response) => {
    try {
      logger.info("Admin product update received.", {
        productId: request.params.id,
        rating_average: request.body?.rating_average,
        ratingAverage: request.body?.ratingAverage,
        bodyKeys: Object.keys(request.body || {})
      });
      const product = await this.service.updateProduct(request.params.id, request.body, request.user);
      return this.sendSuccess(response, { product }, "Product updated successfully.");
    } catch (error) {
      logger.error("Admin product update failed.", {
        productId: request.params.id,
        bodyKeys: Object.keys(request.body || {}),
        code: error?.code,
        statusCode: error?.statusCode,
        message: error?.message,
        sqlMessage: error?.sqlMessage,
        sql: error?.sql
      });
      throw error;
    }
  });

  updateStock = asyncHandler(async (request, response) => {
    const product = await this.service.updateStock(request.params.id, request.body, request.user);
    return this.sendSuccess(response, { product }, "Product stock updated successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const product = await this.service.updateStatus(request.params.id, request.body.status, request.user);
    return this.sendSuccess(response, { product }, "Product status updated successfully.");
  });

  remove = asyncHandler(async (request, response) => {
    const product = await this.service.deleteProduct(request.params.id, request.user);
    return this.sendSuccess(response, { product }, "Product deleted successfully.");
  });
}
