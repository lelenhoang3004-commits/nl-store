import { BaseService } from "./base.service.js";

// Category API service used by admin category screens.
class CategoryService extends BaseService {
  constructor() {
    super("/admin/categories");
  }

  getAll(params = {}, options = {}) {
    return this.list(params, options);
  }

  uploadImage(id, file, options = {}) {
    const formData = new FormData();
    formData.append("image", file);
    return this.upload(`${id}/image`, formData, options);
  }

  exportFile(params = {}, options = {}) {
    return this.download("export", params, options);
  }
}

export const categoryService = new CategoryService();
export { CategoryService };
