/**
 * Cart controller.
 * It handles customer cart reads and add-to-cart actions.
 */
import { BaseController } from "./base.controller.js";
import { CartService } from "../services/cart.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class CartController extends BaseController {
  constructor(service = new CartService()) {
    super();
    this.service = service;
  }

  show = asyncHandler(async (request, response) => {
    const cart = await this.service.getCart(request.user.id);

    return this.sendSuccess(response, {
      cart
    }, "Cart retrieved successfully.");
  });

  addItem = asyncHandler(async (request, response) => {
    const cart = await this.service.addItem(request.user.id, request.body);

    return this.sendSuccess(response, {
      cart
    }, "Product added to cart.", 201);
  });

  updateItem = asyncHandler(async (request, response) => {
    const cart = await this.service.updateItemQuantity(request.user.id, request.params.itemId, request.body.quantity);

    return this.sendSuccess(response, {
      cart
    }, "Cart item updated successfully.");
  });

  deleteItem = asyncHandler(async (request, response) => {
    const cart = await this.service.removeItem(request.user.id, request.params.itemId);

    return this.sendSuccess(response, {
      cart
    }, "Cart item removed successfully.");
  });

  selectItem = asyncHandler(async (request, response) => {
    const cart = await this.service.updateItemSelection(request.user.id, request.params.itemId, request.body.isSelected);

    return this.sendSuccess(response, {
      cart
    }, "Cart item selection updated successfully.");
  });

  selectAll = asyncHandler(async (request, response) => {
    const cart = await this.service.updateAllSelection(request.user.id, request.body.isSelected);

    return this.sendSuccess(response, {
      cart
    }, "Cart selection updated successfully.");
  });

  checkout = asyncHandler(async (request, response) => {
    const result = await this.service.checkout(request.user.id, request.body);

    return this.sendSuccess(response, result, "Order placed successfully.", 201);
  });
}
