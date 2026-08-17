import test from "node:test";
import assert from "node:assert/strict";
import { CategoryRepository } from "../repositories/category.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { ProductService } from "../services/product.service.js";
import { validateProductListRequest } from "../validators/product.validator.js";

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

test("product list sanitizes pagination and does not bind LIMIT/OFFSET", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const repository = new ProductRepository({
    getPool() {
      return {
        async execute(sql, params) {
          capturedSql = sql;
          capturedParams = params;
          return [[], []];
        }
      };
    }
  });

  await repository.findAll({
    ...options,
    pagination: { limit: undefined, offset: undefined }
  });

  assert.match(capturedSql, /LIMIT 12 OFFSET 0/);
  assert.doesNotMatch(capturedSql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(capturedParams, ["active"]);
  assert.equal(capturedParams.includes(undefined), false);
});

test("category list sanitizes pagination and does not bind LIMIT/OFFSET", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const repository = new CategoryRepository({
    getPool() {
      return {
        async execute(sql, params) {
          capturedSql = sql;
          capturedParams = params;
          return [[], []];
        }
      };
    }
  });

  await repository.findAll({
    ...options,
    pagination: { limit: "invalid", offset: -1 }
  });

  assert.match(capturedSql, /LIMIT 20 OFFSET 0/);
  assert.doesNotMatch(capturedSql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(capturedParams, ["active"]);
  assert.equal(capturedParams.includes(undefined), false);
});

test("repository execute normalizes undefined SQL params", async () => {
  const received = [];
  const client = {
    getPool() {
      return {
        async execute(_sql, params) {
          received.push(params);
          return [[], []];
        }
      };
    }
  };

  await new ProductRepository(client).execute("SELECT ?", [undefined]);
  await new CategoryRepository(client).execute("SELECT ?", [undefined]);

  assert.deepEqual(received, [[null], [null]]);
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
test("product list validates optional card projection view", () => {
  assert.equal(validateProductListRequest({ query: {} }).isValid, true);
  assert.equal(validateProductListRequest({ query: { view: "card" } }).isValid, true);

  const result = validateProductListRequest({ query: { view: "full" } });
  assert.equal(result.isValid, false);
  assert.equal(result.errors.some((error) => error.code === "INVALID_PRODUCT_VIEW"), true);
});

test("product card projection selects lightweight columns only", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const repository = new ProductRepository({
    getPool() {
      return {
        async execute(sql, params) {
          capturedSql = sql;
          capturedParams = params;
          return [[{
            id: 1,
            name: "Card Product",
            slug: "card-product",
            sku: "CARD-1",
            category_id: 2,
            category_name: "Category",
            price: "100000",
            sale_price: null,
            stock: 5,
            sold: 3,
            rating_average: "4.5",
            status: "active",
            thumbnail_url: "https://cdn.example/product-thumb.webp"
          }], []];
        }
      };
    }
  });

  const products = await repository.findAllCardProjection(options);

  assert.equal(products.length, 1);
  assert.equal(products[0].thumbnailUrl, "https://cdn.example/product-thumb.webp");
  assert.equal(products[0].price, 100000);
  assert.match(capturedSql, /p\.thumbnail_url/);
  assert.doesNotMatch(capturedSql, /p\.description/);
  assert.doesNotMatch(capturedSql, /p\.gallery_urls/);
  assert.doesNotMatch(capturedSql, /p\.product_attributes/);
  assert.deepEqual(capturedParams, ["active"]);
});

test("variant card counts use customer visibility filter", async () => {
  let capturedSql = "";
  let capturedParams = [];
  const repository = new ProductVariantRepository({
    getPool() {
      return {
        async execute(sql, params) {
          capturedSql = sql;
          capturedParams = params;
          return [[{ product_id: 1, variant_count: 2 }], []];
        }
      };
    }
  });

  const counts = await repository.countByProductIds([1, 2], { customerOnly: true });

  assert.equal(counts.get(1), 2);
  assert.equal(counts.has(2), false);
  assert.match(capturedSql, /status = 'active'/);
  assert.deepEqual(capturedParams, [1, 2]);
});

test("product service card projection omits heavy fields and attaches variant counts", async () => {
  const repository = {
    async findAllCardProjection() {
      return [{
        id: 1,
        name: "Card Product",
        slug: "card-product",
        sku: "CARD-1",
        categoryId: 2,
        categoryName: "Category",
        price: 100000,
        salePrice: null,
        stock: 5,
        sold: 3,
        ratingAverage: 4.5,
        status: "active",
        thumbnailUrl: "https://cdn.example/product-thumb.webp"
      }];
    },
    async countAll() {
      return 1;
    }
  };
  const variantRepository = {
    async countByProductIds(productIds, options) {
      assert.deepEqual(productIds, [1]);
      assert.deepEqual(options, { customerOnly: true });
      return new Map([[1, 2]]);
    }
  };
  const service = new ProductService(repository, {}, {}, variantRepository);

  const result = await service.getProducts({ view: "card", status: "active", page: 1, limit: 8 });
  const product = result.products[0];

  assert.equal(product.variantCount, 2);
  assert.equal(product.hasVariants, true);
  assert.equal("description" in product, false);
  assert.equal("galleryUrls" in product, false);
  assert.equal("variants" in product, false);
  assert.equal(result.meta.pagination.totalItems, 1);
});