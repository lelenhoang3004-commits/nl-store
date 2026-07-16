/**
 * Wishlist service.
 * It contains business rules and validation for wishlist actions.
 */
import { WishlistRepository } from "../repositories/wishlist.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";

export class WishlistService extends BaseService {
  constructor(repository = new WishlistRepository(), productRepository = new ProductRepository()) {
    super(repository);
    this.productRepository = productRepository;
  }

  async getWishlist(userId) {
    const items = await this.repository.findItemsByUserId(userId);
    const total = items.length;
    return { items, total };
  }

  async addProduct(userId, productId) {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new AppError("Product was not found.", 404, "PRODUCT_NOT_FOUND");
    }

    await this.repository.insert(userId, productId);
    return this.getWishlist(userId);
  }

  async removeProduct(userId, productId) {
    await this.repository.deleteByUserAndProduct(userId, productId);
    return this.getWishlist(userId);
  }

  async getProductIds(userId) {
    const rows = await this.repository.findProductIdsByUserId(userId);
    return rows.map((row) => Number(row.productId));
  }
}
