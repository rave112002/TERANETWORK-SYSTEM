-- ============================================================================
-- 003 — Password reset tokens
-- Single-use, TTL'd tokens for the forgot/reset-password flow. Only the SHA-256
-- hash of the token is stored (the plaintext lives only in the emailed link).
-- accountId is polymorphic (superadmin OR user) — no FK, matching refresh_tokens.
-- All DATETIME values are Asia/Manila local.
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tokenHash VARCHAR(64) NOT NULL UNIQUE,
  accountId VARCHAR(50) NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME NULL,
  dateCreated DATETIME NOT NULL,
  INDEX idx_password_reset_tokens_accountId (accountId),
  INDEX idx_password_reset_tokens_expiresAt (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
