-- AI Assessment Agent - rollback of 003_aia_attempts.sql.
-- Removes ONLY the Step 3 tables (all attempts, answers and results). No LMS table is touched.

DROP TABLE IF EXISTS aia_attempt_answers;
DROP TABLE IF EXISTS aia_attempts;
