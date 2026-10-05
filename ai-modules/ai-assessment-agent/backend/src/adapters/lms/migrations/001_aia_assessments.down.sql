-- AI Assessment Agent - rollback of 001_aia_assessments.sql.
-- Removes ONLY the module's own tables (and their indexes). Deletes all
-- assessment-agent data. No LMS table is touched.

DROP TABLE IF EXISTS aia_options;
DROP TABLE IF EXISTS aia_questions;
DROP TABLE IF EXISTS aia_assessments;
