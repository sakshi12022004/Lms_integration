// Step 5: test windows (opens_at / closes_at) and the teacher "close" action. Fake server clock.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { AssessmentService } = require('../../backend/src/core/AssessmentService');
const { AttemptService } = require('../../backend/src/core/AttemptService');
const { validateAssessmentInput } = require('../../backend/src/core/assessmentValidation');
const { createSqliteAssessmentLmsAdapter } = require('../../backend/src/adapters/lms/SqliteAssessmentLmsAdapter');
const { IDS, UP_004, DOWN_004, UP_005, DOWN_005, createLmsTestDb, mcq } = require('../helpers/lmsTestDb');

const T0 = Date.parse('2026-10-05T09:00:00.000Z');
const at = (min) => new Date(T0 + min * 60000).toISOString();
const session = (userId, universityId) => ({ userId, universityId, role: 'x' });
const code = (fn) => { try { fn(); } catch (err) { return err.code; } assert.fail('expected an error'); };

let db, adapter, service, attempts, clock, t1, t2, t3, st1, st2;
beforeEach(() => {
  clock = T0;
  db = createLmsTestDb();
  adapter = createSqliteAssessmentLmsAdapter(db);
  service = new AssessmentService({ adapter, now: () => clock });
  attempts = new AttemptService({ adapter, now: () => clock });
  const r = (id, school) => adapter.resolveActor(session(id, school));
  [t1, t2, t3, st1, st2] = [r(IDS.teacher1, 1), r(IDS.teacher2, 1), r(IDS.teacher3, 2), r(IDS.student1, 1), r(IDS.student2, 1)];
});

/** Published 2-question test for class 10; correct positions [1, 2]. */
function published(window = {}, durationMinutes = 30) {
  const a = service.createAssessment(t1, { title: 'Window test', subject: 'Science', classroomId: IDS.class10, durationMinutes, ...window });
  service.addQuestion(t1, a.id, mcq('Q1?', 1));
  service.addQuestion(t1, a.id, mcq('Q2?', 2));
  return service.publish(t1, a.id);
}
const listFor = (student) => attempts.withAttemptStatus(student, service.listAvailableForStudent(student));

describe('window fields: validation and storage', () => {
  it('accepts ISO datetimes with a timezone and normalizes them to UTC', () => {
    const v = validateAssessmentInput({ title: 't', subject: 's', opensAt: '2026-10-05T14:30:00+05:30', closesAt: '2026-10-05T10:00:00Z' });
    assert.deepEqual([v.opensAt, v.closesAt], ['2026-10-05T09:00:00.000Z', '2026-10-05T10:00:00.000Z']);
  });

  it('rejects datetimes without a timezone, garbage, and closes <= opens', () => {
    const details = (input) => { try { validateAssessmentInput(input); } catch (e) { return e.details.map((d) => `${d.field}:${d.code}`); } return []; };
    assert.deepEqual(details({ title: 't', subject: 's', opensAt: '2026-10-05T09:00' }), ['opensAt:INVALID_DATETIME']);
    assert.deepEqual(details({ title: 't', subject: 's', closesAt: 'tomorrow' }), ['closesAt:INVALID_DATETIME']);
    assert.deepEqual(details({ title: 't', subject: 's', closesAt: 1760000000000 }), ['closesAt:INVALID_DATETIME']);
    assert.deepEqual(details({ title: 't', subject: 's', opensAt: at(60), closesAt: at(60) }), ['closesAt:CLOSES_BEFORE_OPENS']);
  });

  it('is stored and returned to the teacher; editing keeps the window ordered with stored values', () => {
    const a = service.createAssessment(t1, { title: 't', subject: 's', opensAt: at(60), closesAt: at(120) });
    assert.deepEqual([a.opensAt, a.closesAt, a.closedAt], [at(60), at(120), null]);
    assert.equal(code(() => service.updateAssessment(t1, a.id, { closesAt: at(30) })), 'VALIDATION_FAILED'); // before stored opensAt
    assert.equal(service.updateAssessment(t1, a.id, { opensAt: null, closesAt: at(30) }).closesAt, at(30));
  });

  it('a test without a window behaves exactly as before (always open, duration-only deadline)', () => {
    const p = published({}, 10);
    assert.equal(listFor(st1)[0].availability, 'open');
    assert.equal(attempts.startAttempt(st1, p.id).attempt.deadlineAt, at(10));
  });
});

