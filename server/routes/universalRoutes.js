// Comprehensive API Routes for All LMS Entities
// This file provides CRUD operations for every entity in the LMS

const express = require('express');
const router = express.Router();
const db = require('../config/database-switch');
const authMiddleware = require('../middleware/authMiddleware');
const { checkExportAccess, checkCalendarAccess } = require('../middleware/quotaMiddleware');
const { processBilingualInput } = require('../utils/bilingualHelper');
const { autoTranslateBilingualInput, retrieveAndTranslateBilingualData } = require('../utils/autoTranslationHelper');

// Generic CRUD operations for any entity
function createCRUDRoutes(entityName, tableName) {
  // Tables that should be filtered by university_id (for multi-tenant isolation)
  const universityFilteredTables = ['users', 'classrooms', 'feeStructures', 'announcements', 'courses', 'students'];
  
  // Get all records
  router.get(`/${entityName}`, authMiddleware, async (req, res) => {
    const language = req.query.lang || 'en'; // Get language from query param, default to English
    const universityId = req.user?.universityId || 1;
    
    // Use requestedAt for requirements table, createdAt for others, or just id if neither exists
    let query = `SELECT * FROM ${tableName}`;
    let params = [];

    // Add university filter for multi-tenant tables
    if (universityFilteredTables.includes(tableName)) {
      query += ` WHERE university_id = ?`;
      params.push(universityId);
      console.log(`🔒 GET /${entityName} - Filtered by university ${universityId}`);
    } else {
      console.log(`📋 GET /${entityName} - No university filter (system table)`);
    }
    
    if (tableName === 'requirements') {
      query += ` ORDER BY requestedAt DESC`;
    } else {
      // Try createdAt first, fall back to id
      query += ` ORDER BY CASE WHEN '1' THEN 1 END DESC`;
    }
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        console.error(`Error fetching ${entityName}:`, err);
        // If ordering fails, try without ORDER BY
        const fallbackQuery = `SELECT * FROM ${tableName}${universityFilteredTables.includes(tableName) ? ` WHERE university_id = ?` : ''}`;
        const fallbackParams = universityFilteredTables.includes(tableName) ? [universityId] : [];
        db.all(fallbackQuery, fallbackParams, async (fallbackErr, fallbackRows) => {
          if (fallbackErr) {
            console.error(`Fallback error fetching ${entityName}:`, fallbackErr);
            return res.status(500).json({ success: false, message: `Failed to fetch ${entityName}` });
          }
          
          // Apply language retrieval and auto-translation to fallback results
          try {
            const translatedRows = await Promise.all(
              fallbackRows.map(row => retrieveAndTranslateBilingualData(row, language))
            );
            res.status(200).json({ success: true, data: translatedRows, language });
          } catch (translationError) {
            console.warn(`Translation warning: ${translationError.message}`);
            res.status(200).json({ success: true, data: fallbackRows, language });
          }
        });
        return;
      }
      
      // Apply language retrieval and auto-translation
      try {
        const translatedRows = await Promise.all(
          rows.map(row => retrieveAndTranslateBilingualData(row, language))
        );
        res.status(200).json({ success: true, data: translatedRows, language });
      } catch (translationError) {
        console.warn(`Translation warning: ${translationError.message}`);
        res.status(200).json({ success: true, data: rows, language });
      }
    });
  });

  // Get single record by ID
  router.get(`/${entityName}/:id`, async (req, res) => {
    const { id } = req.params;
    const language = req.query.lang || 'en'; // Get language from query param, default to English
    const query = `SELECT * FROM ${tableName} WHERE id = ?`;
    db.get(query, [id], async (err, row) => {
      if (err) {
        console.error(`Error fetching ${entityName} by ID:`, err);
        return res.status(500).json({ success: false, message: `Failed to fetch ${entityName}` });
      }
      if (!row) {
        return res.status(404).json({ success: false, message: `${entityName} not found` });
      }
      
      // Apply language retrieval and auto-translation
      try {
        const translatedRow = await retrieveAndTranslateBilingualData(row, language);
        res.status(200).json({ success: true, data: translatedRow, language });
      } catch (translationError) {
        console.warn(`Translation warning: ${translationError.message}`);
        res.status(200).json({ success: true, data: row, language });
      }
    });
  });

  // Create new record
  router.post(`/${entityName}`, authMiddleware, async (req, res) => {
    let data = req.body;
    const universityId = req.user?.universityId || 1;

    // Filter out fields that are not actual table columns
    // These are typically used for related operations (like studentIds for classroom creation)
    const fieldsToExclude = ['studentIds', 'classTeacherId'];
    fieldsToExclude.forEach(field => {
      if (data.hasOwnProperty(field)) {
        delete data[field];
        console.log(`Excluded non-column field from universal route: ${field}`);
      }
    });

    // Auto-add university_id for multi-tenant tables
    if (universityFilteredTables.includes(tableName)) {
      data.university_id = universityId;
      console.log(`🔒 POST /${entityName} - Auto-set university_id to ${universityId}`);
    }
    
    // Process bilingual input - auto-detect language and split into _ar and _en columns
    data = processBilingualInput(data);
    
    // Auto-translate missing language columns
    try {
      data = await autoTranslateBilingualInput(data);
    } catch (translationError) {
      console.warn(`Auto-translation warning: ${translationError.message}`);
      // Continue without translation if it fails - data still has the split columns
    }
    
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const query = `INSERT INTO ${tableName} (${columns}, createdAt) VALUES (${placeholders}, CURRENT_TIMESTAMP)`;
    db.run(query, values, function(err) {
      if (err) {
        console.error(`Error creating ${entityName}:`, err);
        return res.status(500).json({ success: false, message: `Failed to create ${entityName}` });
      }

      // Get the created record
      db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [this.lastID], (err, row) => {
        if (err) {
          console.error(`Error fetching created ${entityName}:`, err);
          return res.status(500).json({ success: false, message: `Failed to fetch created ${entityName}` });
        }

        // Emit real-time event
        if (req.io) {
          req.io.emit(`${entityName}-created`, { data: row });
        }

        res.status(201).json({ success: true, message: `${entityName} created successfully`, data: row });
      });
    });
  });

  // Update record
  router.put(`/${entityName}/:id`, async (req, res) => {
    let { id } = req.params;
    let data = req.body;
    
    // Process bilingual input - auto-detect language and split into _ar and _en columns
    data = processBilingualInput(data);
    
    // Auto-translate missing language columns
    try {
      data = await autoTranslateBilingualInput(data);
    } catch (translationError) {
      console.warn(`Auto-translation warning: ${translationError.message}`);
      // Continue without translation if it fails - data still has the split columns
    }
    
    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const query = `UPDATE ${tableName} SET ${updates}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(query, values, function(err) {
      if (err) {
        console.error(`Error updating ${entityName}:`, err);
        return res.status(500).json({ success: false, message: `Failed to update ${entityName}` });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: `${entityName} not found` });
      }

      // Get the updated record
      db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id], (err, row) => {
        if (err) {
          console.error(`Error fetching updated ${entityName}:`, err);
          return res.status(500).json({ success: false, message: `Failed to fetch updated ${entityName}` });
        }

        // Emit real-time event
        if (req.io) {
          req.io.emit(`${entityName}-updated`, { data: row });
        }

        res.status(200).json({ success: true, message: `${entityName} updated successfully`, data: row });
      });
    });
  });

  // Delete record
  router.delete(`/${entityName}/:id`, (req, res) => {
    const { id } = req.params;
    const query = `DELETE FROM ${tableName} WHERE id = ?`;
    db.run(query, [id], function(err) {
      if (err) {
        console.error(`Error deleting ${entityName}:`, err);
        return res.status(500).json({ success: false, message: `Failed to delete ${entityName}` });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: `${entityName} not found` });
      }

      // Emit real-time event
      if (req.io) {
        req.io.emit(`${entityName}-deleted`, { id });
      }

      res.status(200).json({ success: true, message: `${entityName} deleted successfully` });
    });
  });

  // Search records
  router.get(`/${entityName}/search`, (req, res) => {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const query = `SELECT * FROM ${tableName} WHERE name LIKE ? OR title LIKE ? OR description LIKE ? ORDER BY createdAt DESC`;
    const searchTerm = `%${q}%`;
    db.all(query, [searchTerm, searchTerm, searchTerm], (err, rows) => {
      if (err) {
        console.error(`Error searching ${entityName}:`, err);
        return res.status(500).json({ success: false, message: `Failed to search ${entityName}` });
      }
      res.status(200).json({ success: true, data: rows });
    });
  });

  // Get statistics
  router.get(`/${entityName}/stats`, (req, res) => {
    const query = `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'active' THEN 1 END) as active FROM ${tableName}`;
    db.get(query, (err, row) => {
      if (err) {
        console.error(`Error getting ${entityName} stats:`, err);
        return res.status(500).json({ success: false, message: `Failed to get ${entityName} statistics` });
      }
      res.status(200).json({ success: true, stats: row });
    });
  });
}

// ============================================
// CUSTOM ROUTES (MUST come BEFORE CRUD routes)
// ============================================

// Users by role
router.get('/users/role/:role', (req, res) => {
  const { role } = req.params;
  const query = `SELECT * FROM users WHERE role = ? ORDER BY createdAt DESC`;
  db.all(query, [role], (err, rows) => {
    if (err) {
      console.error('Error fetching users by role:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch users by role' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Get all mentors (NO AUTH REQUIRED for dropdown)
router.get('/users/mentors', (req, res) => {
  const query = `SELECT id as _id, id, name, email FROM users WHERE role = 'mentor' AND isApproved = 1 ORDER BY name`;
  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error fetching mentors:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch mentors' });
    }
    res.status(200).json(rows || []);
  });
});

// Get all students (NO AUTH REQUIRED for dropdown)
router.get('/users/students-simple', (req, res) => {
  const query = `SELECT id as _id, id, name, email FROM users WHERE role = 'student' AND isApproved = 1 ORDER BY name`;
  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error fetching students:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch students' });
    }
    res.status(200).json(rows || []);
  });
});

// Classrooms by grade
router.get('/classrooms/grade/:grade', (req, res) => {
  const { grade } = req.params;
  const query = `SELECT * FROM classrooms WHERE grade = ? ORDER BY section`;
  db.all(query, [grade], (err, rows) => {
    if (err) {
      console.error('Error fetching classrooms by grade:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch classrooms by grade' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Classrooms assigned to mentor - using 'me' resolves from JWT token
router.get('/classrooms/mentor/me', authMiddleware, (req, res) => {
  // req.user is populated by authMiddleware from JWT
  console.log('\n=== /classrooms/mentor/me endpoint hit ===');
  console.log('req.user:', req.user);
  console.log('req.user?.userId:', req.user?.userId);
  
  const teacherId = req.user?.userId;
  
  if (!teacherId) {
    console.error('❌ No userId in request user:', req.user);
    return res.status(401).json({ success: false, message: 'Unauthorized - no user id' });
  }
  
  console.log('✅ Fetching classrooms for mentor (from JWT):', teacherId);
  
  const query = `
    SELECT c.*, 
           u.name as teacherName,
           (SELECT COUNT(*) FROM student_classroom_assignment WHERE classroomId = c.id) as studentCount
    FROM classrooms c
    LEFT JOIN users u ON c.classTeacherId = u.id
    WHERE c.classTeacherId = ?
    ORDER BY c.grade, c.section
  `;
  
  console.log('Query:', query);
  console.log('Parameters:', [teacherId]);
  
  db.all(query, [teacherId], (err, rows) => {
    if (err) {
      console.error('❌ Error fetching mentor classrooms:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch mentor classrooms' });
    }
    console.log(`✅ Returned ${rows?.length || 0} classrooms for mentor ${teacherId}`);
    console.log('Rows:', rows);
    res.status(200).json({ success: true, data: rows || [] });
  });
});

// Classrooms assigned to mentor (teacher)
router.get('/classrooms/mentor/:teacherId', (req, res) => {
  const { teacherId } = req.params;
  const query = `
    SELECT c.*, 
           u.name as teacherName,
           (SELECT COUNT(*) FROM student_classroom_assignment WHERE classroomId = c.id) as studentCount
    FROM classrooms c
    LEFT JOIN users u ON c.classTeacherId = u.id
    WHERE c.classTeacherId = ?
    ORDER BY c.grade, c.section
  `;
  db.all(query, [teacherId], (err, rows) => {
    if (err) {
      console.error('Error fetching mentor classrooms:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch mentor classrooms' });
    }
    res.status(200).json({ success: true, data: rows || [] });
  });
});

// Courses by classroom
router.get('/courses/classroom/:classroomId', (req, res) => {
  const { classroomId } = req.params;
  const query = `SELECT * FROM courses WHERE classroomId = ? ORDER BY createdAt DESC`;
  db.all(query, [classroomId], (err, rows) => {
    if (err) {
      console.error('Error fetching courses by classroom:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch courses by classroom' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Materials by course
router.get('/materials/course/:courseId', (req, res) => {
  const { courseId } = req.params;
  const query = `SELECT * FROM materials WHERE courseId = ? ORDER BY createdAt DESC`;
  db.all(query, [courseId], (err, rows) => {
    if (err) {
      console.error('Error fetching materials by course:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch materials by course' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Assignments by material
router.get('/assignments/material/:materialId', (req, res) => {
  const { materialId } = req.params;
  const query = `SELECT * FROM assignments WHERE materialId = ? ORDER BY createdAt DESC`;
  db.all(query, [materialId], (err, rows) => {
    if (err) {
      console.error('Error fetching assignments by material:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch assignments by material' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Progress by student
router.get('/progress/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const query = `SELECT * FROM progress WHERE studentId = ? ORDER BY updatedAt DESC`;
  db.all(query, [studentId], (err, rows) => {
    if (err) {
      console.error('Error fetching progress by student:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch progress by student' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Certificate by student and course
router.get('/certificates/student/:studentId/course/:courseId', (req, res) => {
  const { studentId, courseId } = req.params;
  const query = `SELECT * FROM certificates WHERE studentId = ? AND courseId = ?`;
  db.get(query, [studentId, courseId], (err, row) => {
    if (err) {
      console.error('Error fetching certificate:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch certificate' });
    }
    res.status(200).json({ success: true, data: row });
  });
});

// ============================================
// GENERIC CRUD ROUTES (come AFTER custom routes)
// ============================================

// Attendance by date and classroom
router.get('/attendance/classroom/:classroomId/date/:date', (req, res) => {
  const { classroomId, date } = req.params;
  const query = `SELECT * FROM attendance WHERE classroomId = ? AND date = ? ORDER BY createdAt DESC`;
  db.all(query, [classroomId, date], (err, rows) => {
    if (err) {
      console.error('Error fetching attendance:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Results by student
router.get('/results/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const query = `SELECT * FROM results WHERE studentId = ? ORDER BY createdAt DESC`;
  db.all(query, [studentId], (err, rows) => {
    if (err) {
      console.error('Error fetching student results:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch student results' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Progress by student
router.get('/progress/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const query = `SELECT * FROM progress WHERE studentId = ? ORDER BY updatedAt DESC`;
  db.all(query, [studentId], (err, rows) => {
    if (err) {
      console.error('Error fetching student progress:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch student progress' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Calendar events by date range
router.get('/calendar_events/range', (req, res) => {
  const { startDate, endDate } = req.query;
  const query = `SELECT * FROM calendar_events WHERE startDate >= ? AND endDate <= ? ORDER BY startDate`;
  db.all(query, [startDate, endDate], (err, rows) => {
    if (err) {
      console.error('Error fetching calendar events:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch calendar events' });
    }
    res.status(200).json({ success: true, data: rows });
  });
});

// Mark attendance for multiple students
router.post('/attendance', (req, res) => {
  const { classroomId, date, attendanceData } = req.body;
  
  console.log('📝 Attendance Save Request:', { classroomId, date, attendanceCount: attendanceData?.length });
  
  if (!classroomId || !date || !Array.isArray(attendanceData)) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  let saved = 0;
  let failed = 0;

  const processAttendance = (index) => {
    if (index >= attendanceData.length) {
      console.log(`✅ Attendance Save Complete: ${saved} saved, ${failed} failed`);
      return res.status(201).json({ 
        success: true, 
        message: `Attendance marked successfully - ${saved} records saved`,
        data: { saved, failed, total: attendanceData.length }
      });
    }

    const record = attendanceData[index];
    const { studentId, status } = record;

    // Check if already exists
    const checkQuery = `SELECT * FROM attendance WHERE studentId = ? AND classroomId = ? AND date = ?`;
    db.get(checkQuery, [studentId, classroomId, date], (err, existingRow) => {
      if (err) {
        console.error(`❌ Error checking attendance for student ${studentId}:`, err);
        failed++;
        return processAttendance(index + 1);
      }

      if (existingRow) {
        // Update existing
        console.log(`📝 Updating attendance for student ${studentId}: ${status}`);
        const updateQuery = `UPDATE attendance SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE studentId = ? AND classroomId = ? AND date = ?`;
        db.run(updateQuery, [status, studentId, classroomId, date], (updateErr) => {
          if (updateErr) {
            console.error(`❌ Update failed for student ${studentId}:`, updateErr);
            failed++;
          } else {
            console.log(`✅ Updated student ${studentId}`);
            saved++;
          }
          processAttendance(index + 1);
        });
      } else {
        // Insert new
        console.log(`➕ Inserting attendance for student ${studentId}: ${status}`);
        const insertQuery = `INSERT INTO attendance (studentId, classroomId, date, status, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        db.run(insertQuery, [studentId, classroomId, date, status], (insertErr) => {
          if (insertErr) {
            console.error(`❌ Insert failed for student ${studentId}:`, insertErr);
            failed++;
          } else {
            console.log(`✅ Inserted student ${studentId}`);
            saved++;
          }
          processAttendance(index + 1);
        });
      }
    });
  };

  processAttendance(0);
});

