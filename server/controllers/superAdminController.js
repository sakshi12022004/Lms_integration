const db = require("../config/database-switch");
const bcrypt = require("bcryptjs");
const {
  getSuperadminSubscription,
  checkUniversityQuota,
  checkUserQuotaPerUniversity,
  countUniversitiesForSuperadmin,
  countTotalUsersInUniversity,
  countUsersByRoleInUniversity,
  checkRoleQuotaInUniversity
} = require("../helpers/quotaHelper");

/* ================= CREATE UNIVERSITY + ADMIN ================= */
const createUniversityWithAdmin = async (req, res) => {
  try {
    let { universityName, area, adminName, adminEmail } = req.body;

    if (!universityName || !area || !adminName || !adminEmail) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ normalize email (IMPORTANT)
    adminEmail = adminEmail.trim().toLowerCase();

    console.log('🏛️ Creating university with admin:', { universityName, adminEmail });

    // Check if admin already exists
    const existingAdmin = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [adminEmail], (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });

    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // 🔑 auto-generate password
    const rawPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Create university first to get the ID
    const universityId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO universities (name, area, createdAt, updatedAt)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [universityName, area], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Now create admin user WITH university_id
    const adminId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (name, email, password, role, isApproved, university_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [adminName, adminEmail, hashedPassword, "admin", 1, universityId], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // Update university adminId
    await new Promise((resolve, reject) => {
      db.run(`UPDATE universities SET adminId = ? WHERE id = ?`, [adminId, universityId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.status(201).json({
      message: "University and Admin created successfully",
      university: {
        id: universityId,
        name: universityName,
        area: area,
      },
      admin: {
        id: adminId,
        name: adminName,
        email: adminEmail,
      },
      generatedPassword: rawPassword, // 🔥 SHOW ONLY ONCE
    });

  } catch (error) {
    console.error("CREATE UNIVERSITY ERROR:", error);
    return res.status(500).json({ message: "Server error: " + (error.message || error) });
  }
};

/* ================= CREATE ANY USER ================= */
const createUser = async (req, res) => {
  try {
    let { name, email, password, role, universityId } = req.body;

    if (!name || !email || !password || !role || !universityId) {
      return res.status(400).json({ message: "All fields are required (including universityId)" });
    }

    // ✅ normalize email
    email = email.trim().toLowerCase();

    // Verify university exists
    const university = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM universities WHERE id = ?", [universityId], (err, uni) => {
        if (err) reject(err);
        else resolve(uni);
      });
    });

    if (!university) {
      return res.status(400).json({ message: "University not found" });
    }

    console.log('🔍 DEBUG: About to call getSuperadminSubscription');
    // Get subscription to check plan type
    const subscription = await getSuperadminSubscription(req, "superadmin-1");
    console.log('🔍 DEBUG: Subscription result:', subscription);
    
    // Check per-role quota (especially for Free plan: 1 admin, 1 accountant, 1 storekeeper)
    const roleCount = await countUsersByRoleInUniversity(req, universityId, role);
    const roleQuotaCheck = checkRoleQuotaInUniversity(subscription.planType, role, roleCount);
    
    if (!roleQuotaCheck.allowed) {
      return res.status(400).json({
        message: roleQuotaCheck.message
      });
    }

    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user WITH university_id
    const userId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (name, email, password, role, isApproved, university_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `, [name, email, hashedPassword, role, 1, universityId], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: userId,
        name: name,
        email: email,
        role: role,
        universityId: universityId,
      },
    });

  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    return res.status(500).json({ message: "Server error: " + (error.message || error) });
  }
};

/* ================= GET ALL UNIVERSITIES ================= */
const getAllUniversities = (req, res) => {
  try {
    db.all(`
      SELECT u.id, u.name, u.area, u.adminId, u.createdAt, u.updatedAt,
             us.name as admin_name, us.email as admin_email
      FROM universities u
      LEFT JOIN users us ON u.adminId = us.id
    `, [], (err, universities) => {
      if (err) {
        console.error("GET UNIVERSITIES ERROR:", err);
        return res.status(500).json({ message: "Server error: " + err.message });
      }

      // Format response
      const formatted = universities.map(uni => ({
        id: uni.id,
        name: uni.name,
        area: uni.area,
        createdAt: uni.createdAt,
        updatedAt: uni.updatedAt,
        admin: {
          id: uni.adminId,
          name: uni.admin_name,
          email: uni.admin_email
        }
      }));

      return res.status(200).json({
        success: true,
        data: formatted,
      });
    });
  } catch (error) {
    console.error("GET UNIVERSITIES ERROR:", error);
    return res.status(500).json({ message: "Server error: " + error.message });
  }
};

/* ================= GET ALL USERS ================= */
const getAllUsers = (req, res) => {
  try {
    db.all(`
      SELECT id, name, email, role, isApproved, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `, [], (err, users) => {
      if (err) {
        console.error("GET USERS ERROR:", err);
        return res.status(500).json({ message: "Server error: " + err.message });
      }

      return res.status(200).json({
        success: true,
        data: users || [],
      });
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return res.status(500).json({ message: "Server error: " + error.message });
  }
};

/* ================= DELETE UNIVERSITY ================= */
const deleteUniversity = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "University ID is required" });
    }

    // Check if university exists
    const university = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM universities WHERE id = ?", [id], (err, uni) => {
        if (err) reject(err);
        else resolve(uni);
      });
    });

    if (!university) {
      return res.status(404).json({ message: "University not found" });
    }

    // Delete all users associated with this university
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM users WHERE university_id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete the university
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM universities WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.status(200).json({
      success: true,
      message: "University and all associated users deleted successfully"
    });

  } catch (error) {
    console.error("DELETE UNIVERSITY ERROR:", error);
    return res.status(500).json({ message: "Server error: " + (error.message || error) });
  }
};

module.exports = {
  createUniversityWithAdmin,
  createUser,
  getAllUniversities,
  getAllUsers,
  deleteUniversity,
};
