-- AI Assessment Agent - rollback of 010_aia_assessment_course.sql.
-- Removes ONLY aia_assessments.course_id. Tests, questions and attempts are untouched; every
-- test then behaves as a legacy (class-only) test again.

ALTER TABLE aia_assessments DROP COLUMN course_id;
