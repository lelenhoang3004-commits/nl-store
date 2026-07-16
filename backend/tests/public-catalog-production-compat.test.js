import test from "node:test";
import assert from "node:assert/strict";
import { CategoryRepository } from "../repositories/category.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { ProductVariantRepository } from "../repositories/product-variant.repository.js";

const options = {
  search: { enabled: false, keyword: "" },
  filter: { status: "active" },
  sort: { field: "createdAt", direction: "desc" },
  pagination: { limit: 10, offset: 0 }
};

test("category list qualifies sort columns in joined production query", async () => {
  let sql = "";
  const repository = new CategoryRepository({
    getPool() {
      return {
        async execute(query) {
          sql = query;
          return [[], []];
        }
      };
    }
  });

  await repository.findAll(options);
  assert.match(sql, /ORDER BY c\.created_at DESC/);
  assert.doesNotMatch(sql, /ORDER BY created_at DESC/);
});

test("product list falls back when Railway schema lacks product_attributes", async () => {
  const queries = [];
  const repository = new ProductRepository({
    getPool() {
      return {
        async execute(sql) {
          queries.push(sql);
          if (queries.length === 1) {
            const error = new Error("Unknown column 'p.product_attributes'");
            error.code = "ER_BAD_FIELD_ERROR";
            error.sqlMessage = "Unknown column 'p.product_attributes' in 'field list'";
            throw error;
          }
          return [[{ id: 1, name: "Product", status: "active" }], []];
        }
      };
    }
  });

  const products = await repository.findAll(options);
  assert.equal(products.length, 1);
  assert.equal(queries.length, 2);
  assert.match(queries[0], /p\.product_attributes/);
  assert.match(queries[1], /NULL AS product_attributes/);
});

test("public product list tolerates unavailable optional variant schema", async () => {
  const repository = new ProductVariantRepository({});
  repository.ensureSchema = async () => {
    const error = new Error("CREATE command denied");
    error.code = "ER_TABLEACCESS_DENIED_ERROR";
    throw error;
  };

  const variants = await repository.findByProductIds([1, 2], { customerOnly: true });
  assert.equal(variants.size, 0);
});