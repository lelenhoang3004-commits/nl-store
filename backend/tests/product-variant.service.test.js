import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductVariantService } from '../services/product-variant.service.js';
import { AppError } from '../utils/app-error.util.js';

test('createVariant converts duplicate database errors into a conflict response', async () => {
  const repository = {
    create: async () => {
      const error = new Error('Duplicate entry');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    },
    findBySku: async () => null,
    findByProductColorSize: async () => null,
    syncProductInventory: async () => {},
    findById: async () => null,
    findByProductId: async () => []
  };

  const productRepository = {
    findById: async () => ({ id: 7 })
  };

  const service = new ProductVariantService(repository, productRepository);

  await assert.rejects(
    () => service.createVariant(7, { sku: 'TEST-SKU', size: 'S', color: 'Blue', stock: 1, status: 'active' }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'VARIANT_DUPLICATE_EXISTS');
      return true;
    }
  );
});
