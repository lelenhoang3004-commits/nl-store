import test from "node:test";
import assert from "node:assert/strict";
import { ProductRepository } from "../repositories/product.repository.js";

test("product search supports synonym groups across product and category fields", () => {
  const repository = new ProductRepository({});
  const result = repository.buildWhereClause({
    search: { enabled: true, keyword: "đồng hồ|dong ho|watch|dong-ho" },
    filter: {}
  });

  assert.match(result.whereSql, /p\.name LIKE \?/);
  assert.match(result.whereSql, /p\.slug LIKE \?/);
  assert.match(result.whereSql, /p\.tags LIKE \?/);
  assert.match(result.whereSql, /p\.description LIKE \?/);
  assert.match(result.whereSql, /c\.name LIKE \?/);
  assert.equal(result.params.length, 32);
  assert.ok(result.params.includes("%watch%"));
  assert.ok(result.params.includes("%dong-ho%"));
});
