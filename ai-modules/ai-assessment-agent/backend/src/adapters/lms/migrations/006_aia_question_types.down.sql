-- AI Assessment Agent - rollback of 006_aia_question_types.sql.
--
-- REFUSES (CHECK constraint failed: n = 0) while any multiple-select or numerical question
-- exists: without 006 such a question would lose its type and answer key, and restoring the
-- one-correct-option index would fail. Delete those questions (or their draft tests) first.
-- Single-answer MCQ questions, attempts and answers are untouched.

CREATE TEMP TABLE aia_006_rollback_guard (n INTEGER CHECK (n = 0));
INSERT INTO aia_006_rollback_guard (n) SELECT COUNT(*) FROM aia_questions WHERE question_type <> 'single_mcq';
DROP TABLE aia_006_rollback_guard;

DROP TABLE IF EXISTS aia_attempt_responses;
ALTER TABLE aia_questions DROP COLUMN numeric_format;
ALTER TABLE aia_questions DROP COLUMN numeric_answer;
ALTER TABLE aia_questions DROP COLUMN question_type;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aia_options_one_correct ON aia_options (question_id) WHERE is_correct = 1;
