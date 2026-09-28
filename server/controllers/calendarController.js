const tenantConnectionManager = require('../config/tenant-connection-manager');
const db = require('../config/database-switch');



/**
 * ==================================
 * CREATE CALENDAR EVENT
 * ==================================
 * Admin:
 *  - publishFor required (student | faculty | both)
 *
 * Mentor:
 *  - courseId required
 */
const createCalendarEvent = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.userId;
    const role = req.user.role;

    const { title, description, startDate, endDate, publishFor, courseId } =
      req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ========= ADMIN =========
    if (role === "admin") {
      if (!publishFor) {
        return res
          .status(400)
          .json({ message: "publishFor is required" });
      }

      // Normalize publishFor: Convert legacy variants to canonical values
      const pf = String(publishFor).toLowerCase().trim();
      let normalized = pf;
      if (pf === 'faculty' || pf === 'mentor' || pf === 'mentors' || pf === 'teachers') normalized = 'mentors';
      else if (pf === 'student' || pf === 'students') normalized = 'students';
      else if (pf === 'both' || pf === 'all') normalized = 'both';
      else {
        return res.status(400).json({ 
          message: "publishFor must be 'students', 'mentors', or 'both'" 
        });
      }

      console.log(`📅 Creating admin calendar event: publishFor '${publishFor}' -> normalized '${normalized}'`);

      db.run(
        `INSERT INTO calendar_events (title, description, startDate, endDate, publishFor, createdByRole, createdByUser, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [title, description, startDate, endDate, normalized, role, userId],
        function(err) {
          if (err) {
            console.error("CREATE EVENT ERROR:", err);
            return res.status(500).json({ message: "Server error" });
          }
          
          console.log(`✅ Calendar event created with ID: ${this.lastID}`);
          
          // Fetch and return the created event
          db.get(
            `SELECT * FROM calendar_events WHERE id = ?`,
            [this.lastID],
            (err, event) => {
              if (err) {
                return res.status(500).json({ message: "Server error" });
              }
              return res.status(201).json(event);
            }
          );
        }
      );
      return;
    }

    // ========= MENTOR =========
    if (role === "mentor") {
      if (!courseId) {
        return res
          .status(400)
          .json({ message: "courseId is required" });
      }

      // Verify course exists
      db.get(
        `SELECT id FROM courses WHERE id = ?`,
        [courseId],
        (err, course) => {
          if (err || !course) {
            return res.status(404).json({ message: "Course not found" });
          }

          db.run(
            `INSERT INTO calendar_events (title, description, startDate, endDate, courseId, createdByRole, createdByUser, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [title, description, startDate, endDate, courseId, role, userId],
            function(err) {
              if (err) {
                console.error("CREATE EVENT ERROR:", err);
                return res.status(500).json({ message: "Server error" });
              }

              db.get(
                `SELECT * FROM calendar_events WHERE id = ?`,
                [this.lastID],
                (err, event) => {
                  if (err) {
                    return res.status(500).json({ message: "Server error" });
                  }
                  return res.status(201).json(event);
                }
              );
            }
          );
        }
      );
      return;
    }

    return res.status(403).json({ message: "Not allowed" });
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ==================================
 * GET CALENDAR EVENTS (ROLE BASED)
 * ==================================
 */
