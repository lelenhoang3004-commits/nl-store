-- Add category parent-child support and attach personal accessory children.
-- This migration preserves existing products.category_id values.

SET @has_parent_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'parent_id'
);
SET @sql := IF(
  @has_parent_id = 0,
  'ALTER TABLE categories ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER description',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_parent_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'parent_id'
);
SET @sql := IF(
  @has_parent_index = 0,
  'CREATE INDEX idx_categories_parent_id ON categories (parent_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_parent_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'parent_id'
    AND REFERENCED_TABLE_NAME = 'categories'
    AND REFERENCED_COLUMN_NAME = 'id'
);
SET @sql := IF(
  @has_parent_fk = 0,
  'ALTER TABLE categories ADD CONSTRAINT fk_categories_parent_self FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO categories (name, slug, description, parent_id, status, sort_order)
SELECT 'Phụ kiện cá nhân', 'phu-kien-ca-nhan', 'Nhóm danh mục phụ kiện cá nhân.', NULL, 'active', 90
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE slug = 'phu-kien-ca-nhan' AND deleted_at IS NULL
);

SET @accessory_parent_id := (
  SELECT id
  FROM categories
  WHERE slug = 'phu-kien-ca-nhan' AND deleted_at IS NULL
  ORDER BY id
  LIMIT 1
);

INSERT INTO categories (name, slug, description, parent_id, status, sort_order)
SELECT 'Túi xách', 'tui-xach', 'Túi xách và ví thời trang.', @accessory_parent_id, 'active', 91
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'tui-xach' AND deleted_at IS NULL);

INSERT INTO categories (name, slug, description, parent_id, status, sort_order)
SELECT 'Đồng hồ', 'dong-ho', 'Đồng hồ thời trang.', @accessory_parent_id, 'active', 92
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'dong-ho' AND deleted_at IS NULL);

INSERT INTO categories (name, slug, description, parent_id, status, sort_order)
SELECT 'Trang sức', 'trang-suc', 'Trang sức và phụ kiện kim loại.', @accessory_parent_id, 'active', 93
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'trang-suc' AND deleted_at IS NULL);

INSERT INTO categories (name, slug, description, parent_id, status, sort_order)
SELECT 'Kính mắt', 'kinh-mat', 'Kính mắt thời trang.', @accessory_parent_id, 'active', 94
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'kinh-mat' AND deleted_at IS NULL);

INSERT INTO categories (name, slug, description, parent_id, status, sort_order)
SELECT 'Mũ nón', 'mu-non', 'Mũ nón và phụ kiện đội đầu.', @accessory_parent_id, 'active', 95
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'mu-non' AND deleted_at IS NULL);

UPDATE categories
SET parent_id = @accessory_parent_id,
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN ('tui-xach', 'dong-ho', 'trang-suc', 'kinh-mat', 'mu-non')
  AND deleted_at IS NULL
  AND id <> @accessory_parent_id;
