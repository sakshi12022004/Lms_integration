-- Rollback of 003_soa_custom_fields.sql: drops ONLY the two custom-field tables (custom field
-- definitions and imported custom values are lost). users, students and every other table are untouched.
DROP TABLE IF EXISTS soa_custom_field_values;
DROP TABLE IF EXISTS soa_custom_fields;
