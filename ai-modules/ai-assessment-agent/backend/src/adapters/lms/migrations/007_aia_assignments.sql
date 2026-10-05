-- AI Assessment Agent - Descriptive Assignments (Prompt 1: foundation, no AI). NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001-007 in order;
-- `--only 007` applies just this one).
--
-- Additive only: three NEW module tables; no existing table or row is touched.
-- No FOREIGN KEY into an LMS table (school, teacher, class and student ids are checked by the
-- module against the LMS on every request, exactly like aia_assessments).
--
--   aia_assignments              one descriptive assignment: owner teacher + school + ONE class
--   aia_assignment_questions     its descriptive questions (order + marks); replaced as a whole while draft
--   aia_assignment_submissions   ONE current PDF submission per student per assignment. A re-upload
--                                before evaluation replaces the file and increments `version`.
--                                The ai_* / final_* / evaluated_* columns are reserved for the AI
--                                evaluation (Prompt 2) and the teacher's final marks; all nullable.
-- Files are NOT stored in the database: storage_key is an opaque server-generated name inside the
-- module's submission store (never the original filename, never a path).
--
-- Rollback: 007_aia_assignments.down.sql (drops the three tables; stored PDF files must be removed
-- from the submission directory separately).

CREATE TABLE IF NOT EXISTS aia_assignments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER NOT NULL,                 -- tenant, from the verified session
  teacher_id    INTEGER NOT NULL,                 -- owner, from the verified session
  classroom_id  INTEGER NOT NULL,                 -- the ONE target class (checked: same school)
  title         TEXT    NOT NULL,
  instructions  TEXT    NOT NULL DEFAULT '',
  max_marks     INTEGER NOT NULL CHECK (max_marks BETWEEN 1 AND 1000),
  due_at        TEXT,                             -- optional, ISO-8601 UTC; no submissions after it
  status        TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  published_at  TEXT,
  closed_at     TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aia_assignments_owner ON aia_assignments (university_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_aia_assignments_class ON aia_assignments (university_id, classroom_id, status);

CREATE TABLE IF NOT EXISTS aia_assignment_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES aia_assignments (id) ON DELETE CASCADE,
  position      INTEGER NOT NULL CHECK (position >= 1),
  text          TEXT    NOT NULL,
  max_marks     INTEGER NOT NULL CHECK (max_marks BETWEEN 1 AND 1000),
  UNIQUE (assignment_id, position)
);

CREATE TABLE IF NOT EXISTS aia_assignment_submissions (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id             INTEGER NOT NULL,     -- tenant, from the verified session
  assignment_id             INTEGER NOT NULL REFERENCES aia_assignments (id) ON DELETE CASCADE,
  student_id                INTEGER NOT NULL,     -- users.id from the verified session
  status                    TEXT    NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'evaluated')),
  storage_key               TEXT    NOT NULL,     -- opaque file name in the submission store
  original_filename         TEXT    NOT NULL,     -- display only (sanitized); never used as a path
  file_size                 INTEGER NOT NULL CHECK (file_size > 0),
  content_type              TEXT    NOT NULL DEFAULT 'application/pdf' CHECK (content_type = 'application/pdf'),
  sha256                    TEXT    NOT NULL,
  version                   INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1), -- +1 on each replacement upload
  submitted_at              TEXT    NOT NULL,     -- server clock
  -- Reserved for Prompt 2 (AI evaluation) and the teacher's final marks. All nullable.
  ai_marks                  REAL,
  ai_grade                  TEXT,
  ai_feedback               TEXT,
  ai_question_marks_json    TEXT,
  ai_limitations_json       TEXT,                 -- JSON array of strings: what the AI could not judge reliably
  ai_evaluated_at           TEXT,
  final_marks               REAL,
  final_grade               TEXT,
  teacher_feedback          TEXT,
  final_question_marks_json TEXT,
  evaluated_at              TEXT,
  evaluated_by              INTEGER,              -- teacher users.id (verified session)
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assignment_id, student_id),
  UNIQUE (storage_key),
  CHECK ((status = 'evaluated') = (final_marks IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_aia_assignment_submissions_student ON aia_assignment_submissions (university_id, student_id);
