/**
 * Category controller.
 * It handles HTTP request/response concerns for the Category REST module.
 */
import { BaseController } from "./base.controller.js";
import { CategoryService } from "../services/category.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class CategoryController extends BaseController {
  constructor(service = new CategoryService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getCategories(request.query, { isCustomer: true });

    return this.sendSuccess(
      response,
      {
        categories: result.categories
      },
      "Categories retrieved successfully.",
      200,
      result.meta
    );
  });

  show = asyncHandler(async (request, response) => {
    const category = await this.service.getCategoryById(request.params.id, { isCustomer: true });

    return this.sendSuccess(response, {
      category
    }, "Category retrieved successfully.");
  });

  store = asyncHandler(async (_request, _response) => {
    throw new Error("Admin-only category mutation is not available on the customer route.");
  });

  update = asyncHandler(async (_request, _response) => {
    throw new Error("Admin-only category mutation is not available on the customer route.");
  });

  destroy = asyncHandler(async (_request, _response) => {
    throw new Error("Admin-only category mutation is not available on the customer route.");
  });
}
