/**
 * Wishlist controller.
 */
import { BaseController } from "./base.controller.js";
import { WishlistService } from "../services/wishlist.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class WishlistController extends BaseController {
  constructor(service = new WishlistService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getWishlist(request.user.id);

    return this.sendSuccess(
      response,
      {
        wishlist: result.items,
        total: result.total
      },
      "Wishlist retrieved successfully."
    );
  });

  store = asyncHandler(async (request, response) => {
    const result = await this.service.addProduct(request.user.id, Number(request.params.productId));

    return this.sendSuccess(
      response,
      {
        wishlist: result.items,
        total: result.total
      },
      "Product added to wishlist.",
      201
    );
  });

  destroy = asyncHandler(async (request, response) => {
    const result = await this.service.removeProduct(request.user.id, Number(request.params.productId));

    return this.sendSuccess(
      response,
      {
        wishlist: result.items,
        total: result.total
      },
      "Product removed from wishlist."
    );
  });
}
