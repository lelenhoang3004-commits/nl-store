import test from "node:test";
import assert from "node:assert/strict";
import { ProductRepository } from "../repositories/product.repository.js";

test("product search supports accent-insensitive keywords across product and category fields", () => {
  const repository = new ProductRepository({});
  const result = repository.buildWhereClause({
    search: { enabled: true, keyword: "Ä‘á»“ng há»“|dong ho|watch|dong-ho" },
    filter: {}
  });

  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.name, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.slug, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.tags, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.description, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(c\.name, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(c\.slug, ''\)\) LIKE LOWER\(\?\)/);
  assert.match(result.whereSql, /REPLACE\(/);
  assert.equal(result.params.length, 76);
  assert.ok(result.params.includes("%watch%"));
  assert.ok(result.params.includes("%dong-ho%"));
  assert.ok(result.params.includes("%dong ho%"));
});
test("product category filter matches direct category, product name, and tags", () => {
  const repository = new ProductRepository({});
  const result = repository.buildWhereClause({
    search: { enabled: false, keyword: "" },
    filter: {
      status: "active",
      categoryId: "7",
      categoryIds: [7, 8],
      categoryMatch: { name: "  Qu\u1ea7n n\u1eef  ", slug: "quan-nu" }
    }
  });

  assert.match(result.whereSql, /p\.status = \?/);
  assert.match(result.whereSql, /\(p\.category_id IN \(\?, \?\) OR \(/);
  assert.match(result.whereSql, /LOWER\(COALESCE\(p\.name, ''\)\) LIKE \?/);
  assert.match(result.whereSql, /LOWER\(TRIM\(REPLACE\(COALESCE\(p\.tags, ''\), '#', ''\)\)\) LIKE \?/);
  assert.deepEqual(result.params, ["active", 7, 8, "%qu\u1ea7n n\u1eef%", "%qu\u1ea7n n\u1eef%", "%quan-nu%", "%quan-nu%"]);
});