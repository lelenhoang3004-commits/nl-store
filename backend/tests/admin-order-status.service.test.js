import test from "node:test";
import assert from "node:assert/strict";
import { AdminOrderService } from "../services/admin-order.service.js";

function createService(initialStatus = "pending", options = {}) {
  const state = {
    order: { id: 10, orderCode: "NL0010", status: initialStatus, toJSON() { return { id: this.id, orderCode: this.orderCode, status: this.status }; } },
    histories: [],
    failOnStatus: options.failOnStatus || null
  };
  const repository = {
    async findById() { return state.order; },
    async findItemsByOrderId() { return []; },
    async findPaymentByOrderId() { return []; },
    async findHistoriesByOrderId() { return state.histories.map((item, index) => ({ ...item, id: index + 1, toJSON() { return this; } })); },
    async updateStatus(orderId, status) {
      if (status === state.failOnStatus) throw new Error(`failed at ${status}`);
      state.order.status = status;
      return true;
    },
    async createOrderHistory(payload) { state.histories.push({ ...payload, createdAt: new Date().toISOString() }); },
    async restoreInventory() {},
    async updateCancelled() { state.order.status = "cancelled"; }
  };
  const transactionRunner = async (callback) => {
    const snapshot = { status: state.order.status, histories: state.histories.slice() };
    try {
      return await callback({});
    } catch (error) {
      state.order.status = snapshot.status;
      state.histories = snapshot.histories;
      throw error;
    }
  };
  const notifications = { notifyAdmin: async () => {} };
  return { service: new AdminOrderService(repository, notifications, transactionRunner), state };
}

test("admin order status can jump forward and writes each intermediate history", async () => {
  const { service, state } = createService("pending");
  const detail = await service.updateOrderStatus(10, "completed", { id: 7 });

  assert.equal(detail.order.status, "completed");
  assert.deepEqual(state.histories.map((item) => item.status), ["confirmed", "processing", "shipping", "completed"]);
  assert.equal(new Set(state.histories.map((item) => item.changedBy)).size, 1);
  assert.equal(state.histories[0].changedBy, 7);
  assert.match(state.histories[0].note, /Tự động hoàn tất bước trung gian/);
});

test("admin order status rejects backward transitions", async () => {
  const { service } = createService("shipping");
  await assert.rejects(() => service.updateOrderStatus(10, "confirmed", { id: 7 }), /Order status transition is not allowed/);
});

test("admin order status rejects terminal status updates", async () => {
  const completed = createService("completed");
  await assert.rejects(() => completed.service.updateOrderStatus(10, "shipping", { id: 7 }), /Order status transition is not allowed/);

  const cancelled = createService("cancelled");
  await assert.rejects(() => cancelled.service.updateOrderStatus(10, "completed", { id: 7 }), /Order status transition is not allowed/);
});

test("admin order status requires cancel flow for cancelled target", async () => {
  const { service } = createService("pending");
  await assert.rejects(() => service.updateOrderStatus(10, "cancelled", { id: 7 }), /Use the order cancellation flow/);
});

test("admin order status rolls back all intermediate steps when a later step fails", async () => {
  const { service, state } = createService("pending", { failOnStatus: "shipping" });
  await assert.rejects(() => service.updateOrderStatus(10, "completed", { id: 7 }), /failed at shipping/);
  assert.equal(state.order.status, "pending");
  assert.deepEqual(state.histories, []);
});

test("admin order status does not duplicate history when target is already current", async () => {
  const { service, state } = createService("completed");
  const detail = await service.updateOrderStatus(10, "completed", { id: 7 });
  assert.equal(detail.order.status, "completed");
  assert.deepEqual(state.histories, []);
});
