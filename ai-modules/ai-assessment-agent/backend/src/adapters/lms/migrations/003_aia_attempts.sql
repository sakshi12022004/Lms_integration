-- AI Assessment Agent - Step 3 migration (after 001, 002): student attempts + results. NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001, 002, 003 in order).
--
-- Additive only: two new module tables. No LMS table is touched, and there is no
-- FOREIGN KEY into an LMS table (student_id / university_id are verified by the
-- adapter from the session, as in 001).
--
-- Rules the schema enforces:
--   - ONE attempt per student per assessment (no retakes): UNIQUE (assessment_id, student_id).
--   - One saved answer per question per attempt: PRIMARY KEY (attempt_id, question_id).
--   - Times are server-generated ISO-8601 UTC strings; deadline_at is NULL for untimed tests.
--   - Result columns are NULL until the server finalizes the attempt.
--
-- Rollback: 003_aia_attempts.down.sql

CREATE TABLE IF NOT EXISTS aia_attempts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id   INTEGER NOT NULL,                 -- tenant, from the verified session
  assessment_id   INTEGER NOT NULL REFERENCES aia_assessments (id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL,                 -- users.id from the verified session
  status          TEXT    NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  started_at      TEXT    NOT NULL,                 -- server clock
  deadline_at     TEXT,                             -- server clock: started_at + duration; NULL = untimed
  finished_at     TEXT,                             -- server clock when finalized (submit or expiry)
  total_questions INTEGER,
  attempted       INTEGER,
  correct         INTEGER,
  incorrect       INTEGER,
  unattempted     INTEGER,
  score           INTEGER,                          -- 1 mark per correct answer
  percentage      REAL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assessment_id, student_id),
  CHECK ((status = 'in_progress') = (finished_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_aia_attempts_student ON aia_attempts (university_id, student_id);
CREATE INDEX IF NOT EXISTS idx_aia_attempts_assessment ON aia_attempts (assessment_id, status);

CREATE TABLE IF NOT EXISTS aia_attempt_answers (
  attempt_id      INTEGER NOT NULL REFERENCES aia_attempts (id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL REFERENCES aia_questions (id) ON DELETE CASCADE,
  option_position INTEGER NOT NULL CHECK (option_position BETWEEN 0 AND 3),
  is_correct      INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)), -- set by the server at grading
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attempt_id, question_id)
);
