import test from "node:test";
import assert from "node:assert/strict";
import { WishlistService } from "../services/wishlist.service.js";
import { validateWishlistProductIdRequest } from "../validators/wishlist.validator.js";

test("wishlist validator reads productId from route params without requiring a body", () => {
  const result = validateWishlistProductIdRequest({ params: { productId: "9" } });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, []);
});

test("wishlist validator rejects a missing or invalid route productId", () => {
  assert.equal(validateWishlistProductIdRequest({ params: {} }).isValid, false);
  assert.equal(validateWishlistProductIdRequest({ params: { productId: "abc" } }).isValid, false);
});

test("empty wishlist returns an empty list instead of failing", async () => {
  const repository = {
    async findItemsByUserId() { return []; }
  };
  const service = new WishlistService(repository, {});

  assert.deepEqual(await service.getWishlist(7), { items: [], total: 0 });
});

test("adding an existing wishlist product remains idempotent", async () => {
  const items = [{ id: 9, name: "Dây chuyền" }];
  let insertCalls = 0;
  const repository = {
    async insert(userId, productId) {
      assert.equal(userId, 7);
      assert.equal(productId, 9);
      insertCalls += 1;
    },
    async findItemsByUserId() { return items; }
  };
  const productRepository = {
    async findById(productId) { return productId === 9 ? items[0] : null; }
  };
  const service = new WishlistService(repository, productRepository);

  assert.deepEqual(await service.addProduct(7, 9), { items, total: 1 });
  assert.deepEqual(await service.addProduct(7, 9), { items, total: 1 });
  assert.equal(insertCalls, 2);
});
