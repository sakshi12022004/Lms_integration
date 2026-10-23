/**
 * Data integrity: registers, results, procurement records and the staged school-ownership
 * migration. Covers audit findings DATA-004 (multi-step writes), DATA-005 (attendance
 * uniqueness), the class-membership part of SEC-012 and the procurement part of SEC-010.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startTestApp } = require('../helpers/testApp');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const Database = require(path.join(SERVER_ROOT, 'node_modules', 'better-sqlite3'));

describe('data integrity', () => {
  let ctx;
  let ids;
  before(async () => { ctx = await startTestApp(); ids = ctx.ids; });
  after(async () => { await ctx.stop(); });

  describe('attendance register', () => {
    const mark = (account, body) => ctx.api('POST', '/api/attendance/mark', { as: account, body });
    const register = (date) => ctx.db.all('SELECT studentId, status FROM attendance WHERE classroomId = ? AND date = ? ORDER BY studentId', [ids.classroomA, date]);
    const present = (status = 'present') => [{ studentId: ids.users.studentA, status }];

    it('marking the same day again replaces it instead of adding rows', async () => {
      const date = '2026-05-04';
      assert.equal((await mark('mentorA', { classroomId: ids.classroomA, date, attendanceData: present('present') })).status, 200);
      assert.equal((await mark('mentorA', { classroomId: ids.classroomA, date, attendanceData: present('absent') })).status, 200);
      assert.deepEqual(await register(date), [{ studentId: ids.users.studentA, status: 'absent' }]);
    });

    it('a student listed twice in one submission is stored once', async () => {
      const date = '2026-05-05';
      const response = await mark('mentorA', { classroomId: ids.classroomA, date, attendanceData: [...present('absent'), ...present('present')] });
      assert.equal(response.status, 200);
      assert.deepEqual(await register(date), [{ studentId: ids.users.studentA, status: 'present' }]);
    });

    it('a submission naming a student outside the class is refused and the existing day is kept', async () => {
      const date = '2026-05-06';
      await mark('mentorA', { classroomId: ids.classroomA, date, attendanceData: present('present') });
      const response = await mark('adminA', {
        classroomId: ids.classroomA,
        date,
        attendanceData: [...present('absent'), { studentId: ids.users.studentA2, status: 'present' }],
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await register(date), [{ studentId: ids.users.studentA, status: 'present' }]);
    });

    it('two submissions at the same moment leave one row per student', async () => {
      const date = '2026-05-07';
      const results = await Promise.all(
        ['present', 'absent', 'present', 'absent'].map((status) => mark('mentorA', { classroomId: ids.classroomA, date, attendanceData: present(status) }))
      );
      assert.deepEqual(results.map((response) => response.status), [200, 200, 200, 200]);
      assert.equal((await register(date)).length, 1);
    });

    it('malformed registers are rejected', async () => {
      for (const body of [
        {}, { classroomId: ids.classroomA }, { classroomId: ids.classroomA, date: 'not-a-date', attendanceData: [] },
        { classroomId: ids.classroomA, date: '2026-05-08', attendanceData: 'everyone' },
        { classroomId: ids.classroomA, date: '2026-05-08', attendanceData: [{ studentId: ids.users.studentA }] },
        { classroomId: ids.classroomA, date: '2026-05-08', attendanceData: [{ studentId: ids.users.studentA, status: 'x'.repeat(200) }] },
        { classroomId: ids.classroomA, date: '2026-05-08', attendanceData: [{ studentId: ids.users.studentA, status: 'late' }] },
      ]) {
        assert.equal((await mark('mentorA', body)).status, 400, JSON.stringify(body).slice(0, 80));
      }
      assert.deepEqual(await register('2026-05-08'), []);
    });

    it('the database itself refuses a second row for the same student, class and day', async () => {
      await assert.rejects(
        ctx.db.run("INSERT INTO attendance (classroomId, studentId, date, status, markedBy) VALUES (?, ?, '2026-05-04', 'present', ?)", [ids.classroomA, ids.users.studentA, ids.users.mentorA]),
        /UNIQUE constraint failed/
      );
    });
  });

  describe('term results', () => {
    const save = (body) => ctx.api('POST', '/api/results', { as: 'mentorA', body });
    const subjects = [{ name: 'Maths', marks: 30, total: 50, status: 'PASS' }];

    it('saving the same student and term twice updates one result', async () => {
      const first = await save({ classroomId: ids.classroomA, studentId: ids.users.studentA, term: 'Final', subjects });
      const second = await save({ classroomId: ids.classroomA, studentId: ids.users.studentA, term: 'Final', subjects: [{ name: 'Maths', marks: 10, total: 50, status: 'FAIL' }] });
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      const rows = await ctx.db.all("SELECT overallStatus FROM results WHERE studentId = ? AND classroomId = ? AND term = 'Final'", [ids.users.studentA, ids.classroomA]);
      assert.deepEqual(rows, [{ overallStatus: 'FAIL' }]);
    });

    it('a result cannot be recorded for a student who is not in that classroom', async () => {
      const response = await ctx.api('POST', '/api/results', { as: 'adminA', body: { classroomId: ids.classroomA, studentId: ids.users.studentA2, term: 'Final', subjects } });
      assert.equal(response.status, 400);
      assert.equal((await ctx.db.get('SELECT COUNT(*) AS n FROM results WHERE studentId = ? AND classroomId = ?', [ids.users.studentA2, ids.classroomA])).n, 0);
    });

    it('missing fields are rejected', async () => {
      assert.equal((await save({ studentId: ids.users.studentA })).status, 400);
      assert.equal((await save({ classroomId: ids.classroomA })).status, 400);
    });
  });

  describe('procurement records belong to one school', () => {
    it('expenses: each school sees and changes only its own', async () => {
      const mine = await ctx.api('POST', '/api/expenses', { as: 'adminA', body: { description: 'EXPENSE-A', amount: 100, category: 'Supplies' } });
      const theirs = await ctx.api('POST', '/api/expenses', { as: 'adminB', body: { description: 'EXPENSE-B', amount: 999, category: 'Supplies' } });
      assert.ok(mine.status < 300 && theirs.status < 300, `${mine.status} ${theirs.status}`);

      const listA = await ctx.api('GET', '/api/expenses', { as: 'accountantA' });
      assert.ok(listA.text.includes('EXPENSE-A'));
      assert.equal(listA.text.includes('EXPENSE-B'), false);
      const summaryA = await ctx.api('GET', '/api/expenses/summary', { as: 'accountantA' });
      assert.equal(summaryA.text.includes('999'), false);

      const expenseB = await ctx.db.get("SELECT id, status FROM expenses WHERE description = 'EXPENSE-B'");
      await ctx.api('PATCH', `/api/expenses/${expenseB.id}/status`, { as: 'accountantA', body: { status: 'approved' } });
      assert.equal((await ctx.db.get('SELECT status FROM expenses WHERE id = ?', [expenseB.id])).status, expenseB.status);
    });

    it('orders: each school sees and changes only its own', async () => {
      const placed = await ctx.api('POST', '/api/orders', { as: 'storekeeperA', body: { itemName: 'ORDER-ITEM-A', quantity: 2, unitPrice: 10 } });
      assert.ok(placed.status < 300, `${placed.status} ${placed.text.slice(0, 120)}`);
      await ctx.db.run("INSERT INTO orders (storekeeperId, itemName, quantity, unitPrice, totalAmount, status, university_id) VALUES (?, 'ORDER-ITEM-B', 1, 5, 5, 'pending', ?)", [ids.users.adminB, ids.schoolB]);

      const listA = await ctx.api('GET', '/api/orders', { as: 'accountantA' });
      assert.ok(listA.text.includes('ORDER-ITEM-A'));
      assert.equal(listA.text.includes('ORDER-ITEM-B'), false);

      const orderB = await ctx.db.get("SELECT id FROM orders WHERE itemName = 'ORDER-ITEM-B'");
      await ctx.api('PATCH', `/api/orders/${orderB.id}/status`, { as: 'storekeeperA', body: { status: 'delivered' } });
      assert.equal((await ctx.db.get('SELECT status FROM orders WHERE id = ?', [orderB.id])).status, 'pending');
    });

    it('inventory, vendors and stock requests: each school sees and changes only its own', async () => {
      await ctx.db.run("INSERT INTO inventory (itemName, category, quantity, unitPrice, university_id) VALUES ('INVENTORY-A', 'Stationery', 5, 10, ?), ('INVENTORY-B', 'Stationery', 5, 10, ?)", [ids.schoolA, ids.schoolB]);
      await ctx.db.run("INSERT INTO vendors (name, email, category, university_id) VALUES ('VENDOR-A', 'va@test.invalid', 'Books', ?), ('VENDOR-B', 'vb@test.invalid', 'Books', ?)", [ids.schoolA, ids.schoolB]);
      await ctx.db.run("INSERT INTO stock_requests (request_number, storekeeper_id, university_id, title, status) VALUES ('REQ-A-1', ?, ?, 'STOCK-REQUEST-A', 'pending'), ('REQ-B-1', ?, ?, 'STOCK-REQUEST-B', 'pending')", [ids.users.storekeeperA, ids.schoolA, ids.users.adminB, ids.schoolB]);

      for (const [url, mine, theirs] of [
        ['/api/storekeeper/inventory', 'INVENTORY-A', 'INVENTORY-B'],
        ['/api/storekeeper/vendors', 'VENDOR-A', 'VENDOR-B'],
        ['/api/stock-requests', 'STOCK-REQUEST-A', 'STOCK-REQUEST-B'],
        ['/api/stock-requests/dashboard/stats', null, 'STOCK-REQUEST-B'],
      ]) {
        const response = await ctx.api('GET', url, { as: 'storekeeperA' });
        assert.equal(response.status, 200, `${url} -> ${response.status} ${response.text.slice(0, 120)}`);
        if (mine) assert.ok(response.text.includes(mine), `${url} does not show the school's own record`);
        assert.equal(response.text.includes(theirs), false, `${url} leaked another school's record`);
      }

      const requestB = await ctx.db.get("SELECT id FROM stock_requests WHERE title = 'STOCK-REQUEST-B'");
      assert.equal((await ctx.api('GET', `/api/stock-requests/${requestB.id}`, { as: 'storekeeperA' })).status, 404);
      await ctx.api('PUT', `/api/stock-requests/${requestB.id}`, { as: 'storekeeperA', body: { title: 'HACKED', status: 'approved' } });
      await ctx.api('DELETE', `/api/stock-requests/${requestB.id}`, { as: 'storekeeperA' });
      assert.deepEqual(await ctx.db.get('SELECT title, status FROM stock_requests WHERE id = ?', [requestB.id]), { title: 'STOCK-REQUEST-B', status: 'pending' });
    });

    it('rows from before the school column (no school) are shown to no school', async () => {
      await ctx.db.run("INSERT INTO expenses (description, amount, category, date, status) VALUES ('LEGACY-EXPENSE', 1, 'Other', '2025-01-01', 'pending')");
      for (const account of ['accountantA', 'adminA', 'adminB']) {
        assert.equal((await ctx.api('GET', '/api/expenses', { as: account })).text.includes('LEGACY-EXPENSE'), false, account);
      }
    });
  });

  describe('backup and restore drill', () => {
    const script = path.join(SERVER_ROOT, 'scripts', 'ops', 'backup-and-verify.js');
    const run = (dbFile, outDir) => {
      try {
        return { code: 0, output: execFileSync(process.execPath, [script, '--db', dbFile, '--out', outDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
      } catch (error) {
        return { code: error.status, output: `${error.stdout || ''}${error.stderr || ''}` };
      }
    };

    it('a backup taken while the server is running restores to the same data', async () => {
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-backup-drill-'));
      const { code, output } = run(ctx.dbPath, outDir);
      assert.equal(code, 0, output);
      assert.match(output, /Verified/);

      // "Restore": open the backup as a database of its own and compare real content
      const backupFile = path.join(outDir, fs.readdirSync(outDir)[0]);
      const restored = new Database(backupFile, { readonly: true });
      try {
        const users = restored.prepare('SELECT id, email, role, university_id FROM users ORDER BY id').all();
        assert.deepEqual(users, await ctx.db.all('SELECT id, email, role, university_id FROM users ORDER BY id'));
        assert.deepEqual(
          restored.prepare('SELECT id, studentId, amount, transactionId FROM payments ORDER BY id').all(),
          await ctx.db.all('SELECT id, studentId, amount, transactionId FROM payments ORDER BY id')
        );
        assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'idx_attendance_one_per_day'").get().n, 1);
      } finally {
        restored.close();
      }
    });

    it('a damaged file is reported, not accepted as a backup source', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-backup-bad-'));
      const broken = path.join(dir, 'broken.db');
      fs.writeFileSync(broken, Buffer.from('this is not a database file at all, just text'.repeat(40)));
      assert.notEqual(run(broken, path.join(dir, 'out')).code, 0);
      assert.equal(run(path.join(dir, 'missing.db'), path.join(dir, 'out')).code, 1);
    });
  });

  describe('school-ownership reconciliation script (on a disposable copy)', () => {
    const script = path.join(SERVER_ROOT, 'scripts', 'security', 'reconcile-school-ownership.js');
    let copyPath;
    const runScript = (...args) => {
      try {
        return { code: 0, output: execFileSync(process.execPath, [script, '--db', copyPath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
      } catch (error) {
        return { code: error.status, output: `${error.stdout || ''}${error.stderr || ''}` };
      }
    };
    const count = (sql) => {
      const db = new Database(copyPath, { readonly: true });
      try { return db.prepare(sql).get().n; } finally { db.close(); }
    };

    before(async () => {
      await ctx.db.run("INSERT INTO orders (storekeeperId, itemName, quantity, unitPrice, totalAmount, status) VALUES (?, 'LEGACY-ORDER', 1, 1, 1, 'pending')", [ids.users.storekeeperA]);
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-reconcile-test-'));
      copyPath = path.join(directory, 'copy.db');
      const source = new Database(ctx.dbPath, { readonly: true });
      await source.backup(copyPath);
      source.close();
    });

    it('report mode changes nothing', () => {
      const before = fs.readFileSync(copyPath);
      const { code, output } = runScript();
      assert.equal(code, 0);
      assert.match(output, /Report only: nothing was changed/);
      assert.match(output, /orders\s+\d+\s+1\s+1/); // one order without a school, derivable from its storekeeper
      assert.ok(before.equals(fs.readFileSync(copyPath)));
    });

    it('refuses to pour every unassigned row into one school when there are several schools', () => {
      const { code, output } = runScript('--assign-remaining', '1');
      assert.equal(code, 1);
      assert.match(output, /more than one school/);
      assert.equal(count("SELECT COUNT(*) AS n FROM expenses WHERE description = 'LEGACY-EXPENSE' AND university_id IS NULL"), 1);
    });

    it('refuses a school that does not exist', () => {
      assert.equal(runScript('--assign-remaining', '999', '--i-have-checked').code, 1);
    });

    it('--apply-derived fills only what a link proves, after writing a backup', () => {
      const { code, output } = runScript('--apply-derived');
      assert.equal(code, 0, output);
      assert.match(output, /Backup written/);
      assert.equal(count("SELECT COUNT(*) AS n FROM orders WHERE itemName = 'LEGACY-ORDER' AND university_id = 1"), 1);
      // an expense has no link to a school: it is left for a human decision
      assert.equal(count("SELECT COUNT(*) AS n FROM expenses WHERE description = 'LEGACY-EXPENSE' AND university_id IS NULL"), 1);
      const backups = fs.readdirSync(path.dirname(copyPath)).filter((name) => name.includes('.pre-school-reconcile.'));
      assert.equal(backups.length, 1);
      // the backup is the state from before the change and can be restored
      const backup = new Database(path.join(path.dirname(copyPath), backups[0]), { readonly: true });
      assert.equal(backup.prepare("SELECT COUNT(*) AS n FROM orders WHERE itemName = 'LEGACY-ORDER' AND university_id IS NULL").get().n, 1);
      backup.close();
    });

    it('never touches the database the application is using', async () => {
      assert.equal((await ctx.db.get("SELECT university_id FROM orders WHERE itemName = 'LEGACY-ORDER'")).university_id, null);
    });
  });
});
