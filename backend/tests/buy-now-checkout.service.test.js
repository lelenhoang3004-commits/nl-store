import test from "node:test";
import assert from "node:assert/strict";
import { CartService } from "../services/cart.service.js";
import { validateCheckoutRequest } from "../validators/cart.validator.js";

test("buy-now validator accepts exactly one product item", () => {
  const result = validateCheckoutRequest({
    body: {
      checkoutMode: "buy_now",
      items: [{ product_id: 9, variant_id: null, quantity: 1 }],
      customerName: "Nguyen Van A",
      customerEmail: "customer@example.com",
      customerPhone: "0912345678",
      shippingAddress: {
        receiver_name: "Nguyen Van A",
        receiver_phone: "0912345678",
        detail_address: "123 Nguyen Hue",
        province_name: "TP. Ho Chi Minh",
        ward_name: "Ben Nghe"
      },
      paymentMethod: "cod"
    }
  });

  assert.equal(result.isValid, true);
});

test("buy-now rebuilds price, sku and image from database product", async () => {
  const product = {
    id: 9,
    name: "Day chuyen",
    sku: "SP006",
    status: "active",
    stock: 5,
    price: 12000000,
    salePrice: 9999000,
    thumbnailUrl: "/uploads/red.webp",
    galleryUrls: ["/uploads/black.webp"]
  };
  const repository = {
    async findProductForUpdate() { return product; },
    async countActiveVariantsForProduct() { return 0; }
  };
  const service = new CartService(repository, {}, {});

  const [item] = await service.buildBuyNowItems([{
    product_id: 9,
    quantity: 2,
    unit_price: 1,
    selected_image_url: "/uploads/black.webp"
  }], {});

  assert.equal(item.unitPrice, 9999000);
  assert.equal(item.totalPrice, 19998000);
  assert.equal(item.productImageUrl, "/uploads/black.webp");
  assert.equal(item.productSku, "SP006");
});

test("buy-now requires a variant when the product has variants", async () => {
  const repository = {
    async findProductForUpdate() {
      return { id: 2, status: "active", stock: 10, price: 100000, thumbnailUrl: "/shirt.webp", galleryUrls: [] };
    },
    async countActiveVariantsForProduct() { return 2; }
  };
  const service = new CartService(repository, {}, {});

  await assert.rejects(
    service.buildBuyNowItems([{ product_id: 2, quantity: 1 }], {}),
    (error) => error.code === "CART_VARIANT_REQUIRED"
  );
});
