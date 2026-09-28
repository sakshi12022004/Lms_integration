const tenantConnectionManager = require('../config/tenant-connection-manager');
const BilingualDataService = require("../services/BilingualDataService");
const db = require("../config/database-switch");



/* ======================================================
   CREATE ANNOUNCEMENT
====================================================== */
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, publishFor, courseId } = req.body;
    const userId = req.user.userId;
    const role = req.user.role;
    const universityId = req.user?.universityId || req.user?.university_id || 1;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message required" });
    }

    // Build announcement payload
    let announcementData = {
      title,
      content: message,
      university_id: universityId,
      createdByUser: userId,
      createdByRole: role,
    };

    /* ================= ADMIN ================= */
    if (role === "admin") {
      if (!publishFor) {
        return res.status(400).json({ message: "publishFor is required" });
      }

      // Normalize publishFor - accept: 'students', 'mentors'/'faculty', 'both'/'all'
      const pf = String(publishFor).toLowerCase().trim();
      let normalized = pf;
      
      // Normalize to canonical values
      if (pf === "both" || pf === "all") normalized = "both";
      else if (pf === "faculty" || pf === "teacher" || pf === "teachers" || pf === "mentor" || pf === "mentors") normalized = "mentors";
      else if (pf === "student" || pf === "students") normalized = "students";
      else {
        return res.status(400).json({ 
          message: "publishFor must be 'students', 'mentors', or 'both'" 
        });
      }

      announcementData.publishFor = normalized;
    }

    /* ================= MENTOR ================= */
    if (role === "mentor") {
      if (!courseId) {
        return res.status(400).json({ message: "courseId is required" });
      }
      announcementData.courseId = courseId;
    }

    // Insert announcement into announcements table using simplified approach
    const columns = ['title', 'content', 'university_id', 'createdByUser', 'createdByRole'];
    const values = [announcementData.title, announcementData.content, universityId, userId, role];

    // Add publishFor for admin announcements
    if (announcementData.publishFor) {
      columns.push('publishFor');
      values.push(announcementData.publishFor);
    }

    // Add courseId for mentor announcements
    if (announcementData.courseId) {
      columns.push('courseId');
      values.push(announcementData.courseId);
    }

    // Build the INSERT query
    const placeholders = columns.map(() => '?').join(', ');
    const insertQuery = `INSERT INTO announcements (${columns.join(', ')}) VALUES (${placeholders})`;

    db.run(insertQuery, values, function(err) {
      if (err) {
        console.error("Error creating announcement:", err);
        return res.status(500).json({ message: "Error creating announcement" });
      }

      console.log("✅ Announcement created successfully");
      res.json({
        success: true,
        message: "Announcement created successfully",
        data: {
          id: this.lastID,
          ...announcementData
        }
      });
    });
  } catch (error) {
    console.error("CREATE ANNOUNCEMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   GET ALL ANNOUNCEMENTS
====================================================== */
const getAllAnnouncements = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.userId;
    const universityId = req.user?.universityId || req.user?.university_id || 1;

    let query = `
      SELECT a.*, u.name as createdByUserName
      FROM announcements a
      LEFT JOIN users u ON a.createdByUser = u.id
      WHERE a.university_id = ?
    `;

    // Filter based on role
    if (role === "student") {
      // Students see:
      // 1. Announcements published for 'students' or 'both'
      // 2. Announcements created by mentors for courses the student is enrolled in
      query += ` AND (
        a.publishFor IN ('students', 'both')
        OR (a.createdByRole = 'mentor' AND a.courseId IN (SELECT courseId FROM course_students WHERE studentId = ?))
      )`;
    } else if (role === "mentor" || role === "teacher" || role === "faculty") {
      // Mentors see:
      // 1. Announcements published for 'mentors' or 'both'
      // 2. Their own course announcements (where publishFor is NULL and courseId is set)
      query += ` AND (
        a.publishFor IN ('mentors', 'both')
        OR (a.courseId IN (SELECT id FROM courses WHERE mentorId = ?))
      )`;
    } else if (role === "admin") {
      // Admin can see all announcements from their university
      // query already filtered by university_id
    }

    query += ` ORDER BY a.createdAt DESC`;

    console.log(`📋 Fetching announcements for role: ${role}, userId: ${userId}, university: ${universityId}`);
    console.log(`   Query: ${query}`);

    // Prepare query params: universityId is always first, then userId for subqueries
    let params = [universityId];
    if (role === 'student') params.push(userId);
    else if (role === "mentor" || role === "teacher" || role === "faculty") params.push(userId);
    
    db.all(query, params, (err, announcements) => {
      if (err) {
        console.error("Error fetching announcements:", err);
        return res.status(500).json({ message: "Database error" });
      }

      // Ensure readBy field is properly parsed for each announcement
      const processedAnnouncements = (announcements || []).map(announcement => ({
        ...announcement,
        readBy: announcement.readBy || '[]' // Ensure readBy field exists
      }));

      // Format announcements according to language (fallback to 'en' if not provided)
      const language = req.language || req.headers['accept-language'] || 'en';
      const formatted = BilingualDataService.formatAnnouncements(processedAnnouncements, language);

      console.log(`📋 Retrieved ${formatted.length} announcements for ${role}`);
      res.json(formatted);
    });
  } catch (error) {
    console.error("GET ALL ANNOUNCEMENTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   DELETE ANNOUNCEMENT
====================================================== */
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;
    const universityId = req.user?.universityId || 1;

    // Check if announcement exists and user has permission
    db.get("SELECT * FROM announcements WHERE id = ? AND university_id = ?", [id, universityId], (err, announcement) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      // Check permissions (admin can delete all, mentor can delete their own)
      if (role !== "admin" && announcement.createdByUser !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete announcement
      db.run("DELETE FROM announcements WHERE id = ? AND university_id = ?", [id, universityId], function(err) {
        if (err) {
          console.error("Error deleting announcement:", err);
          return res.status(500).json({ message: "Error deleting announcement" });
        }

        res.json({ message: "Announcement deleted successfully" });
      });
    });
  } catch (error) {
    console.error("DELETE ANNOUNCEMENT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   MARK ANNOUNCEMENT AS READ
====================================================== */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    // Extract userId from req.user (handle both userId and id properties)
    const userId = req.user?.userId || req.user?.id;

    console.log(`📢 Mark as read: announcement ${id}, user ${userId}, req.user:`, req.user);

    if (!userId) {
      console.warn(`⚠️ No userId for announcement ${id}, skipping mark as read`);
      // Return success anyway - don't block the UI
      return res.status(200).json({ message: "OK - no userId to mark read" });
    }

    // Get current announcement
    db.get("SELECT * FROM announcements WHERE id = ?", [id], (err, announcement) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      // Parse existing readBy array
      let readBy = [];
      try {
        readBy = JSON.parse(announcement.readBy || '[]');
      } catch (e) {
        console.error("Error parsing readBy:", e);
        readBy = [];
      }

      // Ensure all items are strings for comparison
      readBy = readBy.map(String);
      const userIdStr = String(userId);

      // Add user to readBy if not already there
      if (!readBy.includes(userIdStr)) {
        readBy.push(userIdStr);
        console.log(`  ✅ Added user ${userIdStr} to readBy`);
      } else {
        console.log(`  ℹ️ User ${userIdStr} already in readBy`);
      }

      // Update announcement
      db.run(
        "UPDATE announcements SET readBy = ? WHERE id = ?",
        [JSON.stringify(readBy), id],
        function(err) {
          if (err) {
            console.error("Error updating announcement:", err);
            return res.status(500).json({ message: "Error updating announcement" });
          }

          console.log(`✅ Marked announcement ${id} as read for user ${userIdStr}`);
          res.json({ message: "Announcement marked as read" });
        }
      );
    });
  } catch (error) {
    console.error("MARK AS READ ERROR:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createAnnouncement,
  getAllAnnouncements,
  deleteAnnouncement,
  markAsRead,
};
