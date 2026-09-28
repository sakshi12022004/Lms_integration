const bcrypt = require("bcryptjs");
const tenantConnectionManager = require('../config/tenant-connection-manager');
const db = require('../config/database-switch');
const {
  checkAdminMentorQuota,
  checkAdminStudentQuota,
  checkAdminClassQuota,
  countUsersByRoleInUniversity
} = require("../helpers/quotaHelper");



const getUniversitySubscriptionPlan = (universityId) => {
  return new Promise((resolve) => {
    db.get(
      'SELECT subscriptionPlan FROM universities WHERE id = ?',
      [universityId],
      (err, row) => {
        if (err) {
          console.warn('Error fetching university subscription plan:', err.message);
          return resolve('free');
        }
        resolve(row?.subscriptionPlan || 'free');
      }
    );
  });
};

/* ================= CREATE STUDENT ================= */
exports.createStudent = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const {
      fullName,
      parentName,
      email,
      phone,
      bloodGroup,
      address,
      admissionDate,
      dob,
      className,
      section,
    } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({
        message: "Name and Email are required",
      });
    }

    // Get admin's university for tenant isolation
    const universityId = req.user.universityId || 1;

    // Check quota synchronously first
    countUsersByRoleInUniversity(universityId, 'student').then(async (currentStudentCount) => {
      try {
        // Use the university's current subscriptionPlan (propagated by superadmin upgrades)
        const planType = await getUniversitySubscriptionPlan(universityId);
        
        // Check student quota
        const quotaCheck = checkAdminStudentQuota(universityId, planType, currentStudentCount);
        if (!quotaCheck.allowed) {
          return res.status(400).json({ message: quotaCheck.message });
        }

        // Check if student already exists
        db.get("SELECT * FROM users WHERE email = ?", [email], async (err, exists) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Database error" });
          }

          if (exists) {
            return res.status(400).json({
              message: "Student already exists",
            });
          }

          // AUTO PASSWORD (SAME LOGIC)
          const rawPassword = Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          // Generate unique 10-digit student ID with 2026 prefix
          const generateStudentId = async () => {
            const prefix = "2026";
            const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            return prefix + randomSuffix;
          };

          let studentId;
          let isUnique = false;
          let attempts = 0;
          
          // Ensure unique student ID
          while (!isUnique && attempts < 10) {
            studentId = await generateStudentId();
            
            // Check if ID already exists synchronously
            const existing = await new Promise((resolve, reject) => {
              db.get("SELECT studentId FROM students WHERE studentId = ?", [studentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });
            
            if (!existing) {
              isUnique = true;
            }
            attempts++;
          }

          if (!isUnique) {
            return res.status(500).json({ message: "Unable to generate unique student ID" });
          }

          // Create user first WITH university_id
          db.run(
            "INSERT INTO users (name, email, password, role, isApproved, university_id) VALUES (?, ?, ?, ?, ?, ?)",
            [fullName, email, hashedPassword, "student", 1, universityId],
            function(err) {
              if (err) {
                console.error("Error creating user:", err);
                return res.status(500).json({ message: "Error creating student" });
              }

              const userId = this.lastID;

              // Create student record
              db.run(
                "INSERT INTO students (userId, studentId, grade, rollNumber, totalFees, feesPaid, pendingFees) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [userId, studentId, className || "", section || "", 0, 0, 0],
                function(err) {
                  if (err) {
                    console.error("Error creating student record:", err);
                    return res.status(500).json({ message: "Error creating student record" });
                  }

                  res.status(201).json({
                    message: "Student created successfully",
                    student: {
                      id: userId,
                      name: fullName,
                      email,
                      role: "student",
                      grade: className,
                      section,
                      studentId: studentId,
                      password: rawPassword, // Return password for admin
                    },
                  });
                }
              );
            }
          );
        });
      } catch (error) {
        console.error("CREATE STUDENT ERROR:", error);
        return res.status(500).json({ message: "Server error: " + error.message });
      }
    }).catch(err => {
      console.error("ERROR counting students:", err);
      return res.status(500).json({ message: "Server error" });
    });
  } catch (err) {
    console.error("CREATE STUDENT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DELETE USER (STUDENT/MENTOR) ================= */
exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userId } = req.params;

    // Check if user exists
    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deletion of admin users
      if (user.role === "admin") {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }

      // Ensure admin can only delete users in their university
      const adminUniversityId = req.user?.universityId || 1;
      if (user.university_id && Number(user.university_id) !== Number(adminUniversityId)) {
        return res.status(403).json({ message: "Cannot delete users from another university" });
      }

      // Delete related records first (for students)
      if (user.role === "student") {
        db.run("DELETE FROM students WHERE userId = ?", [userId], (err) => {
          if (err) {
            console.error("Error deleting student record:", err);
            return res.status(500).json({ message: "Error deleting student record" });
          }

          // Delete the user
          db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
            if (err) {
              console.error("Error deleting user:", err);
              return res.status(500).json({ message: "Error deleting user" });
            }

            res.json({ message: "User deleted successfully" });
          });
        });
      } else {
        // For mentors/teachers, just delete the user
        db.run("DELETE FROM users WHERE id = ?", [userId], function(err) {
          if (err) {
            console.error("Error deleting user:", err);
            return res.status(500).json({ message: "Error deleting user" });
          }

          res.json({ message: "User deleted successfully" });
        });
      }
    });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= CREATE TEACHER ================= */
