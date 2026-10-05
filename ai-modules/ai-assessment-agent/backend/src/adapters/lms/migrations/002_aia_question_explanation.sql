-- AI Assessment Agent - Step 2 migration (after 001). NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001 then 002).
--
-- Additive only: two nullable/defaulted columns on the module's OWN table
-- aia_questions. No new table, no LMS table touched.
--   explanation - why the correct option is correct (AI-generated or typed by the
--                 teacher). Teacher-only: never sent to students.
--   difficulty  - optional per-question difficulty.
-- Generated questions are NOT stored until the teacher saves them; there is no
-- table for unsaved AI proposals.
--
-- Rollback: 002_aia_question_explanation.down.sql

ALTER TABLE aia_questions ADD COLUMN explanation TEXT NOT NULL DEFAULT '';
ALTER TABLE aia_questions ADD COLUMN difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard'));
