-- AI Assessment Agent - rollback of 009_aia_question_images.sql.
-- Removes ONLY the two image_key columns. Questions, options, answers and marks are untouched;
-- the picture files stay on disk and are simply no longer referenced.

ALTER TABLE aia_assignment_questions DROP COLUMN image_key;
ALTER TABLE aia_questions DROP COLUMN image_key;
