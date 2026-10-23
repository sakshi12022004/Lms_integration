-- AI Assessment Agent - migration 010: the course a test belongs to.
--
-- A test is for one class AND one course of that class: only students of the class who are
-- enrolled in the course (LMS table course_students) may see and take it.
--
-- Additive: tests created before this migration keep course_id = NULL. They are shown as
-- "legacy (no course)" and keep their old audience (the whole class, or their selected
-- recipients). No course is guessed for them.

ALTER TABLE aia_assessments ADD COLUMN course_id INTEGER;
