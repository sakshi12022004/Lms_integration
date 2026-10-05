const path = require("path");
const express = require("express");
const {
  createLmsAssessmentAgentRouter,
  assessmentErrorHandler,
} = require("../../ai-modules/ai-assessment-agent/backend/src/integration/lmsAssessmentAgent");

/**
 * AI Assessment Agent (teacher-authored MCQ assessments, Step 1).
 * Mounted in server.js at /api/assessment-agent behind authMiddleware + requireTenant.
 * The router re-checks the user against the DB (teacher = mentor/teacher, student = student,
 * same school) and scopes everything to the session's school and teacher.
 * Unrelated to the legacy course assessments at /api/assessments.
 * All logic lives in ai-modules/ai-assessment-agent. To remove the feature, see its README.
 */
const dbPath = path.join(__dirname, "..", "data", "lms_permanent.db");

module.exports = {
  router: createLmsAssessmentAgentRouter({ express, dbPath }),
  errorHandler: assessmentErrorHandler,
};
