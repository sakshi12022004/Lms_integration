-- AI Assessment Agent - Step 1 migration for the LMS SQLite database (server/data/lms_permanent.db).
-- NOT APPLIED. Run it only with explicit approval (see backend/scripts/applyMigration.js).
--
-- Additive only: creates three new tables and their indexes. No existing LMS
-- table, column or row is changed. The legacy LMS tables `assessments` /
-- `assessment_questions` (course-scoped feature, /api/assessments) are NOT used
-- or touched; every table here is prefixed `aia_` so the two never collide.
--
-- No FOREIGN KEY points at an LMS table (users, universities, classrooms). Such
-- a key could block or alter the LMS's own deletes on connections that enforce
-- foreign keys. Tenant, owner and classroom are verified by the LMS adapter
-- instead, from the authenticated session. Keys only link the module's own tables.
--
-- Rollback: 001_aia_assessments.down.sql

CREATE TABLE IF NOT EXISTS aia_assessments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id    INTEGER NOT NULL,                 -- tenant, from the verified session (users.university_id)
  teacher_id       INTEGER NOT NULL,                 -- owner, from the verified session (users.id)
  title            TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  subject          TEXT    NOT NULL,
  classroom_id     INTEGER,                          -- target class (classrooms.id, same school); required to publish
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR (duration_minutes BETWEEN 1 AND 600)),
  status           TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  source           TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual')), -- 'llm' is added with the LLM step
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_aia_assessments_owner ON aia_assessments (university_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_aia_assessments_class ON aia_assessments (university_id, classroom_id, status);

CREATE TABLE IF NOT EXISTS aia_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL REFERENCES aia_assessments (id) ON DELETE CASCADE,
  position      INTEGER NOT NULL CHECK (position >= 1),
  text          TEXT    NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aia_questions_assessment ON aia_questions (assessment_id, position);

CREATE TABLE IF NOT EXISTS aia_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES aia_questions (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),  -- MCQ: exactly 4 options (A-D)
  text        TEXT    NOT NULL,
  is_correct  INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  UNIQUE (question_id, position)
);
-- At most one correct option per question (the service also requires at least one).
CREATE UNIQUE INDEX IF NOT EXISTS uq_aia_options_one_correct ON aia_options (question_id) WHERE is_correct = 1;