// Save result for student
router.post('/results', (req, res) => {
  const { classroomId, studentId, subjects, term, comments } = req.body;
  
  console.log('POST /results - Received:', { classroomId, studentId, subjectsCount: subjects?.length, term, comments });
  
  if (!classroomId || !studentId) {
    console.log('Missing required fields - classroomId:', classroomId, 'studentId:', studentId);
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Convert subjects array to JSON string for storage
  const subjectsJson = JSON.stringify(subjects || []);
  
  // Calculate overall stats from subjects
  let totalObtained = 0;
  let totalMax = 0;
  let failCount = 0;
  
  if (Array.isArray(subjects)) {
    subjects.forEach(sub => {
      totalObtained += parseFloat(sub.marks) || 0;
      totalMax += parseFloat(sub.total) || 0;
      if ((sub.status || "PASS") === "FAIL") failCount++;
    });
  }
  
  const overallPercentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 0;
  const overallStatus = failCount > 0 ? "FAIL" : "PASS";
  
  console.log('Calculated stats:', { overallPercentage, overallStatus, totalObtained, totalMax });
  
  // Check if result already exists
  const checkQuery = `SELECT id FROM results WHERE studentId = ? AND classroomId = ? AND term = ?`;
  db.get(checkQuery, [studentId, classroomId, term || 'General'], (err, existingRow) => {
    if (err) {
      console.error('Error checking existing result:', err);
      console.error('Query:', checkQuery, 'Params:', [studentId, classroomId, term || 'General']);
      return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }

    if (existingRow) {
      // Update existing result
      const updateQuery = `
        UPDATE results 
        SET subjects = ?, overallPercentage = ?, overallStatus = ?, comments = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      db.run(updateQuery, [subjectsJson, overallPercentage, overallStatus, comments || '', existingRow.id], (updateErr) => {
        if (updateErr) {
          console.error('Error updating result:', updateErr);
          return res.status(500).json({ success: false, message: 'Failed to update result' });
        }
        
        // Return updated result
        db.get(`SELECT * FROM results WHERE id = ?`, [existingRow.id], (selectErr, updatedRow) => {
          if (selectErr) {
            return res.status(200).json({ success: true, message: 'Result updated successfully' });
          }
          res.status(200).json({ success: true, message: 'Result updated successfully', data: updatedRow });
        });
      });
    } else {
      // Insert new result
      const insertQuery = `
        INSERT INTO results (studentId, classroomId, term, subjects, overallPercentage, overallStatus, comments, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      db.run(insertQuery, [studentId, classroomId, term || 'General', subjectsJson, overallPercentage, overallStatus, comments || ''], function(err) {
        if (err) {
          console.error('Error inserting result:', err);
          return res.status(500).json({ success: false, message: 'Failed to save result' });
        }
        
        // Return created result
        db.get(`SELECT * FROM results WHERE id = ?`, [this.lastID], (selectErr, newRow) => {
          if (selectErr) {
            return res.status(201).json({ success: true, message: 'Result saved successfully' });
          }
          res.status(201).json({ success: true, message: 'Result saved successfully', data: newRow });
        });
      });
    }
  });
});

// Get results by classroom
router.get('/results/classroom/:classroomId', (req, res) => {
  const { classroomId } = req.params;
  const query = `
    SELECT r.*, u.name as studentName, u.email as studentEmail
    FROM results r
    JOIN users u ON r.studentId = u.id
    WHERE r.classroomId = ?
    ORDER BY u.name
  `;
  
  db.all(query, [classroomId], (err, rows) => {
    if (err) {
      console.error('Error fetching classroom results:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch results' });
    }
    
    // Parse subjects JSON for each result
    const results = (rows || []).map(row => ({
      ...row,
      subjects: row.subjects ? JSON.parse(row.subjects) : []
    }));
    
    res.status(200).json({ success: true, data: results });
  });
});

// Get results by student
router.get('/results/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const query = `
    SELECT r.*, c.name as classroomName, c.grade, c.section
    FROM results r
    JOIN classrooms c ON r.classroomId = c.id
    WHERE r.studentId = ?
    ORDER BY r.createdAt DESC
  `;
  
  db.all(query, [studentId], (err, rows) => {
    if (err) {
      console.error('Error fetching student results:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch results' });
    }
    
    // Parse subjects JSON for each result
    const results = (rows || []).map(row => ({
      ...row,
      subjects: row.subjects ? JSON.parse(row.subjects) : []
    }));
    
    res.status(200).json({ success: true, data: results });
  });
});

// Delete result
router.delete('/results/:resultId', (req, res) => {
  const { resultId } = req.params;
  const query = `DELETE FROM results WHERE id = ?`;
  
  db.run(query, [resultId], function(err) {
    if (err) {
      console.error('Error deleting result:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete result' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }
    
    res.status(200).json({ success: true, message: 'Result deleted successfully' });
  });
});

// Test endpoint
router.get('/test-endpoint', (req, res) => {
  console.log('🧪 Test endpoint hit!');
  res.json({ message: 'Universal routes are working!', timestamp: new Date().toISOString() });
});

// Get student classrooms
router.get('/student-classrooms', authMiddleware, (req, res) => {
  console.log('🎓 Student classrooms endpoint hit!');
  const studentId = req.user.userId || req.user.id;
  console.log('👤 Student ID:', studentId);
  
  const query = `
    SELECT c.*, u.name as classTeacher, u.email as classTeacherEmail
    FROM classrooms c
    LEFT JOIN users u ON c.classTeacherId = u.id
    WHERE c.id IN (
      SELECT DISTINCT classroomId 
      FROM student_classroom_assignment 
      WHERE studentId = ?
    )
    ORDER BY c.grade, c.section
  `;
  
  console.log('🔍 Executing query:', query);
  
  db.all(query, [studentId], (err, classrooms) => {
    if (err) {
      console.error('Error fetching student classrooms:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch student classrooms' });
    }
    
    console.log('📚 Found classrooms:', classrooms.length);
    
    // Map to frontend format
    const mappedClassrooms = (classrooms || []).map(classroom => ({
      ...classroom,
      _id: classroom.id,
      classTeacher: classroom.classTeacher ? {
        name: classroom.classTeacher,
        email: classroom.classTeacherEmail
      } : null
    }));
    
    console.log('✅ Sending response:', mappedClassrooms.length, 'classrooms');
    res.status(200).json(mappedClassrooms);
  });
});

// Create CRUD routes for all entities
createCRUDRoutes('users', 'users');
createCRUDRoutes('classrooms', 'classrooms');
createCRUDRoutes('courses', 'courses');
createCRUDRoutes('materials', 'materials');
createCRUDRoutes('assignments', 'assignments');
createCRUDRoutes('attendance', 'attendance');
createCRUDRoutes('announcements', 'announcements');
createCRUDRoutes('calendar_events', 'calendar_events');
createCRUDRoutes('results', 'results');
createCRUDRoutes('requirements', 'requirements');
createCRUDRoutes('requirement_items', 'requirement_items');
createCRUDRoutes('expenses', 'expenses');
createCRUDRoutes('inventory', 'inventory');
createCRUDRoutes('vendors', 'vendors');
createCRUDRoutes('chapters', 'chapters');
createCRUDRoutes('weeks', 'weeks');
createCRUDRoutes('assessments', 'assessments');
createCRUDRoutes('certificates', 'certificates');
createCRUDRoutes('progress', 'progress');
createCRUDRoutes('transactions', 'payments');

// Bulk operations
router.post('/bulk/:entity', (req, res) => {
  const { entity } = req.params;
  const { data, operation } = req.body;
  
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ success: false, message: 'Data array is required' });
  }

  const tableName = entity === 'users' ? 'users' : entity;
  const results = [];

  data.forEach((item, index) => {
    if (operation === 'create') {
      const columns = Object.keys(item).join(', ');
      const placeholders = Object.keys(item).map(() => '?').join(', ');
      const values = Object.values(item);
      const query = `INSERT INTO ${tableName} (${columns}, createdAt) VALUES (${placeholders}, CURRENT_TIMESTAMP)`;
      
      db.run(query, values, function(err) {
        if (err) {
          results.push({ index, error: err.message });
        } else {
          results.push({ index, success: true, id: this.lastID });
        }
      });
    }
  });

  res.status(200).json({ success: true, results });
});

// Export data
router.get('/:entity/export', authMiddleware, checkExportAccess, (req, res) => {
  const { entity } = req.params;
  const { format = 'json' } = req.query;
  const universityId = req.user?.universityId || 1;

  // Tables that should be filtered by university_id
  const universityFilteredTables = ['users', 'classrooms', 'feeStructures', 'announcements', 'courses', 'students'];
  
  let query = `SELECT * FROM ${entity}`;
  let params = [];

  // Add university filter for appropriate tables
  if (universityFilteredTables.includes(entity)) {
    query += ` WHERE university_id = ?`;
    params.push(universityId);
    console.log(`📊 EXPORT ${entity.toUpperCase()} - University ${universityId} - Filtered by university_id`);
  } else {
    console.log(`📊 EXPORT ${entity.toUpperCase()} - University ${universityId} - No university filter (system table)`);
  }

  query += ` ORDER BY createdAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(`Error exporting ${entity} for university ${universityId}:`, err);
      return res.status(500).json({ success: false, message: `Failed to export ${entity}` });
    }

    console.log(`📊 EXPORT ${entity.toUpperCase()} - Returning ${rows?.length || 0} records for university ${universityId}`);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
      res.send(csv);
    } else {
      res.status(200).json({ success: true, data: rows });
    }
  });
});

