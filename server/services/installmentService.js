const { withWriteTransaction, withReadConnection, isBusyError, isConstraintError } = require('./paymentDb');
const {
  MAX_PAYMENT_PAISE,
  parseRupeesToPaise,
  storedRupeesToPaise,
  paiseToRupees,
  splitTotalAcrossStages
} = require('./money');

/**
 * Core Installment Service for Core5 LMS
 * Server-authoritative schedule snapshotting, stage balances in integer paise,
 * strict partial/overpayment validation and idempotent offline collection.
 * All database work runs synchronously on a dedicated connection (see paymentDb.js);
 * `conn` / `db` below are that connection's get/all/run query interface.
 */

class PaymentError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'Demand Draft', 'UPI'];
const SUCCESS_STATUSES_SQL = `('success', 'paid')`;
const FULL_PLAN_ID = 'full';

// Paise value of a payments row; rows written before the paise column fall back to the rupee REAL.
const ROW_PAISE_SQL = `COALESCE(amountPaise, CAST(ROUND(amount * 100) AS INTEGER))`;

function parsePositiveInt(value) {
  return /^[1-9]\d{0,14}$/.test(String(value ?? '').trim()) ? Number(value) : null;
}

/** Trims the key and enforces one canonical form for both lookup and storage. */
function normalizeIdempotencyKey(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(key) ? key : null;
}

function isActivePlan(plan) {
  return plan && plan.isActive !== false && plan.status !== 'inactive';
}

function parseSnapshot(schedule) {
  let stages = [];
  try {
    stages = JSON.parse(schedule.scheduleSnapshot) || [];
  } catch (e) {
    stages = [];
  }
  return stages.map(s => ({
    ...s,
    expectedAmountPaise: Number.isInteger(s.expectedAmountPaise)
      ? s.expectedAmountPaise
      : storedRupeesToPaise(s.expectedAmount)
  }));
}

function getValidStudent(conn, studentId) {
  const user = conn.get(`SELECT id, name, email, role FROM users WHERE id = ?`, [studentId]);
  if (!user) {
    throw new PaymentError(404, 'STUDENT_NOT_FOUND', `Student with ID ${studentId} not found.`);
  }
  if (user.role !== 'student') {
    throw new PaymentError(422, 'NOT_A_STUDENT', `User ${studentId} is not a student.`);
  }
  return user;
}

function getClassroomAssignment(conn, studentId) {
  return conn.get(`SELECT c.id as classroomId, c.name as className, c.grade
     FROM student_classroom_assignment sca
     JOIN classrooms c ON sca.classroomId = c.id
     WHERE sca.studentId = ? LIMIT 1`,
    [studentId]
  );
}

// Primary (grades 1-4) / Secondary fee structure for the student's classroom.
function resolveApplicableFeeStructure(conn, classroomAssignment) {
  const gradeNum = parseInt(classroomAssignment?.grade || '1', 10);
  const isPrimary = !isNaN(gradeNum) && gradeNum >= 1 && gradeNum <= 4;
  const targetCategory = isPrimary ? 'Primary' : 'Secondary';

  const feeStructure = conn.get(`SELECT * FROM feeStructures WHERE LOWER(category) = LOWER(?) ORDER BY id DESC LIMIT 1`,
    [targetCategory]
  );
  return feeStructure || conn.get(`SELECT * FROM feeStructures ORDER BY id ASC LIMIT 1`);
}

/** All of a student's active schedules must be exactly zero or one. */
function getActiveSchedule(conn, studentId) {
  const rows = conn.all(`SELECT * FROM student_fee_schedules WHERE studentId = ? AND status = 'active' ORDER BY id ASC`,
    [studentId]
  );
  if (rows.length > 1) {
    throw new PaymentError(409, 'MULTIPLE_ACTIVE_SCHEDULES', 'Student has more than one active fee schedule; manual reconciliation is required.');
  }
  return rows[0] || null;
}

