-- Split notification audience from per-user read state without deleting existing rows.

ALTER TABLE notifications
  ADD COLUMN audience ENUM('ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER' AFTER target_type;

UPDATE notifications
SET audience = CASE
  WHEN target_type IN ('role', 'all') OR UPPER(COALESCE(role, '')) IN ('ADMIN', 'STAFF') THEN 'ADMIN'
  ELSE 'CUSTOMER'
END;

ALTER TABLE notifications
  ADD COLUMN dedupe_key VARCHAR(160) NULL AFTER link;

CREATE UNIQUE INDEX uq_notifications_dedupe ON notifications (dedupe_key);
CREATE INDEX idx_notifications_audience_created ON notifications (audience, created_at);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  INDEX idx_notification_reads_user (user_id, read_at),
  CONSTRAINT fk_notification_reads_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO notification_reads (notification_id, user_id, read_at)
SELECT id, user_id, created_at
FROM notifications
WHERE is_read = 1 AND user_id IS NOT NULL;
