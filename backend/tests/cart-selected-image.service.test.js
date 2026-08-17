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

test("getCart hydrates current stock in batch while preserving response shape and order", async () => {
  const calls = { products: [], variants: [] };
  const cartPayload = {
    id: 1,
    userId: 7,
    status: "active",
    totalQuantity: 13,
    subtotal: 1300,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    items: [
      { id: 1, productId: 101, variantId: null, quantity: 1, productName: "Base A" },
      { id: 2, productId: 102, variantId: "201", quantity: 2, productName: "Variant A" },
      { id: 3, productId: 101, variantId: null, quantity: 3, productName: "Base A duplicate" },
      { id: 4, productId: 103, variantId: "202", quantity: 4, productName: "Variant stock zero" },
      { id: 5, productId: 104, variantId: "999", quantity: 5, productName: "Missing variant" },
      { id: 6, productId: 999, variantId: null, quantity: 6, productName: "Missing product" },
      { id: 7, productId: 105, variantId: "201", quantity: 99, productName: "Variant duplicate and quantity over stock" }
    ]
  };
  const repository = {
    async findActiveCartByUserId() {
      return { toJSON: () => structuredClone(cartPayload) };
    },
    async findProductsByIds(ids) {
      calls.products.push(ids);
      return new Map([
        [101, { id: 101, stock: 8 }]
      ]);
    }
  };
  const variantRepository = {
    async findByIds(ids) {
      calls.variants.push(ids);
      return new Map([
        [201, { id: 201, stock: 5 }],
        [202, { id: 202, stock: 0 }]
      ]);
    }
  };
  const service = new CartService(repository, variantRepository);

  const result = await service.getCart(7);

  assert.deepEqual(calls.products, [[101, 999]]);
  assert.deepEqual(calls.variants, [[201, 202, 999]]);
  assert.deepEqual(result.items.map((item) => item.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(result.items[0].productStock, 8);
  assert.equal(result.items[1].variantStock, 5);
  assert.equal(result.items[2].productStock, 8);
  assert.equal(result.items[3].variantStock, 0);
  assert.equal(result.items[4].variantStock, 0);
  assert.equal(result.items[5].productStock, 0);
  assert.equal(result.items[6].variantStock, 5);
  assert.equal(result.items[6].quantity, 99);
  assert.equal(result.items[0].productName, "Base A");
  assert.equal(result.totalQuantity, 13);
  assert.equal(result.subtotal, 1300);
});

test("getCart does not query batch stock repositories for an empty cart", async () => {
  const repository = {
    async findActiveCartByUserId() {
      return {
        toJSON: () => ({
          id: 1,
          userId: 7,
          status: "active",
          items: [],
          totalQuantity: 0,
          subtotal: 0,
          createdAt: null,
          updatedAt: null
        })
      };
    },
    async findProductsByIds() {
      throw new Error("products should not be queried for an empty cart");
    }
  };
  const variantRepository = {
    async findByIds() {
      throw new Error("variants should not be queried for an empty cart");
    }
  };
  const service = new CartService(repository, variantRepository);

  const result = await service.getCart(7);

  assert.deepEqual(result.items, []);
});
