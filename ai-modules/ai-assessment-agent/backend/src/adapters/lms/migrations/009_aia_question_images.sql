-- AI Assessment Agent - migration 009: optional picture per question.
--
-- A question (test question or descriptive assignment question) may carry ONE picture, such as a
-- diagram, graph or figure. Only an opaque key is stored here; the picture itself is a file in the
-- module's private store and is served through authenticated routes only.
--
-- Additive: existing questions keep image_key = NULL and behave exactly as before.

ALTER TABLE aia_questions ADD COLUMN image_key TEXT;
ALTER TABLE aia_assignment_questions ADD COLUMN image_key TEXT;
