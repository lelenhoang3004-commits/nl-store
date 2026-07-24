import test from "node:test";
import assert from "node:assert/strict";
import { ProductRepository } from "../repositories/product.repository.js";

test("product search supports accent-insensitive keywords across product and category fields", () => {
  const repository = new ProductRepository({});
  const result = repository.buildWhereClause({
    search: { enabled: true, keyword: "đồng hồ|dong ho|watch|dong-ho" },
    filter: {}
  });

  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.name, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.slug, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.tags, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.description, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(c\.name, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(c\.slug, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /REPLACE\(/);
  assert.equal(result.params.length, 64);
  assert.ok(result.params.includes("%watch%"));
  assert.ok(result.params.includes("%dong-ho%"));
  assert.ok(result.params.includes("%dong ho%"));
});