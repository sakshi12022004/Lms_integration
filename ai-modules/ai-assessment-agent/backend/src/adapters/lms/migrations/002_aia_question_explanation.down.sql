-- AI Assessment Agent - rollback of 002_aia_question_explanation.sql.
-- Drops the two Step 2 columns (and their data) from the module's own table.
-- Requires SQLite 3.35+ (node:sqlite in Node 22.5+ bundles a newer one).

ALTER TABLE aia_questions DROP COLUMN difficulty;
ALTER TABLE aia_questions DROP COLUMN explanation;
