import { BaseService } from "./base.service.js";

class ProductService extends BaseService {
  constructor() { super("/admin/products"); }
  listProducts(params = {}, options = {}) { return this.list(params, options); }
  getProductById(id, options = {}) { return this.getById(id, options); }
  createProduct(payload, options = {}) { return this.create(payload, options); }
  updateProduct(id, payload, options = {}) { return this.client.patch(this.path(id), payload, options); }
  updateStock(id, payload, options = {}) { return this.client.patch(this.path(id, "stock"), payload, options); }
  updateStatus(id, status, options = {}) { return this.client.patch(this.path(id, "status"), { status }, options); }
  deleteProduct(id, options = {}) { return this.remove(id, options); }
  getVariants(id, options = {}) { return this.client.get(this.path(id, "variants"), options); }
  createVariant(id, payload, options = {}) { return this.client.post(this.path(id, "variants"), payload, options); }
  updateVariant(id, variantId, payload, options = {}) { return this.client.patch(this.path(id, "variants", variantId), payload, options); }
  updateVariantStock(id, variantId, payload, options = {}) { return this.client.patch(this.path(id, "variants", variantId, "stock"), payload, options); }
  updateVariantStatus(id, variantId, status, options = {}) { return this.client.patch(this.path(id, "variants", variantId, "status"), { status }, options); }
  deleteVariant(id, variantId, options = {}) { return this.client.delete(this.path(id, "variants", variantId), options); }
}

export const productService = new ProductService();
export { ProductService };