describe('publishing with a window', () => {
  it('refuses to publish when closesAt is already in the past', () => {
    const a = service.createAssessment(t1, { title: 't', subject: 's', classroomId: IDS.class10, closesAt: at(5) });
    service.addQuestion(t1, a.id, mcq());
    clock = Date.parse(at(5));
    try { service.publish(t1, a.id); assert.fail('should not publish'); } catch (e) {
      assert.equal(e.code, 'NOT_PUBLISHABLE');
      assert.deepEqual(e.details, [{ field: 'closesAt', code: 'CLOSES_IN_PAST' }]);
    }
  });

  it('a future opensAt can be published (students see it as upcoming)', () => {
    published({ opensAt: at(60) });
    assert.equal(listFor(st1)[0].availability, 'upcoming');
  });
});

describe('student starts: server clock decides', () => {
  it('before opensAt: TEST_NOT_OPEN (409); at opensAt: allowed', () => {
    const p = published({ opensAt: at(60) });
    assert.equal(code(() => attempts.startAttempt(st1, p.id)), 'TEST_NOT_OPEN');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM aia_attempts').get().n, 0);
    clock = Date.parse(at(60));
    assert.equal(attempts.startAttempt(st1, p.id).created, true);
    assert.equal(listFor(st1)[0].availability, 'open');
  });

  it('at/after closesAt: TEST_CLOSED (409), shown as closed', () => {
    const p = published({ closesAt: at(60) });
    clock = Date.parse(at(60));
    assert.equal(code(() => attempts.startAttempt(st1, p.id)), 'TEST_CLOSED');
    assert.equal(listFor(st1)[0].availability, 'closed');
  });

  it('the attempt deadline is capped at closesAt (earlier of start + duration and the close time)', () => {
    const p = published({ closesAt: at(40) }, 30);
    clock = Date.parse(at(20)); // start 20 min in: duration would end at +50, window ends at +40
    const { attempt } = attempts.startAttempt(st1, p.id);
    assert.equal(attempt.deadlineAt, at(40));
    clock = Date.parse(at(40));
    assert.equal(code(() => attempts.saveAnswer(st1, attempt.id, attempt.questions[0].id, { optionPosition: 1 })), 'ATTEMPT_EXPIRED');
    assert.equal(attempts.getResult(st1, attempt.id).finishedAt, at(40));
  });

  it('an untimed test with closesAt gets closesAt as its deadline', () => {
    const p = published({ closesAt: at(90) }, null);
    assert.equal(attempts.startAttempt(st1, p.id).attempt.deadlineAt, at(90));
  });

  it('an attempt already started can still be resumed/viewed after the window closes (result)', () => {
    const p = published({ closesAt: at(30) }, 10);
    const { attempt } = attempts.startAttempt(st1, p.id);
    attempts.saveAnswer(st1, attempt.id, attempt.questions[0].id, { optionPosition: 1 });
    attempts.submit(st1, attempt.id);
    clock = Date.parse(at(100));
    const again = attempts.startAttempt(st1, p.id); // resume returns the existing (finished) attempt, no error
    assert.deepEqual([again.created, again.attempt.status, again.attempt.result.score], [false, 'submitted', 1]);
  });
});

