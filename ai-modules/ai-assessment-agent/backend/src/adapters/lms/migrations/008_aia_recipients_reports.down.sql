-- AI Assessment Agent - rollback of 008_aia_recipients_reports.sql.
-- Drops ONLY the two 008 tables. Every published test becomes visible to its whole class again
-- (the behaviour before 008), and stored/shared AI Performance Reports are lost.
-- Assessments, attempts, assignments and everything from 001-007 are untouched.

DROP TABLE IF EXISTS aia_performance_reports;
DROP TABLE IF EXISTS aia_assessment_recipients;
