CREATE TABLE IF NOT EXISTS user_social_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(191) NULL,
  provider_email VARCHAR(191) NULL,
  display_name VARCHAR(191) NULL,
  avatar_url VARCHAR(500) NULL,
  linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_social_provider (user_id, provider),
  UNIQUE KEY uq_social_provider_identity (provider, provider_user_id),
  KEY idx_user_social_user_id (user_id),
  CONSTRAINT fk_user_social_connections_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  provider_name VARCHAR(120) NULL,
  account_holder_name VARCHAR(120) NOT NULL,
  masked_account_identifier VARCHAR(120) NOT NULL,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_user_payment_methods_user_id (user_id),
  KEY idx_user_payment_methods_default (user_id, is_default),
  CONSTRAINT fk_user_payment_methods_user_fix
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
