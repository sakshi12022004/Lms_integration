-- AI Assessment Agent - rollback of 005_aia_attempt_archive.sql.
-- Drops ONLY the archive of reset attempts (their history is lost). Current attempts are untouched.

DROP TABLE IF EXISTS aia_attempt_archive;
