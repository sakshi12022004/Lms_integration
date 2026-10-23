/**
 * Starts the real server (node server.js) as a separate process, the way an operator
 * would, against a database file in the OS temp folder. Used by the startup tests:
 * restart behaviour and configuration checks can only be observed across processes.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { REAL_SERVICE_VARIABLES } = require('./testApp');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

function temporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-startup-test-'));
  return { directory, dbPath: path.join(directory, 'lms-startup.db') };
}

// A minimal, safe environment: nothing from the developer's shell or .env that could
// reach a real mail server, payment gateway, AI provider or database.
function environment(dbPath, overrides) {
  const base = { ...process.env };
  for (const name of [...REAL_SERVICE_VARIABLES, 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'NODE_ENV', 'CORS_ORIGINS', 'FRONTEND_ORIGIN', 'SEED_DEMO_DATA', 'PORT']) {
    delete base[name];
  }
  const env = {
    ...base,
    LMS_SKIP_DOTENV: 'true',
    LMS_SQLITE_PATH: dbPath,
    LMS_DISABLE_BACKGROUND_JOBS: 'true',
    EMAIL_TRANSPORT: 'mock',
    USE_POSTGRES: 'false',
    PORT: '0',
    JWT_SECRET: `startup-test-jwt-secret-${'c'.repeat(40)}`,
    JWT_REFRESH_SECRET: `startup-test-refresh-secret-${'d'.repeat(40)}`,
    ...overrides,
  };
  // An override of undefined means "not set at all"
  for (const [name, value] of Object.entries(env)) if (value === undefined) delete env[name];
  return env;
}

/**
 * Resolves once the server is listening (and its start-up database work has settled),
 * or once the process has exited.
 * @returns {Promise<{ listening: boolean, exitCode: number|null, port: number|null, output: string, stop: () => Promise<void> }>}
 */
function startServer(dbPath, overrides = {}, { settleMs = 3500, timeoutMs = 30000 } = {}) {
  return new Promise((resolve) => {
    // The extra channel lets a test ask for a clean stop the way a supervisor does on Windows
    const child = spawn(process.execPath, ['server.js'], { cwd: SERVER_ROOT, env: environment(dbPath, overrides), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let output = '';
    let settled = false;
    let exitCode = null;

    /** Asks the server to shut down cleanly and resolves with its exit code and everything it printed. */
    const shutdownGracefully = () =>
      new Promise((done) => {
        if (exitCode !== null) return done({ exitCode, output });
        child.once('exit', (code) => done({ exitCode: code, output }));
        child.send('shutdown');
      });

    const stop = () =>
      new Promise((done) => {
        if (exitCode !== null) return done();
        child.once('exit', () => done());
        child.kill();
      });
    const finish = (listening, port = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ listening, exitCode, port, output, stop, shutdownGracefully });
    };

    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/Server running on port (\d+)/);
      if (match && !settled) setTimeout(() => finish(true, Number(match[1])), settleMs);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      exitCode = code;
      finish(false);
    });
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

module.exports = { startServer, temporaryDatabase, SERVER_ROOT };
