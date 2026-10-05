-- Student Onboarding Agent: admin-approved custom student fields (dynamic fields, metadata/value design).
-- NOT APPLIED to the live database. Apply only with explicit approval (after a backup).
-- Additive only: two new tables + indexes. No existing table, column or row is changed; no column is
-- ever added to users/students for a custom field (the field is a ROW in soa_custom_fields).
-- Rollback: 003_soa_custom_fields.down.sql
--
--   soa_custom_fields        one field per school (tenant). field_key is a safe machine key validated by the
--                            server (CustomFieldRules.js) and re-checked here; data_type is a closed set.
--                            Created only by an admin's explicit approval, never by the AI. An admin may
--                            rename the label or RETIRE the field (retired_at): never deleted, its values
--                            stay readable, but it is no longer offered for new imports.
--   soa_custom_field_values  one value per (student user, field), written in the same transaction that
--                            creates the student during an approved import. Stored as normalized text.
CREATE TABLE IF NOT EXISTS soa_custom_fields (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER NOT NULL,                                  -- tenant, from the verified admin
  field_key     TEXT    NOT NULL
                CHECK (length(field_key) BETWEEN 2 AND 40
                       AND substr(field_key, 1, 1) BETWEEN 'a' AND 'z'
                       AND field_key NOT GLOB '*[^a-z0-9_]*'),     -- defence in depth: [a-z][a-z0-9_]{1,39}
  label         TEXT    NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  data_type     TEXT    NOT NULL CHECK (data_type IN ('text', 'number', 'date', 'boolean')),
  created_by    INTEGER NOT NULL,                                  -- the approving admin (users.id)
  created_at    INTEGER NOT NULL,                                  -- epoch ms
  updated_at    INTEGER,                                           -- epoch ms of the last label/type change
  retired_at    INTEGER,                                           -- epoch ms; NULL = active
  retired_by    INTEGER,                                           -- the admin who retired it (users.id)
  UNIQUE (university_id, field_key)
);

CREATE TABLE IF NOT EXISTS soa_custom_field_values (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER NOT NULL,                                  -- tenant (always equal to the field's)
  user_id       INTEGER NOT NULL,                                  -- the student's users.id
  field_id      INTEGER NOT NULL REFERENCES soa_custom_fields (id),
  value         TEXT,                                              -- normalized by data_type; NULL = empty
  created_by    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,                                  -- epoch ms
  UNIQUE (user_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_soa_custom_field_values_user ON soa_custom_field_values (university_id, user_id);
