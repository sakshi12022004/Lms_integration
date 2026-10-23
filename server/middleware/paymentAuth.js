/**
 * Payment routes use the same strict session check as the rest of the API
 * (signed, unexpired token; account, role and school re-read from the database).
 */
const requirePaymentAuth = require('./authMiddleware');

function defaultGetDatabase(req) {
  return req.tenant?.database || require('../config/database-switch');
}

/**
 * Role authorization checked against the users table, not just the token:
 * the account must still exist and its CURRENT role must be allowed.
 * Must run after requirePaymentAuth.
 */
function requireRoles(roles, getDatabase = defaultGetDatabase) {
  return (req, res, next) => {
    const userId = req.user?.userId;
    if (!/^\d+$/.test(String(userId))) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    getDatabase(req).get('SELECT id, role FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) {
        console.error('Payment role check failed:', err.message);
        return res.status(500).json({ success: false, message: 'Authorization check failed.' });
      }
      if (!row) {
        return res.status(401).json({ success: false, message: 'Account not found.' });
      }
      if (!roles.includes(row.role)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      req.user.role = row.role;
      next();
    });
  };
}

/**
 * Resolves which student a request is about. Students can only ever act on
 * themselves (identity comes from the verified token); staff must name one.
 * Returns the student id, or null after sending the error response.
 */
function resolveStudentScope(req, res, requestedStudentId) {
  const requested = requestedStudentId === undefined || requestedStudentId === null || requestedStudentId === ''
    ? null
    : String(requestedStudentId);

  if (req.user.role === 'student') {
    if (requested !== null && requested !== String(req.user.userId)) {
      res.status(403).json({ success: false, message: 'You can only access your own fee records.' });
      return null;
    }
    return Number(req.user.userId);
  }

  if (requested === null || !/^\d+$/.test(requested)) {
    res.status(400).json({ success: false, message: 'A valid student ID is required.' });
    return null;
  }
  return Number(requested);
}

const STAFF_ROLES = ['accountant', 'admin'];

module.exports = { requirePaymentAuth, requireRoles, resolveStudentScope, STAFF_ROLES };
