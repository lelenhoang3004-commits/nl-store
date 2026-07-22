SET @has_recipient := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'recipient_user_id'
);
SET @sql := IF(@has_recipient = 0, 'ALTER TABLE notifications ADD COLUMN recipient_user_id BIGINT UNSIGNED NULL AFTER user_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_related := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'related_id'
);
SET @sql := IF(@has_related = 0, 'ALTER TABLE notifications ADD COLUMN related_id BIGINT UNSIGNED NULL AFTER link', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_expires := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'expires_at'
);
SET @sql := IF(@has_expires = 0, 'ALTER TABLE notifications ADD COLUMN expires_at DATETIME NULL AFTER related_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_status := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'status'
);
SET @sql := IF(@has_status = 0, 'ALTER TABLE notifications ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT ''active'' AFTER expires_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_event := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'event_key'
);
SET @sql := IF(@has_event = 0, 'ALTER TABLE notifications ADD COLUMN event_key VARCHAR(160) NULL AFTER dedupe_key', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE notifications
SET recipient_user_id = COALESCE(recipient_user_id, user_id),
  event_key = COALESCE(event_key, dedupe_key),
  status = COALESCE(status, 'active');

UPDATE notifications
SET type = CASE
  WHEN UPPER(type) IN (
    'ORDER_CREATED','ORDER_CANCELLED','PAYMENT_UPDATED','VOUCHER_EXPIRED','VOUCHER_EXPIRING',
    'PRODUCT_OUT_OF_STOCK','LOW_STOCK','CUSTOMER_FEEDBACK','SYSTEM_ERROR',
    'PROMOTION','NEW_PRODUCT','NEW_VOUCHER','NEW_ARRIVAL','WISHLIST_PRICE_DROP',
    'WISHLIST_NEW_VARIANT','EVENT','COLLECTION'
  ) THEN UPPER(type)
  WHEN dedupe_key LIKE 'order-created:%' THEN 'ORDER_CREATED'
  WHEN dedupe_key LIKE 'order-cancelled:%' THEN 'ORDER_CANCELLED'
  WHEN type = 'payment' OR dedupe_key LIKE 'payment-%' THEN 'PAYMENT_UPDATED'
  WHEN type = 'voucher' THEN 'VOUCHER_EXPIRING'
  WHEN type = 'inventory' THEN 'LOW_STOCK'
  ELSE type
END;

UPDATE notifications
SET audience = CASE
  WHEN UPPER(type) IN (
    'ORDER_CREATED','ORDER_CANCELLED','PAYMENT_UPDATED','VOUCHER_EXPIRED','VOUCHER_EXPIRING',
    'PRODUCT_OUT_OF_STOCK','LOW_STOCK','CUSTOMER_FEEDBACK','SYSTEM_ERROR'
  ) THEN 'ADMIN'
  WHEN UPPER(type) IN (
    'PROMOTION','NEW_PRODUCT','NEW_VOUCHER','NEW_ARRIVAL','WISHLIST_PRICE_DROP',
    'WISHLIST_NEW_VARIANT','EVENT','COLLECTION'
  ) THEN 'CUSTOMER'
  ELSE audience
END;

UPDATE notifications
SET status = 'hidden'
WHERE UPPER(type) NOT IN (
  'ORDER_CREATED','ORDER_CANCELLED','PAYMENT_UPDATED','VOUCHER_EXPIRED','VOUCHER_EXPIRING',
  'PRODUCT_OUT_OF_STOCK','LOW_STOCK','CUSTOMER_FEEDBACK','SYSTEM_ERROR',
  'PROMOTION','NEW_PRODUCT','NEW_VOUCHER','NEW_ARRIVAL','WISHLIST_PRICE_DROP',
  'WISHLIST_NEW_VARIANT','EVENT','COLLECTION'
);

SET @has_event_idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'uq_notifications_event_key'
);
SET @sql := IF(@has_event_idx = 0, 'CREATE UNIQUE INDEX uq_notifications_event_key ON notifications (event_key)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_scope_idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_scope'
);
SET @sql := IF(@has_scope_idx = 0, 'CREATE INDEX idx_notifications_scope ON notifications (audience, type, status, expires_at, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
