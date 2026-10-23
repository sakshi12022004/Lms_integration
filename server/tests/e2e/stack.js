/**
 * Starts a throw-away copy of the whole LMS for browser testing and keeps it running:
 *
 *   node tests/e2e/stack.js            (from server/)
 *
 *   - the real server on a new database and uploads folder in the OS temp folder, with the
 *     demo accounts seeded (mail goes to an in-memory outbox; no payment or AI keys);
 *   - a production build of the client pointed at that server, served by `vite preview`.
 *
 * Nothing here can reach server/data, a mail server or the payment gateway (the same
 * safeguards as the automated suites). Stop it with Ctrl+C; the temp folder is removed.
 *
 * Ports: API 5612, web 5178 (an origin the server already allows outside production).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { startServer, temporaryDatabase, SERVER_ROOT } = require('../helpers/serverProcess');

const API_PORT = process.env.E2E_API_PORT || '5612';
const WEB_PORT = process.env.E2E_WEB_PORT || '5178';
const CLIENT_ROOT = path.resolve(SERVER_ROOT, '..', 'client');
const VITE = path.join(CLIENT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const runNode = (args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args[0]} exited with ${code}`))));
  });

(async () => {
  const { dbPath, directory } = temporaryDatabase();
  const serverEnv = {
    PORT: API_PORT,
    SEED_DEMO_DATA: 'true',
    LMS_UPLOADS_DIR: path.join(directory, 'uploads'),
    LMS_ACCESS_LOG: 'off',
    // one browser signs in as many accounts in a few minutes
    RATE_LIMIT_MAX_REQUESTS: '1000000',
  };
  let server = await startServer(dbPath, serverEnv, { settleMs: 6000 });
  if (!server.listening) throw new Error(`server did not start: ${server.output.slice(-400)}`);

  // The AI assessment module's own tables are created by its migration script, never at start-up.
  // This database is a throw-away copy, so apply them here and restart, so the AI pages work too.
  await server.stop();
  await runNode([path.resolve(SERVER_ROOT, '..', 'ai-modules', 'ai-assessment-agent', 'backend', 'scripts', 'applyMigration.js'), '--db', dbPath, '--yes'], { cwd: SERVER_ROOT, stdio: 'ignore' });
  server = await startServer(dbPath, serverEnv, { settleMs: 4000 });
  if (!server.listening) throw new Error(`server did not restart: ${server.output.slice(-400)}`);

  const outDir = path.join(directory, 'client-dist');
  const env = { ...process.env, VITE_BACKEND_URL: `http://localhost:${API_PORT}/api` };
  await runNode([VITE, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: CLIENT_ROOT, env });
  const preview = spawn(process.execPath, [VITE, 'preview', '--outDir', outDir, '--port', WEB_PORT, '--strictPort', '--host', 'localhost'], { cwd: CLIENT_ROOT, env, stdio: 'inherit' });

  console.log(`\nE2E stack ready\n  web: http://localhost:${WEB_PORT}\n  api: http://localhost:${API_PORT}\n  database: ${dbPath}\n`);

  const shutdown = async () => {
    preview.kill();
    await server.stop();
    try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* Windows may still hold the file */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})().catch((err) => {
  console.error('E2E stack failed:', err.message);
  process.exit(1);
});
