import { BaseRepository } from "./base.repository.js";
import { AuthUser } from "../models/auth-user.model.js";

const AUTH_COLUMNS = `id, email, phone, full_name, avatar_url, provider, provider_id,
  password_hash, role, permissions, status, refresh_token_hash`;

export class AuthRepository extends BaseRepository {
  async ensurePasswordResetSchema() {
    await this.client.getPool().execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        attempts INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_reset_user_created (user_id, created_at),
        INDEX idx_password_reset_expires (expires_at),
        CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async findByEmail(email) {
    const [rows] = await this.client.getPool().execute(
      `SELECT ${AUTH_COLUMNS} FROM users WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL LIMIT 1`, [email]
    );
    return rows[0] ? new AuthUser(rows[0]) : null;
  }

  async findByLogin(identifier) {
    const value = String(identifier || "").trim();
    const [rows] = await this.client.getPool().execute(
      `SELECT ${AUTH_COLUMNS} FROM users
       WHERE deleted_at IS NULL AND (LOWER(email) = LOWER(?) OR phone = ?) LIMIT 1`, [value, value]
    );
    return rows[0] ? new AuthUser(rows[0]) : null;
  }

  async findByPhone(phone) {
    const [rows] = await this.client.getPool().execute(
      `SELECT ${AUTH_COLUMNS} FROM users WHERE phone = ? AND deleted_at IS NULL LIMIT 1`, [phone]
    );
    return rows[0] ? new AuthUser(rows[0]) : null;
  }

  async findByProvider(provider, providerId, email = null) {
    const [rows] = await this.client.getPool().execute(
      `SELECT ${AUTH_COLUMNS} FROM users WHERE deleted_at IS NULL
       AND ((provider = ? AND provider_id = ?) OR (? IS NOT NULL AND LOWER(email) = LOWER(?)))
       ORDER BY (provider = ? AND provider_id = ?) DESC LIMIT 1`,
      [provider, providerId, email, email, provider, providerId]
    );
    return rows[0] ? new AuthUser(rows[0]) : null;
  }

  async findById(id) {
    const [rows] = await this.client.getPool().execute(
      `SELECT ${AUTH_COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [id]
    );
    return rows[0] ? new AuthUser(rows[0]) : null;
  }

  async createOAuthUser({ email, fullName, avatarUrl, provider, providerId }) {
    const [result] = await this.client.getPool().execute(
      `INSERT INTO users (email, full_name, avatar_url, password_hash, role, permissions, status,
        provider, provider_id, email_verified_at)
       VALUES (?, ?, ?, NULL, 'CUSTOMER', JSON_ARRAY(), 'active', ?, ?, CURRENT_TIMESTAMP)`,
      [email || null, fullName, avatarUrl || null, provider, providerId]
    );
    return this.findById(result.insertId);
  }

  async linkOAuthProvider(userId, { provider, providerId, email, avatarUrl }) {
    await this.client.getPool().execute(
      `UPDATE users SET provider = ?, provider_id = ?,
       email = CASE
         WHEN email IS NULL OR email LIKE 'facebook\\_%@facebook.local' THEN ?
         ELSE email
       END,
       avatar_url = COALESCE(avatar_url, ?),
       email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`, [provider, providerId, email || null, avatarUrl || null, userId]
    );
    return this.findById(userId);
  }

  async createPhoneUser(phone, passwordHash = null) {
    const [result] = await this.client.getPool().execute(
      `INSERT INTO users (email, full_name, phone, password_hash, role, permissions, status, provider, phone_verified_at)
       VALUES (NULL, ?, ?, ?, 'CUSTOMER', JSON_ARRAY(), 'active', 'phone', CURRENT_TIMESTAMP)`,
      [`Khách hàng ${phone.slice(-4)}`, phone, passwordHash]
    );
    return this.findById(result.insertId);
  }

  async verifyPhoneAndSetPassword(userId, passwordHash = null) {
    await this.client.getPool().execute(
      `UPDATE users SET phone_verified_at = CURRENT_TIMESTAMP, password_hash = COALESCE(?, password_hash),
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [passwordHash, userId]
    );
    return this.findById(userId);
  }

  async getLatestOtp(phone) {
    const [rows] = await this.client.getPool().execute(
      `SELECT id, otp_hash, expires_at, created_at, consumed_at, attempts,
        GREATEST(TIMESTAMPDIFF(SECOND, created_at, CURRENT_TIMESTAMP), 0) AS seconds_since_created
       FROM phone_otps WHERE phone = ? ORDER BY id DESC LIMIT 1`, [phone]
    );
    return rows[0] || null;
  }

  async saveOtp(phone, otpHash, expiresAt) {
    await this.client.getPool().execute(
      `UPDATE phone_otps SET consumed_at = CURRENT_TIMESTAMP WHERE phone = ? AND consumed_at IS NULL`, [phone]
    );
    await this.client.getPool().execute(
      `INSERT INTO phone_otps (phone, otp_hash, expires_at) VALUES (?, ?, ?)`, [phone, otpHash, expiresAt]
    );
  }

  async incrementOtpAttempts(id) {
    await this.client.getPool().execute(`UPDATE phone_otps SET attempts = attempts + 1 WHERE id = ?`, [id]);
  }

  async consumeOtp(id) {
    await this.client.getPool().execute(
      `UPDATE phone_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = ? AND consumed_at IS NULL`, [id]
    );
  }

  async getLatestPasswordResetToken(userId) {
    await this.ensurePasswordResetSchema();
    const [rows] = await this.client.getPool().execute(
      `SELECT id, user_id, code_hash, expires_at, used_at, attempts, created_at,
        GREATEST(TIMESTAMPDIFF(SECOND, created_at, CURRENT_TIMESTAMP), 0) AS seconds_since_created
       FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }

  async savePasswordResetToken(userId, codeHash, expiresAt) {
    await this.ensurePasswordResetSchema();
    await this.client.getPool().execute(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL`,
      [userId]
    );
    await this.client.getPool().execute(
      `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at) VALUES (?, ?, ?)`,
      [userId, codeHash, expiresAt]
    );
  }

  async incrementPasswordResetAttempts(id) {
    await this.ensurePasswordResetSchema();
    await this.client.getPool().execute(`UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = ?`, [id]);
  }

  async consumePasswordResetToken(id) {
    await this.ensurePasswordResetSchema();
    await this.client.getPool().execute(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL`,
      [id]
    );
  }

  async updatePasswordHash(userId, passwordHash) {
    await this.client.getPool().execute(
      `UPDATE users SET password_hash = ?, refresh_token_hash = NULL, refresh_token_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [passwordHash, userId]
    );
    return this.findById(userId);
  }
  async saveRefreshToken(userId, refreshTokenHash, expiresAt) {
    await this.client.getPool().execute(
      `UPDATE users SET refresh_token_hash = ?, refresh_token_expires_at = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [refreshTokenHash, expiresAt, userId]
    );
  }

  async revokeRefreshToken(userId) {
    await this.client.getPool().execute(
      `UPDATE users SET refresh_token_hash = NULL, refresh_token_expires_at = NULL WHERE id = ?`, [userId]
    );
  }
}

