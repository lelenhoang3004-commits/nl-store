-- Category showcase images. The current schema already has categories.image_url.
-- This only updates category avatar URLs and does not modify products.category_id, parent_id, or counts.

UPDATE categories
SET image_url = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
    updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND (slug = 'phu-kien-ca-nhan' OR name = 'Phụ kiện cá nhân');

UPDATE categories
SET image_url = 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80',
    updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND (slug IN ('quan-jeans', 'quan-jean') OR name IN ('Quần jeans', 'Quần jean'));

UPDATE categories
SET image_url = 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=900&q=80',
    updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND (slug = 'ao-len' OR name = 'Áo len');