/** Successful payments that are not tied to a schedule stage (historical rows). */
function getUnallocatedSuccessfulPayments(conn, studentId) {
  return conn.all(`SELECT id, amount, ${ROW_PAISE_SQL} AS paise, type, status, transactionId, createdAt
     FROM payments
     WHERE studentId = ? AND status IN ${SUCCESS_STATUSES_SQL}
       AND (scheduleId IS NULL OR installmentStage IS NULL)
     ORDER BY id ASC`,
    [studentId]
  );
}

/**
 * Builds the immutable stage snapshot for a plan. Stage amounts are integer
 * paise that sum to the total fee exactly (remainder goes to the last stage).
 */
function buildScheduleSnapshot(feeStructure, planId) {
  const totalFeePaise = storedRupeesToPaise(feeStructure.totalFee);
  if (totalFeePaise <= 0) {
    throw new PaymentError(409, 'FEE_STRUCTURE_INVALID', 'The fee structure has no total fee configured.');
  }
  const defaultDueDate = feeStructure.dueDate || new Date().toISOString().split('T')[0];

  let planName = 'Full Payment (100%)';
  let rawStages = [{ number: 1, label: 'Full Fee Clearance (100%)', percentage: 100 }];

  if (planId !== FULL_PLAN_ID) {
    let adminPlans = [];
    try {
      const parsed = typeof feeStructure.installmentOptions === 'string'
        ? JSON.parse(feeStructure.installmentOptions)
        : feeStructure.installmentOptions;
      if (Array.isArray(parsed)) adminPlans = parsed;
    } catch (e) {
      adminPlans = [];
    }

    const matchedPlan = adminPlans.find(p => String(p.id) === String(planId) && isActivePlan(p));
    if (!matchedPlan || !Array.isArray(matchedPlan.installments) || matchedPlan.installments.length === 0) {
      throw new PaymentError(400, 'PLAN_NOT_AVAILABLE', `Requested installment plan '${planId}' is not an active plan for this fee structure.`);
    }
    planName = matchedPlan.name || `Installment Plan (${matchedPlan.installments.length} Stages)`;
    rawStages = matchedPlan.installments;
  }

  let amounts;
  try {
    amounts = splitTotalAcrossStages(totalFeePaise, rawStages.map(s => s.percentage));
  } catch (e) {
    throw new PaymentError(409, 'PLAN_MISCONFIGURED', e.message);
  }

  const stages = rawStages.map((stage, idx) => ({
    stageNumber: Number(stage.number || idx + 1),
    label: stage.label || `Stage ${stage.number || idx + 1}`,
    percentage: stage.percentage !== undefined && stage.percentage !== null && stage.percentage !== ''
      ? Number(stage.percentage)
      : null,
    expectedAmountPaise: amounts[idx],
    expectedAmount: paiseToRupees(amounts[idx]),
    dueDate: stage.dueDate || defaultDueDate
  }));

  if (new Set(stages.map(s => s.stageNumber)).size !== stages.length) {
    throw new PaymentError(409, 'PLAN_MISCONFIGURED', 'Installment plan has duplicate stage numbers.');
  }

  return { planName, totalFeePaise, stages };
}

function buildStageSummaries(stages, schedulePayments, todayStr) {
  return stages.map(stg => {
    const stagePayments = schedulePayments.filter(p => Number(p.installmentStage) === Number(stg.stageNumber));
    const paidPaise = stagePayments.reduce((sum, p) => sum + p.paise, 0);
    const remainingPaise = Math.max(0, stg.expectedAmountPaise - paidPaise);

    let status = 'Pending';
    if (paidPaise >= stg.expectedAmountPaise) {
      status = 'Paid';
    } else if (paidPaise > 0) {
      status = 'Partially Paid';
    } else if (stg.dueDate && stg.dueDate < todayStr) {
      status = 'Overdue';
    }

    return {
      stageNumber: stg.stageNumber,
      label: stg.label || `Stage ${stg.stageNumber}`,
      percentage: stg.percentage,
      expectedAmount: paiseToRupees(stg.expectedAmountPaise),
      expectedAmountPaise: stg.expectedAmountPaise,
      paidAmount: paiseToRupees(paidPaise),
      paidAmountPaise: paidPaise,
      remainingAmount: paiseToRupees(remainingPaise),
      remainingAmountPaise: remainingPaise,
      dueDate: stg.dueDate,
      status,
      payments: stagePayments
    };
  });
}

