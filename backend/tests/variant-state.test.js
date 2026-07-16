import test from 'node:test';
import assert from 'node:assert/strict';
import { syncProductVariantState } from '../../frontend/admin/products/variant-state.js';

test('syncProductVariantState updates the current product and list count after a variant refresh', () => {
  const state = {
    items: [
      { id: 8, name: 'Áo khoác', variantCount: 0 },
      { id: 9, name: 'Quần', variantCount: 2 }
    ],
    detail: { id: 8, name: 'Áo khoác', variantCount: 0 }
  };

  const refreshed = {
    id: 8,
    name: 'Áo khoác',
    variantCount: 3,
    variants: [{ id: 1 }, { id: 2 }, { id: 3 }]
  };

  const nextState = syncProductVariantState(state, refreshed);

  assert.equal(nextState.items[0].variantCount, 3);
  assert.equal(nextState.detail.variantCount, 3);
  assert.equal(nextState.items[0].variants.length, 3);
  assert.equal(nextState.items[1].variantCount, 2);
});
