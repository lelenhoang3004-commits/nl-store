SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_payment_methods'
    AND COLUMN_NAME = 'account_fingerprint'
);

SET @add_column_sql := IF(
  @column_exists = 0,
  'ALTER TABLE user_payment_methods ADD COLUMN account_fingerprint CHAR(64) NULL AFTER masked_account_identifier',
  'SELECT 1'
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_payment_methods'
    AND INDEX_NAME = 'uq_user_payment_methods_fingerprint'
);

SET @add_index_sql := IF(
  @index_exists = 0,
  'CREATE UNIQUE INDEX uq_user_payment_methods_fingerprint ON user_payment_methods (user_id, type, account_fingerprint)',
  'SELECT 1'
);
PREPARE add_index_stmt FROM @add_index_sql;
EXECUTE add_index_stmt;
DEALLOCATE PREPARE add_index_stmt;