/**
 * Read-only installment status for a student. Never creates a schedule:
 * viewing the fee page must not lock a plan.
 */
async function calculateStudentInstallmentSummary(database, studentId) {
  return withReadConnection(database, (db) => buildStudentInstallmentSummary(db, studentId));
}

function buildStudentInstallmentSummary(db, studentId) {
  const id = parsePositiveInt(studentId);
  if (id === null) {
    throw new PaymentError(400, 'INVALID_STUDENT_ID', 'A valid student ID is required.');
  }
  const student = getValidStudent(db, id);
  const classroomAssignment = getClassroomAssignment(db, id);
  const activeSchedule = getActiveSchedule(db, id);

  const feeStructure = activeSchedule
    ? db.get(`SELECT * FROM feeStructures WHERE id = ?`, [activeSchedule.feeStructureId])
    : resolveApplicableFeeStructure(db, classroomAssignment);

  const allPayments = db.all(`SELECT id, studentId, amount, ${ROW_PAISE_SQL} AS paise, type, status, transactionId, razorpay_payment_id,
            description, createdAt, scheduleId, feeStructureId, planId, installmentStage,
            receiptNo, paymentMethod, referenceNo
     FROM payments
     WHERE studentId = ?
     ORDER BY createdAt ASC, id ASC`,
    [id]
  );

  const successfulPayments = allPayments.filter(p => p.status === 'success' || p.status === 'paid');
  const lifetimePaidPaise = successfulPayments.reduce((sum, p) => sum + p.paise, 0);

  // A payment is "allocated" only if it actually points at a schedule stage.
  // (The allocationStatus column defaulted to 'allocated' on historical rows, so it is not trusted.)
  const isAllocated = p => p.scheduleId !== null && p.installmentStage !== null;
  const unallocatedPayments = allPayments.filter(p => !isAllocated(p));
  const unallocatedPaidPaise = unallocatedPayments
    .filter(p => p.status === 'success' || p.status === 'paid')
    .reduce((sum, p) => sum + p.paise, 0);

  let stageSummaries = [];
  if (activeSchedule) {
    const schedulePayments = successfulPayments.filter(p => Number(p.scheduleId) === Number(activeSchedule.id) && isAllocated(p));
    stageSummaries = buildStageSummaries(parseSnapshot(activeSchedule), schedulePayments, new Date().toISOString().split('T')[0]);
  }

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      className: classroomAssignment?.className || 'Classroom',
      grade: classroomAssignment?.grade || '1'
    },
    feeStructure: feeStructure ? {
      id: feeStructure.id,
      category: feeStructure.category,
      totalFee: Number(feeStructure.totalFee || 0),
      totalFeePaise: storedRupeesToPaise(feeStructure.totalFee),
      dueDate: feeStructure.dueDate
    } : null,
    activeSchedule: activeSchedule ? {
      id: activeSchedule.id,
      feeStructureId: activeSchedule.feeStructureId,
      planId: activeSchedule.planId,
      planName: activeSchedule.planName,
      totalFee: activeSchedule.totalFee,
      totalFeePaise: Number.isInteger(activeSchedule.totalFeePaise)
        ? activeSchedule.totalFeePaise
        : storedRupeesToPaise(activeSchedule.totalFee),
      assignedAt: activeSchedule.assignedAt
    } : null,
    stages: stageSummaries,
    lifetimePaid: paiseToRupees(lifetimePaidPaise),
    lifetimePaidPaise,
    unallocatedPayments,
    unallocatedPaid: paiseToRupees(unallocatedPaidPaise),
    unallocatedPaidPaise,
    // Until a reconciliation rule exists, students with successful unallocated
    // (historical) payments cannot be charged again through installments.
    collectionBlocked: unallocatedPaidPaise > 0,
    collectionBlockedReason: unallocatedPaidPaise > 0 ? 'LEGACY_RECONCILIATION_REQUIRED' : null,
    totalPaymentsCount: allPayments.length
  };
}