describe('teacher close action', () => {
  it('closes now: new starts refused, in-progress attempts finalized and graded at the close time', () => {
    const p = published({}, 30);
    const a1 = attempts.startAttempt(st1, p.id).attempt;
    attempts.saveAnswer(st1, a1.id, a1.questions[0].id, { optionPosition: 1 }); // correct
    clock += 5 * 60000;
    const out = attempts.closeAssessment(t1, p.id);
    assert.deepEqual(out, { closedAt: at(5), attemptsFinalized: 1 });

    const r = attempts.getResult(st1, a1.id);
    assert.deepEqual([r.status, r.finishedAt, r.result.score, r.result.unattempted], ['expired', at(5), 1, 1]);
    assert.equal(code(() => attempts.saveAnswer(st1, a1.id, a1.questions[1].id, { optionPosition: 2 })), 'ATTEMPT_EXPIRED');
    assert.equal(code(() => attempts.startAttempt(st2, p.id)), 'NOT_FOUND'); // other class: invisible anyway
    assert.equal(listFor(st1)[0].availability, 'closed');
    assert.equal(service.getOwnAssessment(t1, p.id).closedAt, at(5));
  });

  it('students in the class who never started are "missed" in the report once closed', () => {
    const p = published();
    attempts.closeAssessment(t1, p.id);
    const { students, assessment } = attempts.report(t1, p.id);
    assert.equal(assessment.availability, 'closed');
    assert.deepEqual(students.map((s) => [s.studentName, s.status]), [['Student One', 'missed']]);
  });

  it('a submitted attempt is untouched by closing; an attempt past its own deadline keeps that deadline', () => {
    const p = published({}, 10);
    const a1 = attempts.startAttempt(st1, p.id).attempt;
    clock += 60 * 60000; // way past st1's own 10-minute deadline, nobody touched it
    attempts.closeAssessment(t1, p.id);
    assert.equal(attempts.getResult(st1, a1.id).finishedAt, at(10)); // its deadline, not the close time
  });

  it('only the owning teacher can close; students/other teachers/other schools cannot; drafts and closed tests cannot', () => {
    const p = published();
    assert.equal(code(() => attempts.closeAssessment(st1, p.id)), 'FORBIDDEN');
    assert.equal(code(() => attempts.closeAssessment(t2, p.id)), 'NOT_FOUND');
    assert.equal(code(() => attempts.closeAssessment(t3, p.id)), 'NOT_FOUND');
    const draft = service.createAssessment(t1, { title: 'D', subject: 'S' });
    assert.equal(code(() => attempts.closeAssessment(t1, draft.id)), 'NOT_PUBLISHED');
    attempts.closeAssessment(t1, p.id);
    assert.equal(code(() => attempts.closeAssessment(t1, p.id)), 'ALREADY_CLOSED');
    assert.equal(service.getOwnAssessment(t1, p.id).closedAt, at(0));
  });

  it('a closed test WITHOUT attempts can be unpublished back to a clean (not closed) draft', () => {
    const p = published();
    attempts.closeAssessment(t1, p.id);
    const d = service.unpublish(t1, p.id);
    assert.deepEqual([d.status, d.closedAt], ['draft', null]);
  });

  it('a closed test WITH attempts stays locked (Step 3 rule unchanged)', () => {
    const p = published();
    attempts.startAttempt(st1, p.id);
    attempts.closeAssessment(t1, p.id);
    assert.equal(code(() => service.unpublish(t1, p.id)), 'ASSESSMENT_HAS_ATTEMPTS');
  });
});

describe('migration 004', () => {
  it('adds exactly three columns to aia_assessments; down removes them; adapter not ready without it', () => {
    const d = createLmsTestDb({ withStep5: false });
    const cols = () => d.prepare('PRAGMA table_info(aia_assessments)').all().map((c) => c.name);
    const objects = () => d.prepare('SELECT name FROM sqlite_master ORDER BY name').all().map((r) => r.name);
    const before = cols();
    const objectsBefore = objects();
    assert.equal(createSqliteAssessmentLmsAdapter(d).isReady(), false);
    d.exec(fs.readFileSync(UP_004, 'utf8'));
    assert.deepEqual(cols(), [...before, 'opens_at', 'closes_at', 'closed_at']);
    assert.deepEqual(objects(), objectsBefore);
    d.exec(fs.readFileSync(UP_005, 'utf8')); // readiness also needs the Step 6 archive table
    assert.equal(createSqliteAssessmentLmsAdapter(d).isReady(), true);
    d.exec(fs.readFileSync(DOWN_005, 'utf8'));
    d.exec(fs.readFileSync(DOWN_004, 'utf8'));
    assert.deepEqual(cols(), before);
  });
});
