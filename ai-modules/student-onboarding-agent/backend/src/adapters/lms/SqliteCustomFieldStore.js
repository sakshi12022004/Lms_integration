const fs = require('fs');
const path = require('path');
const { ValidationError } = require('../../errors');
const { validateFieldDefinition, checkLabel, checkDataType, KEY_PATTERN } = require('../../customFields/CustomFieldRules');

/**
 * Admin-approved custom student field DEFINITIONS (migration 003) for ONE verified admin of ONE school.
 *
 * - Every query is scoped by the actor's university_id; another school's fields do not exist here.
 * - The actor is re-checked against the LMS inside every write transaction (admin, same school).
 * - The field key is DATA in a parameterized statement - never an SQL identifier. No column is ever
 *   added to any table; a field is one row in soa_custom_fields. No SQL text comes from the AI or client.
 * - Writes: insert a field (ensureField); rename its label / change its type while it holds NO value
 *   (updateField); retire it (retireField: kept with its values, no longer offered for new imports); and
 *   remove a field THIS approval just created and that holds no value (compensation when the import job
 *   could not record the approval). Nothing else is ever deleted.
 * Values are written by SqliteLmsAdapter.createStudent, in the same transaction as the student.
 */
const TABLES = Object.freeze(['soa_custom_fields', 'soa_custom_field_values']);

class SqliteCustomFieldStore {
  constructor({ connection, actor, schema, now = () => Date.now() }) {
    this.conn = connection;
    this.actor = actor;
    this.schema = schema;
    this.now = now;
  }

