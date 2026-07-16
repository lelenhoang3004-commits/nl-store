/**
 * Product controller.
 * It handles HTTP request/response concerns for the Product REST module.
 */
import { BaseController } from "./base.controller.js";
import { ProductService } from "../services/product.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class ProductController extends BaseController {
  constructor(service = new ProductService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getProducts({ ...request.query, status: "active" });

    return this.sendSuccess(
      response,
      {
        products: result.products
      },
      "Products retrieved successfully.",
      200,
      result.meta
    );
  });

  show = asyncHandler(async (request, response) => {
    const product = await this.service.getPublishedProductById(request.params.id);

    return this.sendSuccess(response, {
      product
    }, "Product retrieved successfully.");
  });

  store = asyncHandler(async (request, response) => {
    const product = await this.service.createProduct(request.body);

    return this.sendSuccess(response, {
      product
    }, "Product created successfully.", 201);
  });

  update = asyncHandler(async (request, response) => {
    const product = await this.service.updateProduct(request.params.id, request.body);

    return this.sendSuccess(response, {
      product
    }, "Product updated successfully.");
  });

  destroy = asyncHandler(async (request, response) => {
    const product = await this.service.deleteProduct(request.params.id);

    return this.sendSuccess(response, {
      product
    }, "Product deleted successfully.");
  });

  uploadImages = asyncHandler(async (request, response) => {
    const files = this.service.createUploadedImagesPayload(request.files || []);

    return this.sendSuccess(response, {
      files
    }, "Product images uploaded successfully.", 201);
  });
}
