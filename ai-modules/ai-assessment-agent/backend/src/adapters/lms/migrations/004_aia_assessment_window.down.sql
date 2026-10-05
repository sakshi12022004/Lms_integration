-- AI Assessment Agent - rollback of 004_aia_assessment_window.sql.
-- Drops the three Step 5 columns from the module's own table (window/close data is lost).
-- Requires SQLite 3.35+ (node:sqlite in Node 22.5+ bundles a newer one).

ALTER TABLE aia_assessments DROP COLUMN closed_at;
ALTER TABLE aia_assessments DROP COLUMN closes_at;
ALTER TABLE aia_assessments DROP COLUMN opens_at;
