import test from "node:test";
import assert from "node:assert/strict";

import { VoucherService } from "../services/voucher.service.js";

const service = new VoucherService({}, {});

test("voucher normalizes percentage and fixed_amount payloads", () => {
  const percentage = service.normalizePayload({
    code: " sale10 ",
    name: "Sale 10",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 100000,
    maxDiscountAmount: 50000,
    quantity: 20,
    status: "active"
  }, null, { creating: true });

  assert.equal(percentage.code, "SALE10");
  assert.equal(percentage.discountType, "percentage");
  assert.equal(percentage.usedQuantity, 0);

  const fixed = service.normalizePayload({
    code: "FIX50",
    name: "Fixed 50",
    discountType: "fixed_amount",
    discountValue: 50000,
    maxDiscountAmount: 100000,
    quantity: 5,
    status: "active"
  }, null, { creating: true });

  assert.equal(fixed.discountType, "fixed_amount");
  assert.equal(fixed.maxDiscountAmount, null);
});

test("voucher rejects invalid date range and invalid quantity", () => {
  assert.throws(() => service.normalizePayload({
    code: "BADDATE",
    name: "Bad Date",
    discountType: "percentage",
    discountValue: 10,
    quantity: 1,
    startsAt: "2026-07-24T00:00:00.000Z",
    expiresAt: "2026-07-23T00:00:00.000Z"
  }, null, { creating: true }), { code: "VOUCHER_DATE_RANGE_INVALID" });

  assert.throws(() => service.normalizePayload({
    code: "BADQTY",
    name: "Bad Quantity",
    discountType: "fixed_amount",
    discountValue: 10000,
    quantity: 0
  }, null, { creating: true }), { code: "INVALID_VOUCHER_INTEGER" });
});

test("voucher update preserves usedQuantity and blocks quantity below usedQuantity", () => {
  const current = {
    code: "USED10",
    name: "Used",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    quantity: 10,
    usedQuantity: 4,
    status: "active",
    conditions: null
  };

  const updated = service.normalizePayload({ name: "Used Updated", quantity: 8 }, current, { creating: false });
  assert.equal(updated.usedQuantity, 4);
  assert.equal(updated.quantity, 8);

  assert.throws(() => service.normalizePayload({ quantity: 3 }, current, { creating: false }), { code: "VOUCHER_QUANTITY_LESS_THAN_USED" });
});

test("voucher validates min order, max discount, expired and usage limit", () => {
  const voucher = {
    code: "SALE20",
    status: "active",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 100000,
    maxDiscountAmount: 30000,
    quantity: 10,
    usedQuantity: 0,
    startsAt: null,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    conditions: null
  };

  assert.throws(() => service.validateVoucherRules(voucher, 90000), { code: "VOUCHER_MIN_ORDER_NOT_MET" });
  const result = service.validateVoucherRules(voucher, 500000);
  assert.equal(result.discountAmount, 30000);

  assert.throws(() => service.validateVoucherRules({ ...voucher, expiresAt: new Date(Date.now() - 86400000).toISOString() }, 500000), { code: "VOUCHER_EXPIRED" });
  assert.throws(() => service.validateVoucherRules({ ...voucher, usedQuantity: 10 }, 500000), { code: "VOUCHER_USAGE_LIMIT_EXCEEDED" });
});