  /** Migration 003 applied? */
  isReady() {
    const n = this.conn.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (${TABLES.map(() => '?').join(', ')})`).get(...TABLES).n;
    return n === TABLES.length;
  }

  requireReady() {
    if (!this.isReady()) {
      throw new ValidationError('Custom student fields are not available yet (a database update is pending).', [], { code: 'CUSTOM_FIELDS_NOT_READY', statusCode: 503 });
    }
  }

  /**
   * Creates the field for this school, or returns the existing field with the same key and type.
   * Validated again here (never trusting the caller). Atomic: one transaction, one row.
   * Returns { field: { id, key, label, dataType }, created }.
   */
  ensureField(definition) {
    this.requireReady();
    const checked = validateFieldDefinition(definition, this.schema);
    if (checked.errors) throw new ValidationError('The field definition is not valid.', checked.errors, { code: 'INVALID_FIELD_DEFINITION' });
    const { key, label, dataType } = checked.field;
    return this.transaction(() => {
      this.verifyActor();
      const existing = this.conn.prepare('SELECT id, field_key, label, data_type, retired_at FROM soa_custom_fields WHERE university_id = ? AND field_key = ?')
        .get(this.actor.universityId, key);
      if (existing) {
        if (existing.retired_at !== null && existing.retired_at !== undefined) {
          throw new ValidationError(`The field "${key}" exists but is retired. Use another key.`, [], { code: 'FIELD_RETIRED', statusCode: 409 });
        }
        if (existing.data_type !== dataType) {
          throw new ValidationError(`This school already has a field "${key}" of type ${existing.data_type}.`, [], { code: 'FIELD_KEY_CONFLICT', statusCode: 409 });
        }
        return { field: view(existing), created: false };
      }
      const id = Number(this.conn.prepare('INSERT INTO soa_custom_fields (university_id, field_key, label, data_type, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(this.actor.universityId, key, label, dataType, this.actor.userId, this.now()).lastInsertRowid);
      return { field: { id, key, label, dataType }, created: true };
    });
  }

  /** Compensation only: removes a field of this school that has no value at all. Returns true if removed. */
  removeUnusedField(fieldId) {
    return this.transaction(() => Number(this.conn.prepare(`DELETE FROM soa_custom_fields WHERE id = ? AND university_id = ?
      AND NOT EXISTS (SELECT 1 FROM soa_custom_field_values v WHERE v.field_id = soa_custom_fields.id)`).run(fieldId, this.actor.universityId).changes) === 1);
  }

  /** This school's field definitions (active and retired), with how many values each holds. */
  listFields() {
    if (!this.isReady()) return [];
    return this.conn.prepare(`SELECT f.id, f.field_key, f.label, f.data_type, f.created_at, f.updated_at, f.retired_at,
        (SELECT COUNT(*) FROM soa_custom_field_values v WHERE v.field_id = f.id AND v.university_id = f.university_id) AS value_count
      FROM soa_custom_fields f WHERE f.university_id = ? ORDER BY f.id`)
      .all(this.actor.universityId).map((r) => ({
        ...view(r), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), retired: r.retired_at !== null, retiredAt: iso(r.retired_at),
        valueCount: r.value_count, hasValues: r.value_count > 0,
      }));
  }

  /** ACTIVE fields of this school only: the targets offered to the mapper for a new import (compact). */
  listActiveTargets() {
    if (!this.isReady()) return [];
    return this.conn.prepare('SELECT id, field_key, label, data_type FROM soa_custom_fields WHERE university_id = ? AND retired_at IS NULL ORDER BY id')
      .all(this.actor.universityId).map(view);
  }

  /**
   * Admin edit: { label?, dataType? }. The key never changes (values stay attached). A type change is
   * refused once the field holds a value (no silent conversion); a retired field cannot be edited.
   */
  updateField(key, changes) {
    this.requireReady();
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some((k) => !['label', 'dataType'].includes(k)) || Object.keys(changes).length === 0) {
      throw new ValidationError('Send { label } and/or { dataType }.', [], { code: 'INVALID_REQUEST' });
    }
    const errors = [changes.label !== undefined ? checkLabel(changes.label) : null, changes.dataType !== undefined ? checkDataType(changes.dataType) : null].filter(Boolean);
    if (errors.length) throw new ValidationError('The field definition is not valid.', errors, { code: 'INVALID_FIELD_DEFINITION' });
    return this.transaction(() => {
      this.verifyActor();
      const row = this.findOwn(key);
      if (row.retired_at !== null) throw new ValidationError('A retired field cannot be edited.', [], { code: 'FIELD_RETIRED', statusCode: 409 });
      if (changes.dataType !== undefined && changes.dataType !== row.data_type) {
        const used = this.conn.prepare('SELECT COUNT(*) AS n FROM soa_custom_field_values WHERE field_id = ? AND university_id = ?').get(row.id, this.actor.universityId).n;
        if (used > 0) {
          throw new ValidationError('The type cannot change: this field already holds values. Create a new field instead.', [], { code: 'TYPE_CHANGE_REFUSED', statusCode: 409 });
        }
      }
      this.conn.prepare('UPDATE soa_custom_fields SET label = ?, data_type = ?, updated_at = ? WHERE id = ? AND university_id = ?')
        .run(changes.label !== undefined ? changes.label.trim() : row.label, changes.dataType !== undefined ? changes.dataType : row.data_type, this.now(), row.id, this.actor.universityId);
      return this.listFields().find((f) => f.id === row.id);
    });
  }

  /** Retire (never delete): values are kept and stay readable; the field is no longer offered for imports. */
  retireField(key) {
    this.requireReady();
    return this.transaction(() => {
      this.verifyActor();
      const row = this.findOwn(key);
      if (row.retired_at === null) {
        this.conn.prepare('UPDATE soa_custom_fields SET retired_at = ?, retired_by = ? WHERE id = ? AND university_id = ? AND retired_at IS NULL')
          .run(this.now(), this.actor.userId, row.id, this.actor.universityId);
      }
      return this.listFields().find((f) => f.id === row.id);
    });
  }

  /** A field of THIS school by key, or 404 (another school's field "does not exist"). */
  findOwn(key) {
    const row = typeof key === 'string' && KEY_PATTERN.test(key)
      ? this.conn.prepare('SELECT id, field_key, label, data_type, retired_at FROM soa_custom_fields WHERE university_id = ? AND field_key = ?').get(this.actor.universityId, key)
      : null;
    if (!row) throw new ValidationError('Custom field not found.', [], { code: 'FIELD_NOT_FOUND', statusCode: 404 });
    return row;
  }

  /**
   * Custom values of one student of THIS school, by the onboarding reference "lms-student:<studentId>".
   * Another school's (or an unknown) student is "not found".
   */
  getStudentValues(studentRef) {
    this.requireReady();
    const m = /^lms-student:([A-Za-z0-9-]{1,40})$/.exec(String(studentRef || ''));
    const student = m ? this.conn.prepare(`SELECT u.id FROM students s JOIN users u ON u.id = s.userId
      WHERE s.studentId = ? AND u.role = 'student' AND u.university_id = ?`).get(m[1], this.actor.universityId) : null;
    if (!student) throw new ValidationError('Student not found.', [], { code: 'STUDENT_NOT_FOUND', statusCode: 404 });
    return this.valuesOf(student.id);
  }

  /**
   * A STUDENT's own custom values (the actor is the student). Checked against the LMS: the user exists, is a
   * student of exactly this school. Returns [] before migration 003. Never another user's values.
   */
  getOwnValues() {
    const user = this.conn.prepare('SELECT role, university_id FROM users WHERE id = ?').get(this.actor.userId);
    if (!user || user.role !== 'student' || Number(user.university_id) !== this.actor.universityId) {
      throw new ValidationError('Your account does not match this school.', [], { code: 'TENANT_MISMATCH', statusCode: 403 });
    }
    return this.isReady() ? this.valuesOf(this.actor.userId) : [];
  }

  /** Values of one user of this school; retired fields are included (historical data), flagged. */
  valuesOf(userId) {
    return this.conn.prepare(`SELECT f.field_key, f.label, f.data_type, f.retired_at, v.value FROM soa_custom_field_values v
      JOIN soa_custom_fields f ON f.id = v.field_id AND f.university_id = v.university_id
      WHERE v.university_id = ? AND v.user_id = ? ORDER BY f.id`).all(this.actor.universityId, userId)
      .map((r) => ({ key: r.field_key, label: r.label, dataType: r.data_type, value: r.value, retired: r.retired_at !== null }));
  }

  verifyActor() {
    const user = this.conn.prepare('SELECT role, university_id FROM users WHERE id = ?').get(this.actor.userId);
    if (!user || user.role !== 'admin' || Number(user.university_id) !== this.actor.universityId) {
      throw new ValidationError('Your account does not match this school.', [], { code: 'TENANT_MISMATCH', statusCode: 403 });
    }
  }

  transaction(work) {
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      const out = work();
      this.conn.exec('COMMIT');
      return out;
    } catch (err) {
      try { this.conn.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw err;
    }
  }
}

const view = (r) => ({ id: r.id, key: r.field_key, label: r.label, dataType: r.data_type });
const iso = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());

/** Opens a dedicated connection for one request: { store, close }. */
function openCustomFieldStore({ dbPath, actor, schema, now }) {
  if (typeof dbPath !== 'string' || !path.isAbsolute(dbPath) || !fs.existsSync(dbPath)) {
    throw new ValidationError('Onboarding is not available.', [], { code: 'LMS_NOT_READY', statusCode: 503 });
  }
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    DatabaseSync = require('better-sqlite3');
  }
  const connection = new DatabaseSync(dbPath);
  connection.exec('PRAGMA busy_timeout = 5000');
  return { store: new SqliteCustomFieldStore({ connection, actor, schema, ...(now ? { now } : {}) }), close: () => connection.close() };
}

module.exports = { SqliteCustomFieldStore, openCustomFieldStore, CUSTOM_FIELD_TABLES: TABLES };
