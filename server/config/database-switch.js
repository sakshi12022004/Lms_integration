// Database configuration switch
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

let db;

if (USE_POSTGRES) {
  console.log('Using PostgreSQL database');
  db = require('./postgres-db');
} else {
  console.log('Using SQLite database');
  db = require('./sqlite-db');
}

module.exports = db;
