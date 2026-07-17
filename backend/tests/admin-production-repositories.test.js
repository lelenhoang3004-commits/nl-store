import test from "node:test";
import assert from "node:assert/strict";
import { AdminDashboardRepository } from "../repositories/admin-dashboard.repository.js";
import { AdminOrderRepository } from "../repositories/admin-order.repository.js";
import { PaymentRepository } from "../repositories/payment.repository.js";
import { UserRepository } from "../repositories/user.repository.js";
import { VoucherRepository } from "../repositories/voucher.repository.js";
import { NewsletterRepository } from "../repositories/newsletter.repository.js";
import { sanitizePagination } from "../utils/sql-query.util.js";

const listOptions = {
  search: { enabled: false, keyword: "" },
  filter: {},
  sort: { field: "createdAt", direction: "desc" },
  pagination: { limit: "10", offset: "0" }
};

function createCaptureClient(rows = []) {
  const calls = [];
  return {
    calls,
    client: {
      getPool() {
        return {
          async execute(sql, params = []) {
            calls.push({ sql, params });
            return [rows, []];
          }
        };
      }
    }
  };
}

function assertSafeListQuery(call, limit = 10, offset = 0) {
  assert.match(call.sql, new RegExp(`LIMIT ${limit} OFFSET ${offset}`));
  assert.doesNotMatch(call.sql, /LIMIT \?|OFFSET \?/);
  assert.equal(call.params.includes(undefined), false);
}

test("admin order list sanitizes Railway pagination", async () => {
  const capture = createCaptureClient();
  const repository = new AdminOrderRepository(capture.client);
  await repository.findAll({ search: "", sortBy: "createdAt", sortDirection: "desc", limit: "10", offset: undefined });
  assertSafeListQuery(capture.calls[0]);
});

test("admin payment transaction list sanitizes Railway pagination", async () => {
  const capture = createCaptureClient();
  await new PaymentRepository(capture.client).findTransactions(listOptions);
  assertSafeListQuery(capture.calls[0]);
});

test("admin user list sanitizes Railway pagination", async () => {
  const capture = createCaptureClient();
  await new UserRepository(capture.client).findAll(listOptions);
  assertSafeListQuery(capture.calls[0]);
});

test("admin voucher list sanitizes Railway pagination", async () => {
  const capture = createCaptureClient();
  await new VoucherRepository(capture.client).findAll(listOptions);
  assertSafeListQuery(capture.calls[0]);
});

test("admin newsletter list sanitizes Railway pagination", async () => {
  const capture = createCaptureClient();
  await new NewsletterRepository(capture.client).findAll(listOptions);
  assertSafeListQuery(capture.calls.at(-1));
});

test("dashboard limits are sanitized and interpolated", async () => {
  const capture = createCaptureClient();
  const repository = new AdminDashboardRepository(capture.client);
  await repository.getTopProducts("5");
  await repository.getRecentOrders("10");
  assert.match(capture.calls[0].sql, /LIMIT 5/);
  assert.match(capture.calls[1].sql, /LIMIT 10/);
  assert.deepEqual(capture.calls[0].params, []);
  assert.deepEqual(capture.calls[1].params, []);
});

test("pagination sanitizer clamps invalid production input", () => {
  assert.deepEqual(sanitizePagination(undefined, undefined), { limit: 10, offset: 0 });
  assert.deepEqual(sanitizePagination(999, -5), { limit: 100, offset: 0 });
  assert.deepEqual(sanitizePagination("12.9", "3.8"), { limit: 12, offset: 3 });
});
