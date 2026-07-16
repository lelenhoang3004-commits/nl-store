import test from "node:test";
import assert from "node:assert/strict";
import { AdminDashboardRepository } from "../repositories/admin-dashboard.repository.js";

test("dashboard revenue query uses the same date expression for SELECT, GROUP BY, and ORDER BY", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const repository = new AdminDashboardRepository({
    getPool() {
      return {
        async execute(sql, params = []) {
          capturedSql = sql;
          capturedParams = params;
          return [[], []];
        }
      };
    }
  });

  await repository.getRevenueByDateRange({
    dateFrom: "2026-07-11",
    dateTo: "2026-07-17"
  });

  const expression = "DATE_FORMAT(created_at, '%Y-%m-%d')";
  assert.match(capturedSql, new RegExp(`SELECT ${expression.replace(/[()]/g, "\\$&")}`));
  assert.match(capturedSql, new RegExp(`GROUP BY ${expression.replace(/[()]/g, "\\$&")}`));
  assert.match(capturedSql, new RegExp(`ORDER BY ${expression.replace(/[()]/g, "\\$&")} ASC`));
  assert.doesNotMatch(capturedSql, /GROUP BY DATE\(created_at\)/);
  assert.deepEqual(capturedParams, ["2026-07-11", "2026-07-17"]);
});