import { BaseController } from "./base.controller.js";
import { CategoryService } from "../services/category.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class AdminCategoryController extends BaseController {
  constructor(service = new CategoryService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getCategories(request.query, { isAdmin: true });

    return this.sendSuccess(
      response,
      {
        categories: result.categories
      },
      "Admin categories retrieved successfully.",
      200,
      result.meta
    );
  });

  show = asyncHandler(async (request, response) => {
    const category = await this.service.getCategoryById(request.params.id, { isAdmin: true });

    return this.sendSuccess(response, {
      category
    }, "Admin category retrieved successfully.");
  });

  store = asyncHandler(async (request, response) => {
    const category = await this.service.createCategory(request.body);

    return this.sendSuccess(response, {
      category
    }, "Category created successfully.", 201);
  });

  update = asyncHandler(async (request, response) => {
    const category = await this.service.updateCategory(request.params.id, request.body);

    return this.sendSuccess(response, {
      category
    }, "Category updated successfully.");
  });

  updateStatus = asyncHandler(async (request, response) => {
    const category = await this.service.updateCategoryStatus(request.params.id, request.body?.status);

    return this.sendSuccess(response, {
      category
    }, "Category status updated successfully.");
  });

  destroy = asyncHandler(async (request, response) => {
    const result = await this.service.deleteCategory(request.params.id);

    return this.sendSuccess(response, {
      category: result
    }, "Category deleted successfully.");
  });
}
