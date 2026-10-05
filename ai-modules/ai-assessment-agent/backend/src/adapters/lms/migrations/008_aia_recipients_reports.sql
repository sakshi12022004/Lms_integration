-- AI Assessment Agent - student-level test recipients + shared AI Performance Reports. NOT APPLIED.
-- Run it only with explicit approval (backend/scripts/applyMigration.js applies 001-008 in order;
-- `--only 008` applies just this one).
--
-- Additive only: two NEW module tables; no existing table or row is touched.
-- No FOREIGN KEY into an LMS table (school, teacher and student ids are checked by the module
-- against the LMS on every request, exactly like aia_assessments).
--
--   aia_assessment_recipients  OPTIONAL student-level targeting of a published test. NO rows for a
--                              test = the whole class (the behaviour before 008, unchanged). Rows =
--                              only those students (each a member of the test's class) see and take it.
--   aia_performance_reports    an AI Performance Report as it was shown to the teacher (the validated,
--                              renderable content only: never the prompt, provider or model output).
--                              shared_at NULL = teacher-only; "Send to Student" sets shared_at, which
--                              makes it the student's notification (read_at = the student opened it).
--                              Downloads rebuild the PDF from this data: no PDF is stored, no AI call.
--
-- Rollback: 008_aia_recipients_reports.down.sql

CREATE TABLE IF NOT EXISTS aia_assessment_recipients (
  assessment_id INTEGER  NOT NULL REFERENCES aia_assessments (id) ON DELETE CASCADE,
  university_id INTEGER  NOT NULL,                  -- tenant, from the verified session
  student_id    INTEGER  NOT NULL,                  -- users.id; a member of the test's class when stored
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assessment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_aia_assessment_recipients_student ON aia_assessment_recipients (university_id, student_id);

CREATE TABLE IF NOT EXISTS aia_performance_reports (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER  NOT NULL,                  -- tenant, from the verified session
  teacher_id    INTEGER  NOT NULL,                  -- the teacher who generated it (users.id)
  student_id    INTEGER  NOT NULL,                  -- the student it is about (users.id)
  focus_label   TEXT     NOT NULL,
  content_json  TEXT     NOT NULL,                  -- validated/renderable report sections only
  preview_json  TEXT,                               -- {"validated":false,"warnings":[...]} in preview mode, else NULL
  scope_json    TEXT     NOT NULL,                  -- {"assessments":n,"subjects":[...]} for the PDF header
  generated_at  TEXT     NOT NULL,                  -- ISO time the report was generated
  shared_at     TEXT,                               -- NULL = not shared; set once by "Send to Student"
  shared_by     INTEGER,                            -- teacher who shared it (users.id)
  read_at       TEXT,                               -- the student first opened/downloaded it
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aia_performance_reports_student ON aia_performance_reports (university_id, student_id, shared_at);
CREATE INDEX IF NOT EXISTS idx_aia_performance_reports_teacher ON aia_performance_reports (university_id, teacher_id);
