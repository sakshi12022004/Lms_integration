-- Student Onboarding Agent, Step 11: one-time password-setup links for imported students.
-- Additive only: one new table + one index. No existing table is changed.
-- Only the SHA-256 of each token is stored; the token itself exists only in the email.
-- Rollback: DROP TABLE soa_student_setup_tokens;
CREATE TABLE IF NOT EXISTS soa_student_setup_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  university_id INTEGER NOT NULL,
  token_hash    TEXT    NOT NULL UNIQUE,
  created_by    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,  -- epoch ms
  expires_at    INTEGER NOT NULL,  -- epoch ms
  used_at       INTEGER,           -- set once, when the password is set
  revoked_at    INTEGER,           -- superseded, or the email carrying it failed
  email_status  TEXT    NOT NULL CHECK (email_status IN ('pending', 'sent', 'failed')),
  email_error   TEXT               -- safe error code only
);
CREATE INDEX IF NOT EXISTS idx_soa_setup_tokens_user ON soa_student_setup_tokens (university_id, user_id, created_at);
