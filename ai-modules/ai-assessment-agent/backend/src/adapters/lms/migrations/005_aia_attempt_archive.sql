-- AI Assessment Agent - Step 6 migration (after 001-004): teacher attempt reset with history. NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001-005 in order).
--
-- Additive only: ONE new module table. aia_attempts is NOT rebuilt: its
-- UNIQUE (assessment_id, student_id) stays, so there is always at most one CURRENT
-- attempt per student per test. A teacher reset MOVES the finished current attempt
-- (result + answers snapshot) here and deletes it from aia_attempts, in one transaction;
-- the student can then start a fresh attempt. History is preserved, never current.
-- (Rebuilding aia_attempts to drop the UNIQUE was rejected: with foreign keys ON,
-- dropping the old table would cascade-delete aia_attempt_answers.)
-- No FOREIGN KEY into an LMS table.
--
-- Rollback: 005_aia_attempt_archive.down.sql

CREATE TABLE IF NOT EXISTS aia_attempt_archive (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  original_attempt_id INTEGER NOT NULL,                -- the aia_attempts.id it had while current
  university_id       INTEGER NOT NULL,                -- tenant (from the verified session)
  assessment_id       INTEGER NOT NULL REFERENCES aia_assessments (id) ON DELETE CASCADE,
  student_id          INTEGER NOT NULL,
  status              TEXT    NOT NULL CHECK (status IN ('submitted', 'expired')), -- only finished attempts are archived
  started_at          TEXT    NOT NULL,
  deadline_at         TEXT,
  finished_at         TEXT    NOT NULL,
  total_questions     INTEGER NOT NULL,
  attempted           INTEGER NOT NULL,
  correct             INTEGER NOT NULL,
  incorrect           INTEGER NOT NULL,
  unattempted         INTEGER NOT NULL,
  score               INTEGER NOT NULL,
  percentage          REAL    NOT NULL,
  answers_json        TEXT    NOT NULL,                -- [{ questionId, optionPosition, isCorrect }] snapshot
  reset_by            INTEGER NOT NULL,                -- teacher users.id (verified session)
  reset_at            TEXT    NOT NULL,                -- server clock
  UNIQUE (original_attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_aia_attempt_archive_student ON aia_attempt_archive (university_id, assessment_id, student_id);