const getCalendarEvents = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.userId;
    const role = req.user.role;

    // ========= ADMIN =========
    if (role === "admin") {
      db.all(
        `SELECT * FROM calendar_events ORDER BY startDate ASC`,
        (err, events) => {
          if (err) {
            console.error("FETCH EVENTS ERROR:", err);
            return res.status(500).json({ message: "Server error" });
          }
          console.log(`📅 Fetched ${(events || []).length} events for admin`);
          return res.json(events || []);
        }
      );
      return;
    }

    // ========= MENTOR =========
    if (role === "mentor") {
      // Mentor can see:
      // 1. Their own events
      // 2. Admin events published to mentors or both
      db.all(
        `SELECT * FROM calendar_events 
         WHERE createdByUser = ? 
         OR (createdByRole = 'admin' AND publishFor IN ('mentors', 'both'))
         ORDER BY startDate ASC`,
        [userId],
        (err, events) => {
          if (err) {
            console.error("FETCH EVENTS ERROR:", err);
            return res.status(500).json({ message: "Server error" });
          }
          console.log(`📅 Fetched ${(events || []).length} events for mentor`);
          return res.json(events || []);
        }
      );
      return;
    }

    // ========= STUDENT =========
    if (role === "student") {
      // Get courses where this student is enrolled
      db.all(
        `SELECT courseId FROM course_students WHERE studentId = ?`,
        [userId],
        (err, records) => {
          if (err) {
            console.error("FETCH COURSES ERROR:", err);
            return res.status(500).json({ message: "Server error" });
          }

          const courseIds = records && records.length > 0 ? records.map(r => r.courseId) : [];
          console.log(`📅 Student ${userId} enrolled in courses:`, courseIds);

          // Student can see:
          // 1. Admin events published to students or both
          // 2. Mentor events in their courses
          let query = `SELECT * FROM calendar_events 
                      WHERE (createdByRole = 'admin' AND publishFor IN ('students', 'both'))`;
          
          if (courseIds && courseIds.length > 0) {
            const placeholders = courseIds.map(() => '?').join(',');
            query += ` OR (createdByRole = 'mentor' AND courseId IN (${placeholders}))`;
            query += ` ORDER BY startDate ASC`;
            
            console.log(`📅 Student query with courses:`, query);
            console.log(`📅 Student params:`, courseIds);

            return db.all(query, courseIds, (err, events) => {
              if (err) {
                console.error("FETCH EVENTS ERROR:", err);
                return res.status(500).json({ message: "Server error" });
              }
              console.log(`📅 Fetched ${events ? events.length : 0} events for student`);
              return res.json(events || []);
            });
          }
          
          // No courses - just fetch admin events
          query += ` ORDER BY startDate ASC`;
          console.log(`📅 Student query without courses:`, query);

          return db.all(query, (err, events) => {
            if (err) {
              console.error("FETCH EVENTS ERROR:", err);
              return res.status(500).json({ message: "Server error" });
            }
            console.log(`📅 Fetched ${events ? events.length : 0} events for student (no courses)`);
            return res.json(events || []);
          });
        }
      );
      return;
    }

    return res.status(403).json({ message: "Invalid role" });
  } catch (err) {
    console.error("FETCH EVENTS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ==================================
 * UPDATE CALENDAR EVENT
 * ==================================
 * Only creator (admin/mentor) can edit
 */
const updateCalendarEvent = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    db.get(
      `SELECT * FROM calendar_events WHERE id = ?`,
      [id],
      (err, event) => {
        if (err || !event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // 🔐 Ownership check - Admin can update their own events, Mentor can update their own events
        if (event.createdByUser !== userId) {
          return res.status(403).json({ message: "Permission denied" });
        }
        
        // If mentor, must be their own event
        if (role === "mentor" && event.createdByRole !== "mentor") {
          return res.status(403).json({ message: "Permission denied" });
        }
        
        // If admin, can update admin events
        if (role === "admin" && event.createdByRole !== "admin") {
          return res.status(403).json({ message: "Permission denied" });
        }

        // Build update query
        const allowedFields = ['title', 'description', 'startDate', 'endDate', 'publishFor', 'courseId'];
        const updates = {};
        for (const field of allowedFields) {
          if (req.body.hasOwnProperty(field)) {
            updates[field] = req.body[field];
          }
        }

        if (Object.keys(updates).length === 0) {
          return res.json({ message: "No fields to update", event });
        }

        const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);

        db.run(
          `UPDATE calendar_events SET ${setClause}, updatedAt = datetime('now') WHERE id = ?`,
          values,
          (err) => {
            if (err) {
              console.error("UPDATE EVENT ERROR:", err);
              return res.status(500).json({ message: "Server error" });
            }

            db.get(
              `SELECT * FROM calendar_events WHERE id = ?`,
              [id],
              (err, updatedEvent) => {
                if (err) {
                  return res.status(500).json({ message: "Server error" });
                }
                return res.json({
                  message: "Event updated successfully",
                  event: updatedEvent,
                });
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error("UPDATE EVENT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * ==================================
 * DELETE CALENDAR EVENT
 * ==================================
 * Only creator (admin/mentor) can delete
 */
const deleteCalendarEvent = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    db.get(
      `SELECT * FROM calendar_events WHERE id = ?`,
      [id],
      (err, event) => {
        if (err || !event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // 🔐 Ownership check - Admin can delete their own events, Mentor can delete their own events
        if (event.createdByUser !== userId) {
          return res.status(403).json({ message: "Permission denied" });
        }
        
        // If mentor, must be their own event (already checked userId)
        if (role === "mentor" && event.createdByRole !== "mentor") {
          return res.status(403).json({ message: "Permission denied" });
        }
        
        // If admin, can delete admin events
        if (role === "admin" && event.createdByRole !== "admin") {
          return res.status(403).json({ message: "Permission denied" });
        }

        db.run(
          `DELETE FROM calendar_events WHERE id = ?`,
          [id],
          (err) => {
            if (err) {
              console.error("DELETE EVENT ERROR:", err);
              return res.status(500).json({ message: "Server error" });
            }
            return res.json({ message: "Event deleted successfully" });
          }
        );
      }
    );
  } catch (err) {
    console.error("DELETE EVENT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
};
