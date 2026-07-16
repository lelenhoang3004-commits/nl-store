import test from "node:test";
import assert from "node:assert/strict";
import { CartService } from "../services/cart.service.js";
import { validateAddCartItemRequest } from "../validators/cart.validator.js";

test("cart accepts snake_case base product payload and preserves selected image", () => {
  const service = new CartService();
  const payload = service.normalizeAddItemPayload({
    product_id: 9,
    quantity: 1,
    variant_id: null,
    size: null,
    color: null,
    selected_image_url: "http://127.0.0.1:5500/uploads/watch-black.webp"
  });
  assert.equal(payload.productId, 9);
  assert.equal(payload.variantId, null);
  assert.equal(payload.selectedImageUrl, "http://127.0.0.1:5500/uploads/watch-black.webp");
});

test("selected image must belong to product thumbnail or gallery", () => {
  const service = new CartService();
  const product = {
    thumbnailUrl: "/uploads/watch-red.webp",
    galleryUrls: ["/uploads/watch-black.webp"]
  };
  assert.equal(
    service.resolveProductImage(product, "http://127.0.0.1:5500/uploads/watch-black.webp"),
    "/uploads/watch-black.webp"
  );
  assert.throws(
    () => service.resolveProductImage(product, "http://127.0.0.1:5500/uploads/not-owned.webp"),
    (error) => error.code === "CART_SELECTED_IMAGE_INVALID"
  );
  assert.equal(service.resolveProductImage(product, null), "/uploads/watch-red.webp");
});

test("cart validator accepts product_id and selected_image_url", () => {
  const result = validateAddCartItemRequest({
    body: { product_id: 9, quantity: 1, selected_image_url: "/uploads/watch-black.webp" }
  });
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, []);
});