// Helper function to convert to CSV
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

// ============================================
// CLASSROOM-SPECIFIC ROUTES (AT END - after all CRUD routes)
// ============================================

// Students assigned to classroom
router.get('/classrooms/:classroomId/students', (req, res) => {
  const { classroomId } = req.params;
  const query = `
    SELECT u.id as _id, u.id, u.name, u.email, s.rollNumber
    FROM users u
    INNER JOIN student_classroom_assignment sca ON u.id = sca.studentId
    LEFT JOIN students s ON u.id = s.userId
    WHERE sca.classroomId = ?
    ORDER BY u.name
  `;
  db.all(query, [classroomId], (err, rows) => {
    if (err) {
      console.error('Error fetching classroom students for classroomId ' + classroomId + ':', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch classroom students', error: err.message });
    }
    console.log('Returned ' + (rows ? rows.length : 0) + ' students for classroomId ' + classroomId);
    res.status(200).json({ success: true, data: rows || [] });
  });
});

// Assign student to classroom
router.post('/classrooms/assign-student', (req, res) => {
  const { classroomId, studentId } = req.body;
  
  if (!classroomId || !studentId) {
    return res.status(400).json({ success: false, message: 'Missing classroomId or studentId' });
  }

  // Check if already assigned
  const checkQuery = `SELECT * FROM student_classroom_assignment WHERE classroomId = ? AND studentId = ?`;
  db.get(checkQuery, [classroomId, studentId], (err, existingRow) => {
    if (err) {
      console.error('Error checking existing assignment:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (existingRow) {
      return res.status(400).json({ success: false, message: 'Student already assigned to this classroom' });
    }

    // Insert new assignment
    const insertQuery = `
      INSERT INTO student_classroom_assignment (classroomId, studentId, createdAt)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    db.run(insertQuery, [classroomId, studentId], function(err) {
      if (err) {
        console.error('Error assigning student:', err);
        return res.status(500).json({ success: false, message: 'Failed to assign student' });
      }

      // Also update user's classroom_id field
      const updateUserQuery = `UPDATE users SET classroom_id = ? WHERE id = ?`;
      db.run(updateUserQuery, [classroomId, studentId], (updateErr) => {
        if (updateErr) {
          console.error('Error updating user classroom_id:', updateErr);
          // Don't return error, assignment still succeeded
        }

        res.status(201).json({ 
          success: true, 
          message: 'Student assigned to classroom successfully',
          data: { classroomId, studentId }
        });
      });
    });
  });
});

// Download Attendance as Excel
router.get('/attendance/download', (req, res) => {
  const { classroomId, startDate, endDate } = req.query;

  if (!classroomId || !startDate || !endDate) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameters: classroomId, startDate, endDate' 
    });
  }

  try {
    const query = `
      SELECT a.*, u.name as studentName, u.email as studentEmail, s.rollNumber
      FROM attendance a
      JOIN users u ON a.studentId = u.id
      LEFT JOIN students s ON u.id = s.userId
      WHERE a.classroomId = ? AND a.date >= ? AND a.date <= ?
      ORDER BY a.date DESC, u.name ASC
    `;

    db.all(query, [classroomId, startDate, endDate], async (err, rows) => {
      if (err) {
        console.error('Error fetching attendance for download:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch attendance records' });
      }

      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        // Add headers
        worksheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Student Name', key: 'studentName', width: 20 },
          { header: 'Roll Number', key: 'rollNumber', width: 15 },
          { header: 'Email', key: 'studentEmail', width: 25 },
          { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        // Add data rows
        rows.forEach(row => {
          worksheet.addRow({
            date: new Date(row.date).toLocaleDateString(),
            studentName: row.studentName,
            rollNumber: row.rollNumber || 'N/A',
            studentEmail: row.studentEmail,
            status: row.status.toUpperCase(),
          });
        });

        // Color status cells
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            const statusCell = row.getCell('status');
            if (statusCell.value === 'PRESENT') {
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
              statusCell.font = { color: { argb: 'FF006100' } };
            } else if (statusCell.value === 'ABSENT') {
              statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
              statusCell.font = { color: { argb: 'FF9C0006' } };
            }
          }
        });

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-${startDate}-to-${endDate}.xlsx"`);
        res.send(buffer);
      } catch (excelErr) {
        console.error('Error generating Excel file:', excelErr);
        res.status(500).json({ success: false, message: 'Failed to generate Excel file' });
      }
    });
  } catch (err) {
    console.error('Error processing download request:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