exports.createTeacher = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const {
      name,
      email,
      phone,
      joiningDate,
      qualification,
      subject,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and Email are required",
      });
    }

    // Get admin's university for tenant isolation
    const universityId = req.user.universityId || 1;

    // Check quota synchronously first
    countUsersByRoleInUniversity(universityId, 'mentor').then(async (currentMentorCount) => {
      try {
        // Use the university's current subscriptionPlan (propagated by superadmin upgrades)
        const planType = await getUniversitySubscriptionPlan(universityId);
        
        // Check mentor quota
        const quotaCheck = checkAdminMentorQuota(universityId, planType, currentMentorCount);
        if (!quotaCheck.allowed) {
          return res.status(400).json({ message: quotaCheck.message });
        }

        // Check if teacher already exists
        db.get("SELECT * FROM users WHERE email = ?", [email], async (err, exists) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Database error" });
          }

          if (exists) {
            return res.status(400).json({
              message: "Teacher already exists",
            });
          }

          // 🔐 SAME AUTO PASSWORD LOGIC AS STUDENT
          const rawPassword = Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          // Create teacher WITH university_id
          db.run(
            "INSERT INTO users (name, email, password, role, isApproved, university_id) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, "mentor", 1, universityId],
            function(err) {
              if (err) {
                console.error("Error creating teacher:", err);
                return res.status(500).json({ message: "Error creating teacher" });
              }

              res.status(201).json({
                message: "Teacher created successfully",
                teacher: {
                  id: this.lastID,
                  name,
                  email,
                  role: "mentor",
                  phone,
                  joiningDate,
                  qualification,
                  subject,
                  universityId,
                },
                generatedPassword: rawPassword,
              });
            }
          );
        });
      } catch (error) {
        console.error("CREATE TEACHER ERROR:", error);
        return res.status(500).json({ message: "Server error: " + error.message });
      }
    }).catch(err => {
      console.error("ERROR counting mentors:", err);
      return res.status(500).json({ message: "Server error" });
    });
  } catch (err) {
    console.error("CREATE TEACHER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ALL MENTORS (FOR CLASSROOM DROPDOWN) ================= */
exports.getMentors = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    // Get all mentors from SQLite
    const adminUniversityId = req.user?.universityId || 1;
    db.all("SELECT id, name, email FROM users WHERE role = ? AND university_id = ? ORDER BY name", ["mentor", adminUniversityId], (err, mentors) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      res.json(mentors);
    });
  } catch (err) {
    console.error("GET MENTORS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
