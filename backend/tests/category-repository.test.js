import test from 'node:test';
import assert from 'node:assert/strict';
import { CategoryRepository } from '../repositories/category.repository.js';

test('buildWhereClause uses table-qualified deleted_at and status filters', () => {
  const repository = new CategoryRepository();

  const { whereSql, params } = repository.buildWhereClause({
    search: { enabled: true, keyword: 'ao' },
    filter: { status: 'active' },
    sort: {},
    pagination: {}
  });

  assert.match(whereSql, /c\.deleted_at IS NULL/);
  assert.match(whereSql, /c\.name LIKE/);
  assert.match(whereSql, /c\.status = \?/);
  assert.deepEqual(params, ['%ao%', '%ao%', 'active']);
});
