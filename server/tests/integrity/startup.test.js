/**
 * Start-up behaviour, across real process restarts.
 *
 *  - Existing data survives restarts: fee structures (the audit's DATA-012, "fee structures
 *    deleted on start-up") and every other table.
 *  - Initialisation is idempotent and never re-creates what an admin removed.
 *  - Demo accounts and default fee structures appear only when asked for, never in production.
 *  - Unsafe configuration stops the server (SEC-007: signing secret, CORS, demo data).
 *
 * Each case uses its own database file in the OS temp folder.
 */
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, temporaryDatabase, SERVER_ROOT } = require('../helpers/serverProcess');

const Database = require(path.join(SERVER_ROOT, 'node_modules', 'better-sqlite3'));
const { findConfigProblems, getAllowedOrigins } = require(path.join(SERVER_ROOT, 'config', 'securityConfig'));

const created = [];
const newDatabase = () => {
  const db = temporaryDatabase();
  created.push(db.directory);
  return db.dbPath;
};
after(() => {
  for (const directory of created) {
    try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* best effort on Windows */ }
  }
});

const withDb = (dbPath, work) => {
  const db = new Database(dbPath);
  try { return work(db); } finally { db.close(); }
};
const tableNames = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
const snapshot = (dbPath) =>
  withDb(dbPath, (db) => Object.fromEntries(tableNames(db).map((name) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY 1`).all()])));

async function runOnce(dbPath, env = {}) {
  const server = await startServer(dbPath, env);
  assert.equal(server.listening, true, `server did not start:\n${server.output.slice(-600)}`);
  await server.stop();
  return server;
}

const FEES = [
  // id, university_id, category, grade, tuitionFee, transportFee, totalFee, dueDate, installmentOptions
  [501, 1, 'Primary', '1-4', 4321, 111, 4432, '2027-03-31', JSON.stringify([{ stage: 1, percent: 60 }, { stage: 2, percent: 40 }])],
  [502, 1, 'Custom Scholarship Band', '5', 1, 0, 1, '2027-04-30', null],
  [503, 2, 'Secondary', '5-12', 9999.5, 250, 10249.5, '2027-05-31', null],
];

function insertSchoolData(dbPath) {
  withDb(dbPath, (db) => {
    // The LMS core opens SQLite without foreign-key enforcement (audit finding DATA-001), and
    // payments.studentId holds a users.id although the schema points it at students.id (DATA-006).
    // Insert the way the application does.
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO universities (id, name, area) VALUES (1, 'School A', 'North'), (2, 'School B', 'South')").run();
    const fee = db.prepare('INSERT INTO feeStructures (id, university_id, category, grade, tuitionFee, transportFee, totalFee, dueDate, installmentOptions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    FEES.forEach((row) => fee.run(row));
    db.prepare("INSERT INTO users (id, name, email, password, role, university_id, isApproved) VALUES (7, 'Admin', 'admin@test.invalid', 'x', 'admin', 1, 1), (8, 'Student', 'student@test.invalid', 'x', 'student', 1, 1)").run();
    db.prepare("INSERT INTO classrooms (id, university_id, name, grade, section) VALUES (70, 1, 'Grade 5 - A', '5', 'A')").run();
    db.prepare('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (8, 70)').run();
    db.prepare("INSERT INTO courses (id, title, university_id, classroomId) VALUES (700, 'Maths', 1, 70)").run();
    db.prepare("INSERT INTO results (classroomId, studentId, term, subjects, overallPercentage, overallStatus) VALUES (70, 8, 'Term 1', '[]', 75, 'PASS')").run();
    db.prepare("INSERT INTO attendance (classroomId, studentId, date, status, markedBy) VALUES (70, 8, '2026-02-02', 'present', 7)").run();
    db.prepare("INSERT INTO payments (studentId, amount, type, status, transactionId) VALUES (8, 4432, 'offline-cash', 'success', 'TXN-KEEP')").run();
  });
}

describe('start-up and restarts', () => {
  it('an empty database is initialised with tables and with no accounts, fee structures or other rows', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath);

    withDb(dbPath, (db) => {
      const tables = tableNames(db);
      for (const expected of ['users', 'universities', 'classrooms', 'feeStructures', 'courses', 'results', 'attendance', 'payments']) {
        assert.ok(tables.includes(expected), `table ${expected} missing`);
      }
      for (const table of tables) {
        assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n, 0, `${table} is not empty after first start`);
      }
    });
  });

  it('fee structures and all other school data survive repeated restarts unchanged', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath);
    insertSchoolData(dbPath);
    const before = snapshot(dbPath);
    assert.equal(before.feeStructures.length, 3);

    for (const restart of [1, 2, 3]) {
      await runOnce(dbPath);
      const now = snapshot(dbPath);
      assert.deepEqual(now.feeStructures, before.feeStructures, `fee structures changed on restart ${restart}`);
      assert.deepEqual(now, before, `some table changed on restart ${restart}`);
    }
  });

  it('the same data survives a restart in production mode', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath);
    insertSchoolData(dbPath);
    const before = snapshot(dbPath);

    await runOnce(dbPath, { NODE_ENV: 'production', CORS_ORIGINS: 'https://lms.school.example' });
    assert.deepEqual(snapshot(dbPath), before);
  });

  it('fee structures an admin removed are not brought back by a restart', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath);
    insertSchoolData(dbPath);
    withDb(dbPath, (db) => db.prepare('DELETE FROM feeStructures').run());

    await runOnce(dbPath);
    await runOnce(dbPath, { NODE_ENV: 'production', CORS_ORIGINS: 'https://lms.school.example' });
    assert.equal(withDb(dbPath, (db) => db.prepare('SELECT COUNT(*) AS n FROM feeStructures').get().n), 0);
  });

  it('demo data is created only on request, once, and never over existing accounts', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath, { NODE_ENV: 'development', SEED_DEMO_DATA: 'true' });
    const seeded = snapshot(dbPath);
    assert.ok(seeded.users.length >= 4, 'demo accounts were not created');
    assert.ok(seeded.feeStructures.length >= 1, 'default fee structures were not created');

    await runOnce(dbPath, { NODE_ENV: 'development', SEED_DEMO_DATA: 'true' });
    const again = snapshot(dbPath);
    assert.equal(again.users.length, seeded.users.length);
    assert.deepEqual(again.feeStructures, seeded.feeStructures);

    // a database that already has accounts gets no demo accounts added
    const real = newDatabase();
    await runOnce(real);
    insertSchoolData(real);
    await runOnce(real, { NODE_ENV: 'development', SEED_DEMO_DATA: 'true' });
    assert.deepEqual(withDb(real, (db) => db.prepare('SELECT id FROM users ORDER BY id').all()), [{ id: 7 }, { id: 8 }]);
    assert.equal(withDb(real, (db) => db.prepare('SELECT COUNT(*) AS n FROM feeStructures').get().n), 3);
  });

  it('a pending schema migration backs the database file up first', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath);
    const backups = fs.readdirSync(path.join(path.dirname(dbPath), 'backups'));
    assert.ok(backups.some((name) => name.includes('pre-installment-migration')), 'no backup was written before the migration');
  });
});

describe('one-time migration to explicit enrolment', () => {
  it('enrols the members of each course\'s class once, keeps a backup, and later restarts change nothing', async () => {
    const dbPath = newDatabase();
    await runOnce(dbPath); // creates the schema (user_version becomes 1 on an empty database)
    withDb(dbPath, (db) => {
      assert.equal(db.pragma('user_version', { simple: true }), 1);
      db.pragma('foreign_keys = OFF');
      // a database from before: version 0, a course whose class members were not enrolled
      db.pragma('user_version = 0');
      db.prepare("INSERT INTO universities (id, name, area) VALUES (1, 'School A', 'North')").run();
      db.prepare("INSERT INTO users (id, name, email, password, role, university_id, isApproved) VALUES (8, 'S1', 's1@test.invalid', 'x', 'student', 1, 1), (9, 'S2', 's2@test.invalid', 'x', 'student', 1, 1), (10, 'T', 't@test.invalid', 'x', 'mentor', 1, 1)").run();
      db.prepare("INSERT INTO classrooms (id, university_id, name, grade, section) VALUES (70, 1, 'Grade 5 - A', '5', 'A')").run();
      db.prepare('INSERT INTO student_classroom_assignment (studentId, classroomId) VALUES (8, 70), (9, 70), (10, 70)').run();
      db.prepare("INSERT INTO courses (id, title, university_id, classroomId, mentorId) VALUES (700, 'Maths', 1, 70, 10)").run();
      db.prepare('INSERT INTO course_students (courseId, studentId) VALUES (700, 9)').run(); // already enrolled individually
    });

    await runOnce(dbPath);
    let after;
    withDb(dbPath, (db) => {
      assert.equal(db.pragma('user_version', { simple: true }), 1);
      const rows = db.prepare('SELECT studentId, enrolledViaClassroomId FROM course_students WHERE courseId = 700 ORDER BY studentId').all();
      assert.deepEqual(rows.map((r) => [r.studentId, r.enrolledViaClassroomId]), [[8, 70], [9, null]], 'the member is enrolled; the individual enrolment is untouched; the teacher is not');
      assert.equal(db.prepare('SELECT enrollAll FROM course_classrooms WHERE courseId = 700 AND classroomId = 70').get().enrollAll, 1);
      after = snapshot(dbPath);
    });
    const backups = fs.readdirSync(path.join(path.dirname(dbPath), 'backups')).filter((name) => name.includes('pre-explicit-enrolment'));
    assert.equal(backups.length, 1, 'a copy of the database was kept before the change');

    await runOnce(dbPath);
    assert.deepEqual(snapshot(dbPath), after, 'a second restart changes nothing');
  });
});

describe('graceful shutdown', () => {
  it('finishes the request in hand, refuses new ones, closes the database and exits with code 0', async () => {
    const dbPath = newDatabase();
    const server = await startServer(dbPath);
    assert.equal(server.listening, true, server.output.slice(-400));
    const base = `http://127.0.0.1:${server.port}`;
    assert.equal((await fetch(`${base}/health/ready`)).status, 200);

    // A request that is still being received when the stop is asked for: the headers have
    // arrived, the body has not finished.
    const http = require('http');
    const inFlight = new Promise((resolve, reject) => {
      const request = http.request(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body }));
      });
      request.on('error', reject);
      request.write('{"email":"nobody@test.invalid",');
      setTimeout(() => request.end('"password":"x"}'), 700);
    });
    await new Promise((r) => setTimeout(r, 150));

    const started = Date.now();
    const stopped = server.shutdownGracefully();
    const answered = await inFlight;
    assert.equal(answered.status, 401, 'the request in hand was answered normally, not cut off');

    const { exitCode, output } = await stopped;
    assert.equal(exitCode, 0, output.slice(-400));
    assert.ok(Date.now() - started < 9000, 'it did not need the 10-second hard stop');
    assert.match(output, /Shutting down \(shutdown message\)/);
    await assert.rejects(fetch(`${base}/health/ready`), 'the port is closed');

    // The file was closed properly: it opens, passes the integrity check, and can be
    // started again.
    withDb(dbPath, (db) => assert.equal(db.pragma('integrity_check', { simple: true }), 'ok'));
    await runOnce(dbPath);
  });
});

