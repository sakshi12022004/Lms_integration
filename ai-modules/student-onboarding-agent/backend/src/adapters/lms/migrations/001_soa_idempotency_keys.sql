-- PROPOSED migration for the LMS SQLite database (server/data/lms_permanent.db).
-- NOT APPLIED. Requires explicit approval before it is run against any LMS database.
--
-- Purpose: durable idempotency for the Student Onboarding Agent's LMS adapter.
-- The adapter records every successful createStudent / assignStudentToClassroom
-- in the SAME transaction as the LMS insert, so a retry with the same key
-- (e.g. after a crash) returns the original result instead of creating a duplicate.
--
-- Additive only: creates one new table; no existing table or row is changed.
-- Rollback: DROP TABLE soa_idempotency_keys;

CREATE TABLE IF NOT EXISTS soa_idempotency_keys (
  university_id   INTEGER NOT NULL,                 -- tenant (from the verified admin actor)
  idempotency_key TEXT    NOT NULL,                 -- e.g. "<jobId>:<rowNumber>:<tool>"
  operation       TEXT    NOT NULL CHECK (operation IN ('createStudent', 'assignStudentToClassroom')),
  result_json     TEXT    NOT NULL,                 -- the result returned to the caller (opaque refs only; no PII, no secrets)
  created_by      INTEGER NOT NULL,                 -- users.id of the admin who ran the import
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (university_id, idempotency_key)
);
