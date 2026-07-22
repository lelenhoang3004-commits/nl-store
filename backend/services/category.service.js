/**
 * Category service.
 * It owns category business rules such as slug uniqueness and parent validation.
 */
import { CategoryRepository } from "../repositories/category.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";
import { createSlug } from "../utils/slug.util.js";

const CATEGORY_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive"
});

const CATEGORY_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "name", "slug", "status", "sortOrder"],
  allowedFilterFields: ["status", "parentId"]
});

export class CategoryService extends BaseService {
  constructor(repository = new CategoryRepository()) {
    super(repository);
  }

  async getCategories(query, options = {}) {
    const parsedOptions = parseQueryOptions(query, CATEGORY_QUERY_OPTIONS);

    if (options.isCustomer) {
      parsedOptions.filter.status = CATEGORY_STATUS.ACTIVE;
    }

    const [categories, totalItems] = await Promise.all([
      this.repository.findAll(parsedOptions, options),
      this.repository.countAll(parsedOptions, options)
    ]);

    return {
      categories: categories.map((category) => category.toJSON()),
      meta: {
        pagination: createPaginationMeta(parsedOptions.pagination, totalItems),
        search: parsedOptions.search,
        sort: parsedOptions.sort,
        filter: parsedOptions.filter
      }
    };
  }

  async getCategoryById(id, options = {}) {
    const category = await this.repository.findById(id, options);

    if (options.isCustomer && category?.status !== CATEGORY_STATUS.ACTIVE) {
      throw new AppError("Category was not found.", 404, "CATEGORY_NOT_FOUND");
    }

    if (!category) {
      throw new AppError("Category was not found.", 404, "CATEGORY_NOT_FOUND");
    }

    return category.toJSON();
  }

  async createCategory(payload) {
    const normalizedPayload = await this.normalizePayload(payload);
    const duplicatedCategory = await this.repository.findBySlug(normalizedPayload.slug);

    if (duplicatedCategory) {
      throw new AppError("Category slug already exists.", 409, "CATEGORY_SLUG_EXISTS");
    }

    await this.ensureParentCategoryExists(normalizedPayload.parentId);

    const category = await this.repository.create(normalizedPayload);
    return category.toJSON();
  }

  async updateCategory(id, payload) {
    await this.getCategoryById(id);

    const normalizedPayload = await this.normalizePayload(payload);
    const duplicatedCategory = await this.repository.findBySlug(normalizedPayload.slug, id);

    if (duplicatedCategory) {
      throw new AppError("Category slug already exists.", 409, "CATEGORY_SLUG_EXISTS");
    }

    if (Number(normalizedPayload.parentId) === Number(id)) {
      throw new AppError("Category cannot be its own parent.", 422, "CATEGORY_PARENT_SELF_REFERENCE");
    }

    await this.ensureParentCategoryExists(normalizedPayload.parentId);
    await this.ensureParentIsNotDescendant(id, normalizedPayload.parentId);

    const category = await this.repository.update(id, normalizedPayload);
    return category.toJSON();
  }

  async updateCategoryStatus(id, status) {
    await this.getCategoryById(id);

    const normalizedStatus = String(status || "").trim().toLowerCase();

    if (!Object.values(CATEGORY_STATUS).includes(normalizedStatus)) {
      throw new AppError("Category status must be active or inactive.", 422, "INVALID_CATEGORY_STATUS");
    }

    const category = await this.repository.updateStatus(id, normalizedStatus);
    return category.toJSON();
  }

  async deleteCategory(id) {
    await this.getCategoryById(id);

    const productCount = await this.repository.countProductsByCategoryId(id);

    if (productCount > 0) {
      throw new AppError("Category still has products and cannot be deleted.", 409, "CATEGORY_HAS_PRODUCTS");
    }

    const deleted = await this.repository.softDelete(id);

    if (!deleted) {
      throw new AppError("Category could not be deleted.", 409, "CATEGORY_DELETE_FAILED");
    }

    return {
      id,
      deleted: true
    };
  }

  async normalizePayload(payload) {
    const name = String(payload.name).trim();
    const slug = payload.slug ? createSlug(payload.slug) : createSlug(name);

    return {
      name,
      slug,
      description: payload.description ? String(payload.description).trim() : null,
      parentId: payload.parentId || null,
      imageUrl: payload.imageUrl ? String(payload.imageUrl).trim() : null,
      status: payload.status || CATEGORY_STATUS.ACTIVE,
      sortOrder: Number(payload.sortOrder || 0)
    };
  }

  async ensureParentCategoryExists(parentId) {
    if (!parentId) {
      return;
    }

    const parentCategory = await this.repository.findById(parentId);

    if (!parentCategory) {
      throw new AppError("Parent category was not found.", 422, "PARENT_CATEGORY_NOT_FOUND");
    }
  }

  async ensureParentIsNotDescendant(categoryId, parentId) {
    if (!parentId) return;
    const descendantIds = await this.repository.findDescendantIds(categoryId);
    if (descendantIds.includes(Number(parentId))) {
      throw new AppError("Category parent cannot be one of its descendants.", 422, "CATEGORY_PARENT_DESCENDANT_REFERENCE");
    }
  }
}

export { CATEGORY_STATUS };