describe('unsafe configuration stops the server (it never falls back to a built-in secret)', () => {
  const refused = async (env, expectedMessage) => {
    const server = await startServer(newDatabase(), env, { settleMs: 200 });
    if (server.listening) await server.stop();
    assert.equal(server.listening, false, 'the server started with an unsafe configuration');
    assert.equal(server.exitCode, 1);
    assert.match(server.output, expectedMessage);
  };
  const production = { NODE_ENV: 'production', CORS_ORIGINS: 'https://lms.school.example' };

  it('no JWT_SECRET (any environment)', () => refused({ JWT_SECRET: undefined }, /JWT_SECRET is not set/));
  it('no JWT_SECRET in production', () => refused({ ...production, JWT_SECRET: undefined }, /JWT_SECRET is not set/));
  it('the template placeholder as JWT_SECRET', () =>
    refused({ ...production, JWT_SECRET: 'your_jwt_secret_here_change_this_in_production' }, /placeholder/));
  it('the old built-in default as JWT_SECRET', () => refused({ JWT_SECRET: 'default_jwt_secret_key' }, /placeholder/));
  it('a short JWT_SECRET', () => refused({ JWT_SECRET: 'only-24-characters-long!' }, /at least 32 characters/));
  it('production without JWT_REFRESH_SECRET', () => refused({ ...production, JWT_REFRESH_SECRET: undefined }, /JWT_REFRESH_SECRET is not set/));
  it('production with the same value for both secrets', () => {
    const same = `same-secret-${'e'.repeat(40)}`;
    return refused({ ...production, JWT_SECRET: same, JWT_REFRESH_SECRET: same }, /must be different/);
  });
  it('production without an allowed web origin', () => refused({ NODE_ENV: 'production' }, /CORS_ORIGINS/));
  it('production with a wildcard origin', () => refused({ NODE_ENV: 'production', CORS_ORIGINS: '*' }, /must not contain/));
  it('production with demo data switched on', () => refused({ ...production, SEED_DEMO_DATA: 'true' }, /SEED_DEMO_DATA/));

  it('the error output never prints a secret value', async () => {
    const secret = 'short-but-secret-value';
    const server = await startServer(newDatabase(), { JWT_SECRET: secret }, { settleMs: 200 });
    if (server.listening) await server.stop();
    assert.equal(server.output.includes(secret), false);
  });

  it('a complete production configuration starts', async () => {
    const server = await startServer(newDatabase(), production);
    assert.equal(server.listening, true, server.output.slice(-400));
    const health = await fetch(`http://127.0.0.1:${server.port}/health`);
    assert.equal(health.status, 200);
    // production: local development origins are not allowed any more
    const preflight = await fetch(`http://127.0.0.1:${server.port}/api/courses`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    const allowed = await fetch(`http://127.0.0.1:${server.port}/api/courses`, { method: 'OPTIONS', headers: { Origin: 'https://lms.school.example', 'Access-Control-Request-Method': 'GET' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://lms.school.example');
    await server.stop();
  });
});

describe('configuration rules (unit)', () => {
  const withEnv = (values, work) => {
    const saved = {};
    for (const [name, value] of Object.entries(values)) {
      saved[name] = process.env[name];
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    try { return work(); } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
    }
  };
  const good = { JWT_SECRET: 'f'.repeat(48), JWT_REFRESH_SECRET: 'g'.repeat(48), NODE_ENV: 'production', CORS_ORIGINS: 'https://a.example, https://b.example', FRONTEND_ORIGIN: undefined, SEED_DEMO_DATA: undefined };

  it('accepts a complete production configuration', () => {
    assert.deepEqual(withEnv(good, findConfigProblems), []);
  });

  it('lists every problem at once', () => {
    const problems = withEnv({ ...good, JWT_SECRET: 'secret', JWT_REFRESH_SECRET: undefined, CORS_ORIGINS: undefined }, findConfigProblems);
    assert.equal(problems.length, 3);
  });

  it('allowed origins: explicit list in production, local ports added only outside production', () => {
    assert.deepEqual(withEnv(good, getAllowedOrigins), ['https://a.example', 'https://b.example']);
    const development = withEnv({ ...good, NODE_ENV: 'development' }, getAllowedOrigins);
    assert.ok(development.includes('http://localhost:5173') && development.includes('https://a.example'));
    assert.equal(development.includes('*'), false);
  });
});
