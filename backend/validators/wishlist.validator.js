import { validateId } from "./id.validator.js";

export function validateWishlistProductIdRequest({ params = {} }) {
  return validateId(params.productId, {
    required: true,
    field: "productId",
    location: "params"
  });
}
