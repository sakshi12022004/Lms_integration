-- AI Assessment Agent - Step 5 migration (after 001-003): test windows + teacher "close". NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001-004 in order).
--
-- Additive only: three nullable columns on the module's OWN table aia_assessments.
-- No new table, no LMS table touched. Existing rows keep NULLs = no window, not closed
-- (exactly the Step 1-4 behaviour).
--   opens_at   - optional: students cannot start before this time (server clock, ISO-8601 UTC)
--   closes_at  - optional: students cannot start at/after it; running attempts end at it
--   closed_at  - set when the teacher closes the test manually; open attempts are finalized then
--
-- Rollback: 004_aia_assessment_window.down.sql

ALTER TABLE aia_assessments ADD COLUMN opens_at TEXT;
ALTER TABLE aia_assessments ADD COLUMN closes_at TEXT;
ALTER TABLE aia_assessments ADD COLUMN closed_at TEXT;
