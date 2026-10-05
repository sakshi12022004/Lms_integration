-- AI Assessment Agent - rollback of 007_aia_assignments.sql.
-- Drops ONLY the Descriptive Assignments tables (all assignments, questions and submission records are lost).
-- Stored PDF files live outside the database (the submission directory) and must be deleted separately.
-- Assessments, attempts and everything from 001-006 are untouched.

DROP TABLE IF EXISTS aia_assignment_submissions;
DROP TABLE IF EXISTS aia_assignment_questions;
DROP TABLE IF EXISTS aia_assignments;