/** Validates and canonicalizes an offline collection request without touching the database. */
function validateOfflinePayload(payload) {
  const invalid = (message) => new PaymentError(400, 'INVALID_REQUEST', message);
  const p = payload && typeof payload === 'object' ? payload : {};

  const studentId = parsePositiveInt(p.studentId);
  if (studentId === null) throw invalid('A valid student ID is required.');

  const amountPaise = parseRupeesToPaise(p.amount);
  if (amountPaise === null) {
    throw invalid('Amount must be a positive rupee value with at most two decimal places.');
  }
  if (amountPaise > MAX_PAYMENT_PAISE) throw invalid('Amount exceeds the maximum allowed for a single payment.');

  const stage = parsePositiveInt(p.installmentStage);
  if (stage === null) throw invalid('A valid installment stage is required.');

  if (!PAYMENT_METHODS.includes(p.paymentMethod)) {
    throw invalid(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`);
  }

  const idempotencyKey = normalizeIdempotencyKey(p.idempotencyKey);
  if (idempotencyKey === null) {
    throw invalid('An idempotency key (1-128 letters, digits, ".", "_", ":" or "-") is required.');
  }

  let planId = null;
  if (p.planId !== undefined && p.planId !== null && p.planId !== '') {
    planId = String(p.planId).trim();
    if (planId === '' || planId.length > 100) throw invalid('Invalid plan ID.');
  }

  let feeStructureId = null;
  if (p.feeStructureId !== undefined && p.feeStructureId !== null && p.feeStructureId !== '') {
    feeStructureId = parsePositiveInt(p.feeStructureId);
    if (feeStructureId === null) throw invalid('Invalid fee structure ID.');
  }

  let paymentDate = new Date().toISOString();
  if (p.paymentDate !== undefined && p.paymentDate !== null && p.paymentDate !== '') {
    const parsed = typeof p.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.paymentDate)
      ? new Date(p.paymentDate)
      : null;
    if (!parsed || isNaN(parsed.getTime())) throw invalid('Invalid payment date.');
    if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw invalid('Payment date cannot be in the future.');
    paymentDate = p.paymentDate;
  }

  const optionalText = (value, max, label) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.length > max) throw invalid(`Invalid ${label}.`);
    return value.trim() || null;
  };

  return {
    studentId,
    amountPaise,
    stage,
    paymentMethod: p.paymentMethod,
    idempotencyKey,
    planId,
    feeStructureId,
    paymentDate,
    referenceNo: optionalText(p.referenceNo, 64, 'reference number'),
    remarks: optionalText(p.remarks, 500, 'remarks')
  };
}

/**
 * Decides what a reused idempotency key means: the original receipt for an
 * identical request, or a 409 when any material field differs.
 */
function resolveExistingIdempotentPayment(existing, req) {
  const sameRequest =
    Number(existing.studentId) === req.studentId &&
    Number(existing.paise) === req.amountPaise &&
    Number(existing.installmentStage) === req.stage &&
    existing.paymentMethod === req.paymentMethod &&
    (req.feeStructureId === null || Number(existing.feeStructureId) === req.feeStructureId) &&
    (req.planId === null || String(existing.planId) === req.planId);

  if (!sameRequest) {
    throw new PaymentError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key conflict: this key was already used with different payment details.');
  }
  return {
    success: true,
    isDuplicate: true,
    message: 'Payment already recorded with this idempotency key. Returned existing receipt.',
    payment: existing
  };
}

function findPaymentByIdempotencyKey(conn, key) {
  return conn.get(`SELECT *, ${ROW_PAISE_SQL} AS paise FROM payments WHERE idempotencyKey = ?`, [key]);
}

/**
 * Records an offline installment collection. Idempotency lookup, student and
 * schedule validation, balance check and insert all happen in ONE immediate
 * transaction on a dedicated connection.
 */
async function recordOfflineInstallmentPayment(db, payload, actor = {}) {
  const req = validateOfflinePayload(payload);

  try {
    return await withWriteTransaction(db, (conn) => {
      // 1. Idempotent replay (inside the write lock, so concurrent retries serialize here)
      const existing = findPaymentByIdempotencyKey(conn, req.idempotencyKey);
      if (existing) return resolveExistingIdempotentPayment(existing, req);

      // 2. Student must exist and be a student
      getValidStudent(conn, req.studentId);

      // 3. Historical payments that were never allocated block further collection
      const unallocated = getUnallocatedSuccessfulPayments(conn, req.studentId);
      if (unallocated.length > 0) {
        const total = paiseToRupees(unallocated.reduce((sum, p) => sum + p.paise, 0));
        throw new PaymentError(
          409,
          'LEGACY_RECONCILIATION_REQUIRED',
          `This student has ${unallocated.length} earlier payment(s) totalling ₹${total} that are not allocated to any installment. Collection is blocked until they are reconciled.`
        );
      }

      // 4. Locked schedule, or create it now as part of this explicit payment
      let schedule = getActiveSchedule(conn, req.studentId);
      let stages;
      if (schedule) {
        if (req.planId !== null && req.planId !== String(schedule.planId)) {
          throw new PaymentError(409, 'PLAN_LOCKED', `Student is already locked to plan '${schedule.planName}'; the plan cannot be changed.`);
        }
        if (req.feeStructureId !== null && req.feeStructureId !== Number(schedule.feeStructureId)) {
          throw new PaymentError(409, 'PLAN_LOCKED', 'Student already has an active schedule under a different fee structure.');
        }
        stages = parseSnapshot(schedule);
      } else {
        if (req.planId === null) {
          throw new PaymentError(400, 'INVALID_REQUEST', 'A payment plan must be selected for the first payment.');
        }
        let feeStructure;
        if (req.feeStructureId !== null) {
          feeStructure = conn.get(`SELECT * FROM feeStructures WHERE id = ?`, [req.feeStructureId]);
          if (!feeStructure) {
            throw new PaymentError(404, 'FEE_STRUCTURE_NOT_FOUND', `Fee structure with ID ${req.feeStructureId} not found.`);
          }
        } else {
          feeStructure = resolveApplicableFeeStructure(conn, getClassroomAssignment(conn, req.studentId));
          if (!feeStructure) {
            throw new PaymentError(409, 'FEE_STRUCTURE_NOT_FOUND', 'Could not determine applicable fee structure for student.');
          }
        }

        const snapshot = buildScheduleSnapshot(feeStructure, req.planId);
        // Validate the stage before persisting anything for this plan
        if (!snapshot.stages.some(s => s.stageNumber === req.stage)) {
          throw new PaymentError(400, 'STAGE_NOT_FOUND', `Stage ${req.stage} does not exist in plan '${snapshot.planName}'.`);
        }

        const snapshotJson = JSON.stringify(snapshot.stages);
        const inserted = conn.run(`INSERT INTO student_fee_schedules (studentId, feeStructureId, planId, planName, totalFee, totalFeePaise, scheduleSnapshot, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [req.studentId, feeStructure.id, req.planId, snapshot.planName, paiseToRupees(snapshot.totalFeePaise), snapshot.totalFeePaise, snapshotJson]
        );
        schedule = { id: inserted.lastID, feeStructureId: feeStructure.id, planId: req.planId, planName: snapshot.planName };
        stages = snapshot.stages;
      }

      const targetStage = stages.find(s => Number(s.stageNumber) === req.stage);
      if (!targetStage) {
        throw new PaymentError(400, 'STAGE_NOT_FOUND', `Stage ${req.stage} does not exist in the student's active schedule.`);
      }

      // 5. Balance check in paise
      const paidRow = conn.get(`SELECT COALESCE(SUM(${ROW_PAISE_SQL}), 0) AS paid FROM payments
         WHERE scheduleId = ? AND installmentStage = ? AND status IN ${SUCCESS_STATUSES_SQL}`,
        [schedule.id, req.stage]
      );
      const currentlyPaidPaise = Number(paidRow.paid);
      const remainingPaise = Math.max(0, targetStage.expectedAmountPaise - currentlyPaidPaise);

      if (remainingPaise <= 0) {
        throw new PaymentError(409, 'STAGE_ALREADY_PAID', `Installment Stage ${req.stage} is already fully cleared.`);
      }
      if (req.amountPaise > remainingPaise) {
        throw new PaymentError(400, 'OVERPAYMENT', `Payment of ₹${paiseToRupees(req.amountPaise)} exceeds the remaining balance of ₹${paiseToRupees(remainingPaise)} for Stage ${req.stage}.`);
      }

      // 6. Insert, then stamp the receipt number derived from the row's own primary key
      const insertResult = conn.run(`INSERT INTO payments (
          studentId, amount, amountPaise, type, paymentMethod, status, referenceNo, description, createdAt,
          scheduleId, feeStructureId, planId, installmentStage, allocationStatus, idempotencyKey, recordedBy
        ) VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, ?, ?, 'allocated', ?, ?)`,
        [
          req.studentId,
          paiseToRupees(req.amountPaise),
          req.amountPaise,
          `Offline (${req.paymentMethod})`,
          req.paymentMethod,
          req.referenceNo,
          req.remarks || `Offline fee collection for ${schedule.planName} - Stage ${req.stage}`,
          req.paymentDate,
          schedule.id,
          schedule.feeStructureId,
          schedule.planId,
          req.stage,
          req.idempotencyKey,
          parsePositiveInt(actor.userId)
        ]
      );

      const receiptNo = `RCPT-${String(insertResult.lastID).padStart(8, '0')}`;
      conn.run(`UPDATE payments SET receiptNo = ?, transactionId = ? WHERE id = ?`, [receiptNo, receiptNo, insertResult.lastID]);
      const insertedPayment = conn.get(`SELECT * FROM payments WHERE id = ?`, [insertResult.lastID]);

      return {
        success: true,
        isDuplicate: false,
        message: `Offline installment of ₹${paiseToRupees(req.amountPaise).toLocaleString('en-IN')} recorded successfully for Stage ${req.stage}.`,
        payment: insertedPayment,
        stageUpdated: {
          stageNumber: req.stage,
          paidNow: paiseToRupees(req.amountPaise),
          totalStagePaid: paiseToRupees(currentlyPaidPaise + req.amountPaise),
          remainingBalance: paiseToRupees(remainingPaise - req.amountPaise),
          remainingBalancePaise: remainingPaise - req.amountPaise
        }
      };
    });
  } catch (err) {
    if (err instanceof PaymentError) throw err;

    if (isBusyError(err)) {
      throw new PaymentError(503, 'PAYMENT_SYSTEM_BUSY', 'The payment system is busy. Please retry in a moment.');
    }
    if (isConstraintError(err)) {
      // Lost a uniqueness race: answer from what actually got committed.
      const existing = await withReadConnection(db, (conn) => findPaymentByIdempotencyKey(conn, req.idempotencyKey)).catch(() => null);
      if (existing) return resolveExistingIdempotentPayment(existing, req);
      if (/student_fee_schedules/.test(err.message)) {
        throw new PaymentError(409, 'PLAN_LOCKED', 'Student already has an active fee schedule.');
      }
    }
    console.error('Offline installment payment failed:', err);
    throw new PaymentError(500, 'PAYMENT_FAILED', 'Could not record the payment. No amount was recorded.');
  }
}

module.exports = {
  PaymentError,
  PAYMENT_METHODS,
  normalizeIdempotencyKey,
  buildScheduleSnapshot,
  calculateStudentInstallmentSummary,
  recordOfflineInstallmentPayment
};
