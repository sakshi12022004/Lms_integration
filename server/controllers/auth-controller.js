const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const tenantConnectionManager = require('../config/tenant-connection-manager');

/* ================= REGISTER ================= */
exports.register = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
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

      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      db.run(
        "INSERT INTO users (name, email, password, role, isApproved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        [name, email, hashedPassword, role || "student", 1],
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
              role: role || "student",
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

    console.log(`🔍 Login attempt received: email=${email}, password=${password}`);

    if (!email) {
      console.log('❌ Email is required');
      return res.status(400).json({ message: "Email is required" });
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

      /* ================= 🔥 AUTO-CREATE DEMO USERS IF MISSING ================= */
      const demoUsers = {
        "student@gmail.com": "student",
        "mentor@gmail.com": "mentor", 
        "admin@gmail.com": "admin",
        "accountant@demo.com": "accountant",
        "storekeeper@demo.com": "storekeeper",
        "superadmin@core5.com": "superadmin",
        "portal@core5.co.in": "superadmin"
      };

      if (!user && demoUsers[normalizedEmail]) {
        console.log(`🔥 Creating demo user: ${normalizedEmail} with role: ${demoUsers[normalizedEmail]}`);
        const hashedPassword = await bcrypt.hash("12345678", 10);
        
        const userName = demoUsers[normalizedEmail].charAt(0).toUpperCase() + demoUsers[normalizedEmail].slice(1);
        console.log(`📝 User name will be: ${userName}, role: ${demoUsers[normalizedEmail]}`);
        
        masterDb.run(
          "INSERT INTO users (name, email, password, role, isApproved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [userName, normalizedEmail, hashedPassword, demoUsers[normalizedEmail], 1],
          function(err) {
            if (err) {
              console.error("❌ Demo user creation error:", err);
              return res.status(500).json({ message: "Server error" });
            }

            console.log(`✅ Demo user created with ID: ${this.lastID}`);

            const token = jwt.sign(
              { userId: this.lastID, role: demoUsers[normalizedEmail], name: userName, email: normalizedEmail, universityId: 1 },
              process.env.JWT_SECRET || "default_jwt_secret_key",
              { expiresIn: "7d" }
            );

            console.log(`✅ Token created for new demo user`);

            return res.json({
              message: "Login successful (demo user created)",
              token,
              user: {
                id: this.lastID,
                name: userName,
                email: normalizedEmail,
                role: demoUsers[normalizedEmail],
                isApproved: true,
              },
            });
          }
        );
        return;
      }
      /* ======================================================================== */

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

      /* ================= 🔥 DEMO LOGIN - ALLOW WITHOUT PASSWORD ================= */
      const demoEmails = [
        "student@gmail.com",
        "mentor@gmail.com", 
        "admin@gmail.com",
        "accountant@demo.com",
        "storekeeper@demo.com",
        "superadmin@core5.com"
      ];

      // Demo users can login without password or with any password
      if (demoEmails.includes(normalizedEmail)) {
        console.log(`🔥 Demo login for: ${normalizedEmail}, user role from DB: ${user.role}`);
        const token = jwt.sign(
          { userId: user.id, role: user.role, name: user.name, email: user.email, universityId: user.university_id || 1, subscriptionPlan: user.subscriptionPlan || 'free' },
          process.env.JWT_SECRET || "default_jwt_secret_key",
          { expiresIn: "7d" }
        );

        console.log(`✅ Token created for existing demo user, role: ${user.role}`);

        return res.json({
          message: "Login successful",
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isApproved: true,
            subscriptionPlan: user.subscriptionPlan || 'free',
          },
        });
      }

      /* ================= NORMAL LOGIN ================= */
      const isMatch = await bcrypt.compare(password, user.password);
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
      SELECT u.id, u.name, u.email, u.role, u.isApproved,
             CASE WHEN u.role = 'student' THEN s.studentId ELSE NULL END as studentId,
             CASE WHEN u.role = 'student' THEN s.grade ELSE NULL END as grade
      FROM users u 
      LEFT JOIN students s ON u.id = s.userId 
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
