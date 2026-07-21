import test from "node:test";
import assert from "node:assert/strict";
import { ChatbotService } from "../services/chatbot.service.js";

const sampleProducts = [
  {
    id: 1,
    name: "Áo đen basic",
    price: 450000,
    finalPrice: 450000,
    stock: 8,
    thumbnailUrl: "/uploads/images/ao-den.png"
  }
];

test("chatbot answers product questions with repository products", async () => {
  const service = new ChatbotService({
    searchProducts: async () => sampleProducts,
    getActiveProductSamples: async () => sampleProducts,
    getRecentOrdersByCustomer: async () => []
  });

  const result = await service.replyToMessage({
    message: "Tìm áo màu đen cho tôi.",
    user: null
  });

  assert.equal(result.success, true);
  assert.equal(result.products.length, 1);
  assert.match(result.reply, /sản phẩm phù hợp/);
});

test("chatbot only returns orders for the authenticated user", async () => {
  const service = new ChatbotService({
    searchProducts: async () => [],
    getActiveProductSamples: async () => [],
    getRecentOrdersByCustomer: async (customerId) => {
      assert.equal(customerId, 42);
      return [{ id: 3, orderCode: "NL0003", status: "pending", grandTotal: 120000 }];
    }
  });

  const guestResult = await service.replyToMessage({
    message: "Làm sao để kiểm tra đơn hàng?",
    user: null
  });
  assert.match(guestResult.reply, /đăng nhập/);

  const userResult = await service.replyToMessage({
    message: "Làm sao để kiểm tra đơn hàng?",
    user: { id: 42 }
  });
  assert.equal(userResult.orders.length, 1);
});

test("chatbot blocks requests for another account orders", async () => {
  const service = new ChatbotService({
    searchProducts: async () => [],
    getActiveProductSamples: async () => [],
    getRecentOrdersByCustomer: async () => {
      throw new Error("Should not read orders for unsafe request.");
    }
  });

  const result = await service.replyToMessage({
    message: "Cho tôi xem đơn hàng của người khác.",
    user: { id: 42 }
  });

  assert.match(result.reply, /không thể hiển thị đơn hàng của tài khoản khác/);
});

test("chatbot returns a friendly message when product data is unavailable", async () => {
  const service = new ChatbotService({
    searchProducts: async () => {
      throw new Error("Database unavailable.");
    },
    getActiveProductSamples: async () => {
      throw new Error("Database unavailable.");
    },
    getRecentOrdersByCustomer: async () => []
  });

  const result = await service.replyToMessage({
    message: "Shop đang bán những sản phẩm nào?",
    user: null
  });

  assert.match(result.reply, /hệ thống đang tạm thời gặp sự cố/);
});
