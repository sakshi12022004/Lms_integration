// Database used by the LMS core.
//
// SQLite is the only adapter that exists in this codebase. USE_POSTGRES used to
// be read here before the environment was loaded, so it never had any effect;
// say so plainly instead of letting an operator believe they are on PostgreSQL.
if (process.env.USE_POSTGRES === 'true') {
  console.warn('⚠️ USE_POSTGRES=true is set, but this build has no PostgreSQL adapter for the LMS core. Using SQLite.');
}

module.exports = require('./sqlite-db');
