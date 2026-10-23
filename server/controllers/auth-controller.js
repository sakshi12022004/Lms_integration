const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const tenantConnectionManager = require('../config/tenant-connection-manager');

/* ================= REGISTER ================= */
exports.register = async (req, res) => {
  try {
    let { name, email, password } = req.body;
    // Public registration only ever creates students; a submitted role is ignored.
    // Staff and privileged accounts are created by an authenticated admin/superadmin.
    const role = "student";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Reject non-text values here: hashing a non-string password throws inside the DB callback below
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim()) {
      return res.status(400).json({ message: "Name, email and password must be text" });
    }

    email = email.trim().toLowerCase();

    // Get tenant database from request context (for register, we need to use master DB for superadmin creation)
    const db = req.tenant?.database || require('../config/database-switch');

    // Check if user already exists
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, exists) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (exists) {
        return res.status(400).json({ message: "User already exists" });
      }

      // This callback runs outside the try/catch above, so a hashing failure must be answered here
      let hashedPassword;
      try {
        hashedPassword = await bcrypt.hash(password, 10);
      } catch (hashError) {
        console.error("REGISTER HASH ERROR:", hashError.message);
        return res.status(500).json({ message: "Server error" });
      }

      // Insert new user
      db.run(
        "INSERT INTO users (name, email, password, role, isApproved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        [name, email, hashedPassword, role, 1],
        function(err) {
          if (err) {
            console.error("INSERT ERROR:", err);
            return res.status(500).json({ message: "Server error" });
          }

          res.status(201).json({
            message: "Registered successfully",
            user: {
              id: this.lastID,
              name,
              email,
              role,
              isApproved: true,
            },
          });
        }
      );
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= LOGIN ================= */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Never log the submitted password (or any token) here
    if (typeof email !== "string" || !email.trim()) {
      console.log('❌ Email is required');
      return res.status(400).json({ message: "Email is required" });
    }

    // Every login needs a password; without this check a missing one makes bcrypt throw inside the DB callback
    if (typeof password !== "string" || password === "") {
      console.log('❌ Password is required');
      return res.status(400).json({ message: "Password is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`🔍 Normalized email: ${normalizedEmail}`);

    // For login, we need to check master database first for superadmin authentication
    const masterDb = require('../config/database-switch');

    // Check if user exists in master database (for superadmins)
    masterDb.get("SELECT * FROM users WHERE email = ?", [normalizedEmail], async (err, user) => {
      if (err) {
        console.error("❌ Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      console.log(`🔍 User found:`, user ? `YES (id: ${user.id}, role: ${user.role})` : 'NO');

      // Login never creates accounts: an unknown email is only checked against vendors, then refused
      if (!user) {
        console.log(`❌ User not found in users table: ${normalizedEmail}, checking vendors table...`);
        
        // Check if this is a vendor
        masterDb.get("SELECT * FROM vendors WHERE email = ?", [normalizedEmail], async (err, vendor) => {
          if (err) {
            console.error("❌ Database error checking vendors:", err);
            return res.status(500).json({ message: "Database error" });
          }

          if (!vendor) {
            console.log(`❌ Vendor not found: ${normalizedEmail}`);
            return res.status(401).json({ message: "Invalid email or user not found" });
          }

          console.log(`✅ Vendor found: ${vendor.name} (id: ${vendor.id})`);

          // Check password for vendor (vendors can use SHA256 or bcrypt hashing)
          if (!vendor.password) {
            console.log(`❌ Vendor has no password set`);
            return res.status(401).json({ message: "Vendor account not properly configured" });
          }

          let isPasswordValid = false;

          // Check if password is bcrypt hashed (starts with $2a$ or $2b$)
          if (vendor.password.startsWith('$2a$') || vendor.password.startsWith('$2b$')) {
            // Use bcrypt comparison
            try {
              isPasswordValid = await bcrypt.compare(password, vendor.password);
              console.log(`🔐 Using bcrypt comparison for vendor: ${normalizedEmail}`);
            } catch (bcryptError) {
              console.error('Bcrypt comparison error:', bcryptError);
              isPasswordValid = false;
            }
          } else {
            // Use SHA256 comparison (for vendors created by storekeeper)
            const crypto = require('crypto');


            const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex');
            isPasswordValid = hashedInputPassword === vendor.password;
            console.log(`🔐 Using SHA256 comparison for vendor: ${normalizedEmail}`);
          }
          
          if (!isPasswordValid) {
            console.log(`❌ Invalid password for vendor: ${normalizedEmail}`);
            return res.status(401).json({ message: "Invalid password" });
          }

          console.log(`✅ Vendor password validated: ${normalizedEmail}`);

          // Create token for vendor
          const token = jwt.sign(
            { 
              userId: vendor.id, 
              role: "vendor", 
              name: vendor.name, 
              email: vendor.email, 
              universityId: vendor.university_id || 1 
            },
            process.env.JWT_SECRET || "default_jwt_secret_key",
            { expiresIn: "7d" }
          );

          console.log(`✅ Token created for vendor: ${vendor.name}`);

          return res.json({
            message: "Login successful",
            token,
            user: {
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
              role: "vendor",
              university_id: vendor.university_id || 1,
            },
          });
        });
        return;
      }

      /* ================= NORMAL LOGIN ================= */
      // Every account, without exception, must present its own password
      let isMatch = false;
      if (typeof user.password === "string" && user.password !== "") {
        try {
          isMatch = await bcrypt.compare(password, user.password);
        } catch (bcryptError) {
          // Same handling as the vendor path: a comparison failure is a refused login, never an unhandled error
          console.error('Bcrypt comparison error:', bcryptError.message);
          isMatch = false;
        }
      }
      if (!isMatch) {
        console.log(`❌ Password mismatch for: ${normalizedEmail}`);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role, name: user.name, email: user.email, universityId: user.university_id || 1, subscriptionPlan: user.subscriptionPlan || 'free' },
        process.env.JWT_SECRET || "default_jwt_secret_key",
        { expiresIn: "7d" }
      );

      console.log(`✅ Normal login successful for: ${normalizedEmail}`);

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
          subscriptionPlan: user.subscriptionPlan || 'free',
        },
      });
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET CURRENT USER ================= */
exports.getMe = async (req, res) => {
  try {
    if (req.user.role === "superadmin") {
      return res.json({
        id: "superadmin",
        name: "Super Admin",
        email: "abcd@abc.com",
        role: "superadmin",
        isApproved: true,
      });
    }

    db.get(`
      SELECT u.id, u.name, u.email, u.role, u.isApproved, u.university_id,
             uni.name as university_name, uni.area as university_area,
             CASE WHEN u.role = 'student' THEN s.studentId ELSE NULL END as studentId,
             CASE WHEN u.role = 'student' THEN s.grade ELSE NULL END as grade
      FROM users u 
      LEFT JOIN students s ON u.id = s.userId 
      LEFT JOIN universities uni ON u.university_id = uni.id
      WHERE u.id = ?
    `, [req.user.userId], (err, user) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    });
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
