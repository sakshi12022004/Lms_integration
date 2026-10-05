-- AI Assessment Agent - Step 2 (advanced generation) migration (after 001-005): question types. NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001-006 in order).
--
-- Additive only; no existing table is rebuilt and no existing row changes meaning:
--   * aia_questions gains question_type (DEFAULT 'single_mcq': every existing question stays a
--     single-answer MCQ) and, for numerical questions only, numeric_answer (canonical decimal
--     text, e.g. '12.5') + numeric_format ('integer' | 'decimal'). A tolerance/range can be added
--     later as further columns without changing these.
--   * The one-correct-option index is dropped: multiple-select questions store 2+ correct options.
--     "Exactly one correct option" for single_mcq is enforced by the module's validation
--     (it always was, on every write path).
--   * aia_attempt_responses holds student answers to the NEW types (a set of options, or a
--     typed number). Single-answer MCQ answers stay in aia_attempt_answers, unchanged.
-- No FOREIGN KEY into an LMS table.
--
-- Rollback: 006_aia_question_types.down.sql (refuses while any non-single_mcq question exists).

ALTER TABLE aia_questions ADD COLUMN question_type TEXT NOT NULL DEFAULT 'single_mcq'
  CHECK (question_type IN ('single_mcq', 'multi_select', 'numerical'));
ALTER TABLE aia_questions ADD COLUMN numeric_answer TEXT;
ALTER TABLE aia_questions ADD COLUMN numeric_format TEXT CHECK (numeric_format IS NULL OR numeric_format IN ('integer', 'decimal'));

DROP INDEX IF EXISTS uq_aia_options_one_correct;

CREATE TABLE IF NOT EXISTS aia_attempt_responses (
  attempt_id         INTEGER NOT NULL REFERENCES aia_attempts (id) ON DELETE CASCADE,
  question_id        INTEGER NOT NULL REFERENCES aia_questions (id) ON DELETE CASCADE,
  selected_positions TEXT,                              -- multi_select: sorted JSON array, e.g. '[0,2]'
  numeric_value      TEXT,                              -- numerical: the student's canonical number, e.g. '12.5'
  is_correct         INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)), -- set by the server at grading
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attempt_id, question_id),
  CHECK ((selected_positions IS NULL) <> (numeric_value IS NULL))  -- exactly one kind of answer
);
