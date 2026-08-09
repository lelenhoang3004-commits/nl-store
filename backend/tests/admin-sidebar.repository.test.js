import assert from "node:assert/strict";
import test from "node:test";
import { AdminSidebarRepository } from "../repositories/admin-sidebar.repository.js";

test("sidebar pending payment count guards JSON metadata before extracting customer report date", async () => {
  class RepositoryUnderTest extends AdminSidebarRepository {
    async execute(sql) {
      this.sql = sql;
      return [[{ total: 3 }]];
    }
  }

  const repository = new RepositoryUnderTest();
  const total = await repository.countPendingPayments();

  assert.equal(total, 3);
  assert.match(repository.sql, /JSON_VALID\(pt\.metadata\)/);
  assert.match(repository.sql, /CASE\s+WHEN JSON_VALID\(pt\.metadata\)/);
});
