const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path - use permanent database
const DB_PATH = path.join(__dirname, '../data/lms_permanent.db');

// Initialize database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('SQLite Connection Error:', err.message);
    console.log(' Running in Offline Mode (Mock Data Enabled)');
    console.log('⚠️ Running in Offline Mode (Mock Data Enabled)');
    global.isDbConnected = false;
  } else {
    console.log('✅ SQLite Connected to:', DB_PATH);
    global.isDbConnected = true;
    initializeTables();
  }
});

// Initialize all required tables
function initializeTables() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      university_id INTEGER DEFAULT 1,
      isApproved BOOLEAN DEFAULT 0,
      classroom_id INTEGER,
      subscriptionPlan TEXT DEFAULT 'free',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
      return;
    }
    console.log('✅ Users table created');
    
    // Add classroom_id column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE users ADD COLUMN classroom_id INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        // Column might already exist, which is fine
      }
    });
    
    // Fix column name from is_approved to isApproved if needed
    db.run(`ALTER TABLE users RENAME COLUMN is_approved TO isApproved`, (err) => {
      if (err && !err.message.includes('no such column')) {
        // Column might not exist or already renamed, which is fine
      }
    });
    
    // Add university_id column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE users ADD COLUMN university_id INTEGER DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        // Column might already exist, which is fine
      }
    });
    
    // Add subscriptionPlan column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE users ADD COLUMN subscriptionPlan TEXT DEFAULT 'free'`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding subscriptionPlan column:', err);
      } else {
        console.log('✅ subscriptionPlan column verified in users table');
      }
    });
  });

  // Universities table
  db.run(`
    CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      area TEXT NOT NULL,
      adminId INTEGER,
      subscriptionPlan TEXT DEFAULT 'free',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (adminId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating universities table:', err);
      return;
    }
    console.log('✅ Universities table created');
    
    // Add subscriptionPlan column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE universities ADD COLUMN subscriptionPlan TEXT DEFAULT 'free'`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding subscriptionPlan column:', err);
      } else {
        console.log('✅ subscriptionPlan column verified');
      }
    });
  });

  // Courses table
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      mentorId INTEGER,
      classroomId INTEGER,
      category TEXT,
      duration INTEGER,
      price REAL DEFAULT 0,
      university_id INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mentorId) REFERENCES users(id),
      FOREIGN KEY (classroomId) REFERENCES classrooms(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating courses table:', err);
      return;
    }
    console.log('✅ Courses table created');
    
    // Add classroomId column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE courses ADD COLUMN classroomId INTEGER`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding classroomId column:', err);
      }
    });

    // Add university_id column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE courses ADD COLUMN university_id INTEGER DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding university_id column:', err);
      }
    });
  });

  // Classroom assignments table
  db.run(`
    CREATE TABLE IF NOT EXISTS classroomAssignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroomId INTEGER NOT NULL,
      teacherId INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'class_teacher',
      assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroomId) REFERENCES classrooms(id),
      FOREIGN KEY (teacherId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating classroom assignments table:', err);
      return;
    }
    console.log('✅ Classroom assignments table created');
  });

  // Student classroom assignment table
  db.run(`
    CREATE TABLE IF NOT EXISTS student_classroom_assignment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      classroomId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(studentId, classroomId),
      FOREIGN KEY(studentId) REFERENCES users(id),
      FOREIGN KEY(classroomId) REFERENCES classrooms(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating student classroom assignment table:', err);
      return;
    }
    console.log('✅ Student classroom assignment table created');
  });

  // Announcements table
  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      courseId INTEGER,
      createdByUser INTEGER NOT NULL,
      createdByRole TEXT,
      publishFor TEXT DEFAULT 'all',
      priority TEXT DEFAULT 'normal',
      attachments TEXT,
      readBy TEXT DEFAULT '[]',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (university_id) REFERENCES universities(id),
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (createdByUser) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating announcements table:', err);
      return;
    }
    console.log('✅ Announcements table created');

    // Add university_id column if it doesn't exist
    db.run(`ALTER TABLE announcements ADD COLUMN university_id INTEGER NOT NULL DEFAULT 1`, (altErr) => {
      if (altErr && !altErr.message.includes('duplicate column name')) {
        console.warn('Could not add university_id column to announcements:', altErr.message);
      } else {
        console.log('✅ Added university_id to announcements table');
      }
    });
  });

  // Course students table
  db.run(`
    CREATE TABLE IF NOT EXISTS course_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(courseId, studentId),
      FOREIGN KEY(courseId) REFERENCES courses(id),
      FOREIGN KEY(studentId) REFERENCES users(id)
    )
  `, (err) => {
  // Live classes table
  db.run(`
    CREATE TABLE IF NOT EXISTS live_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      instructorId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scheduledStartTime DATETIME NOT NULL,
      scheduledEndTime DATETIME NOT NULL,
      actualStartTime DATETIME,
      actualEndTime DATETIME,
      meetingLink TEXT,
      meetingId TEXT,
      platform TEXT DEFAULT 'jitsi',
      status TEXT DEFAULT 'scheduled',
      duration INTEGER,
      recordingUrl TEXT,
      attendees TEXT DEFAULT '[]',
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (instructorId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating live_classes table:', err);
      return;
    }
    console.log('✅ Live classes table created');
  });
    if (err) {
      console.error('Error creating course students table:', err);
      return;
    }
    console.log('✅ Course students table created');
  });

  // Live class attendees table
  db.run(`
    CREATE TABLE IF NOT EXISTS live_class_attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      liveClassId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      joinedAt DATETIME NOT NULL,
      leftAt DATETIME,
      duration INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(liveClassId, studentId),
      FOREIGN KEY(liveClassId) REFERENCES live_classes(id),
      FOREIGN KEY(studentId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating live_class_attendees table:', err);
      return;
    }
    console.log('✅ Live class attendees table created');
  });

  // Attendance table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroomId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
      markedBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(classroomId) REFERENCES classrooms(id),
      FOREIGN KEY(studentId) REFERENCES users(id),
      FOREIGN KEY(markedBy) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating attendance table:', err);
      return;
    }
    console.log('✅ Attendance table created');
  });

  // Classrooms table
  db.run(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      section TEXT,
      classTeacher TEXT,
      classTeacherId INTEGER,
      studentCount INTEGER DEFAULT 0,
      timetable TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classTeacherId) REFERENCES users(id),
      FOREIGN KEY (university_id) REFERENCES universities(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating classrooms table:', err);
      return;
    }
    console.log('✅ Classrooms table created');
    
    // Add classTeacherId column if it doesn't exist
    db.run(`ALTER TABLE classrooms ADD COLUMN classTeacherId INTEGER`, (altErr) => {
      if (altErr && !altErr.message.includes('duplicate column name')) {
        console.warn('Could not add classTeacherId column:', altErr.message);
      }
    });

    // Add timetable column if it doesn't exist
    db.run(`ALTER TABLE classrooms ADD COLUMN timetable TEXT`, (altErr) => {
      if (altErr && !altErr.message.includes('duplicate column name')) {
        // Column might already exist, which is fine
      }
    });

    // Add university_id column if it doesn't exist
    db.run(`ALTER TABLE classrooms ADD COLUMN university_id INTEGER NOT NULL DEFAULT 1`, (altErr) => {
      if (altErr && !altErr.message.includes('duplicate column name')) {
        console.warn('Could not add university_id column to classrooms:', altErr.message);
      } else {
        console.log('✅ Added university_id to classrooms table');
      }
    });
  });

  // Fee structures table
  db.run(`
    CREATE TABLE IF NOT EXISTS feeStructures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      university_id INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL,
      grade TEXT,
      tuitionFee REAL DEFAULT 0,
      transportFee REAL DEFAULT 0,
      computerLabFee REAL DEFAULT 0,
      libraryFee REAL DEFAULT 0,
      sportsFee REAL DEFAULT 0,
      examinationFee REAL DEFAULT 0,
      miscellaneousFee REAL DEFAULT 0,
      totalFee REAL DEFAULT 0,
      dueDate TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(university_id, category, grade),
      FOREIGN KEY (university_id) REFERENCES universities(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating feeStructures table:', err);
      return;
    }
    console.log('✅ Fee structures table created');
    
    // Add university_id column if it doesn't exist
    db.run(`ALTER TABLE feeStructures ADD COLUMN university_id INTEGER NOT NULL DEFAULT 1`, (altErr) => {
      if (altErr && !altErr.message.includes('duplicate column name')) {
        console.warn('Could not add university_id column to feeStructures:', altErr.message);
      } else {
        console.log('✅ Added university_id to feeStructures table');
      }
    });
    
    // Clear existing fee structures to start fresh
    db.run('DELETE FROM feeStructures', (err) => {
      if (err) {
        console.error('Error clearing fee structures:', err);
      } else {
        console.log('✅ Cleared existing fee structures - starting fresh');
      }
    });
  });

  // Students table
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      studentId TEXT UNIQUE,
      grade TEXT,
      rollNumber TEXT,
      totalFees REAL DEFAULT 0,
      feesPaid REAL DEFAULT 0,
      pendingFees REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating students table:', err);
      return;
    }
    console.log('✅ Students table created');
    
    // Add studentId column if it doesn't exist (for existing tables)
    db.run(`ALTER TABLE students ADD COLUMN studentId TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding studentId column:', err);
      }
    });
  });

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      transactionId TEXT,
      razorpay_payment_id TEXT,
      razorpay_order_id TEXT,
      razorpay_signature TEXT,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (studentId) REFERENCES students(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating payments table:', err);
      return;
    }
    console.log('✅ Payments table created');
  });

  // Subscriptions table (SuperAdmin subscription management)
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      superadminId TEXT UNIQUE NOT NULL,
      planType TEXT NOT NULL CHECK (planType IN ('free', 'standard', 'professional')),
      planName TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
      startDate DATETIME NOT NULL,
      expiryDate DATETIME NOT NULL,
      durationDays INTEGER DEFAULT 30,
      paymentId TEXT,
      amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      paymentMethod TEXT,
      isFreeTrial BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating subscriptions table:', err);
      return;
    }
    console.log('✅ Subscriptions table created');
  });

  // Inventory table
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemName TEXT NOT NULL,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      unitPrice REAL DEFAULT 0,
      vendorId INTEGER,
      purchaseDate DATE,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendorId) REFERENCES vendors(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating inventory table:', err);
      return;
    }
    console.log('✅ Inventory table created');
  });

  // Vendors table
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      category TEXT,
      rating REAL DEFAULT 0,
      totalOrders INTEGER DEFAULT 0,
      totalValue REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating vendors table:', err);
      return;
    }
    console.log('✅ Vendors table created');
  });

  // Requirements table
  db.run(`
    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacherId INTEGER,
      teacherName TEXT NOT NULL,
      classroomName TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacherId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating requirements table:', err);
      return;
    }
    console.log('✅ Requirements table created');
  });

  // Requirement items table
  db.run(`
    CREATE TABLE IF NOT EXISTS requirement_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requirementId INTEGER,
      itemName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requirementId) REFERENCES requirements(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating requirement_items table:', err);
      return;
    }
    console.log('✅ Requirement items table created');
  });

  // Expenses table
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      date DATE,
      approvedBy INTEGER,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (approvedBy) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating expenses table:', err);
      return;
    }
    console.log('✅ Expenses table created');
  });

  // Results table
  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroomId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      term TEXT DEFAULT 'General',
      subjects TEXT,
      overallPercentage REAL DEFAULT 0,
      overallStatus TEXT DEFAULT 'PASS',
      comments TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(classroomId) REFERENCES classrooms(id),
      FOREIGN KEY(studentId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating results table:', err);
      return;
    }
    console.log('✅ Results table created');
  });

  // Orders table
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requirementItemId INTEGER,
      storekeeperId INTEGER NOT NULL,
      itemName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL,
      totalAmount REAL,
      vendorId INTEGER,
      orderDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      deliveryDate DATE,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requirementItemId) REFERENCES requirement_items(id),
      FOREIGN KEY (storekeeperId) REFERENCES users(id),
      FOREIGN KEY (vendorId) REFERENCES vendors(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating orders table:', err);
      return;
    }
    console.log('✅ Orders table created');
  });

  // Weeks table - for organizing course content into weeks
  db.run(`
    CREATE TABLE IF NOT EXISTS weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      weekNumber INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(courseId, weekNumber),
      FOREIGN KEY (courseId) REFERENCES courses(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating weeks table:', err);
      return;
    }
    console.log('✅ Weeks table created');
  });

  // Chapters table - for organizing course chapters
  db.run(`
    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      \`order\` INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (courseId) REFERENCES courses(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating chapters table:', err);
      return;
    }
    console.log('✅ Chapters table created');
  });

  // Progress table - for tracking student progress
  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      courseId INTEGER NOT NULL,
      contentType TEXT NOT NULL CHECK (contentType IN ('chapter', 'material', 'assessment')),
      contentId INTEGER NOT NULL,
      completed BOOLEAN DEFAULT 0,
      completedAt DATETIME,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(studentId, courseId, contentType, contentId),
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (courseId) REFERENCES courses(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating progress table:', err);
      return;
    }
    console.log('✅ Progress table created');
  });

  // Certificates table - for storing student certificates
  db.run(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      courseId INTEGER NOT NULL,
      certificateUrl TEXT,
      issuedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(studentId, courseId),
      FOREIGN KEY (studentId) REFERENCES users(id),
      FOREIGN KEY (courseId) REFERENCES courses(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating certificates table:', err);
      return;
    }
    console.log('✅ Certificates table created');
  });

  // Course Materials table - for storing video links, PDFs, files
  db.run(`
    CREATE TABLE IF NOT EXISTS course_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('video', 'pdf', 'file', 'video_link', 'pdf_link')),
      fileUrl TEXT,
      linkUrl TEXT,
      uploadedBy INTEGER,
      description TEXT,
      weekId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (weekId) REFERENCES weeks(id),
      FOREIGN KEY (uploadedBy) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating course_materials table:', err);
      return;
    }
    console.log('✅ Course materials table created');
  });

  // Assessments table - for storing assessments created by course teachers
  db.run(`
    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      courseId INTEGER NOT NULL,
      weekId INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      startTime DATETIME NOT NULL,
      endTime DATETIME NOT NULL,
      timer INTEGER DEFAULT 60,
      isPublished BOOLEAN DEFAULT 0,
      createdBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (courseId) REFERENCES courses(id),
      FOREIGN KEY (weekId) REFERENCES weeks(id),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating assessments table:', err);
      return;
    }
    console.log('✅ Assessments table created');
  });

  // Assessment Questions table - for storing questions within an assessment
  db.run(`
    CREATE TABLE IF NOT EXISTS assessment_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessmentId INTEGER NOT NULL,
      questionNumber INTEGER NOT NULL,
      questionText TEXT NOT NULL,
      questionType TEXT NOT NULL CHECK (questionType IN ('multiple_choice', 'short_answer', 'essay', 'true_false')),
      options TEXT,
      correctAnswer TEXT,
      marks INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assessmentId) REFERENCES assessments(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating assessment_questions table:', err);
      return;
    }
    console.log('✅ Assessment questions table created');
  });

  // Assessment Attempts table - for storing student assessment submissions
  db.run(`
    CREATE TABLE IF NOT EXISTS assessment_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessmentId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      totalQuestions INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL')),
      correctAnswers TEXT,
      attemptedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(assessmentId, studentId),
      FOREIGN KEY (assessmentId) REFERENCES assessments(id),
      FOREIGN KEY (studentId) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating assessment_attempts table:', err);
      return;
    }
    console.log('✅ Assessment attempts table created');
    
    // Initialize translation tables
    initializeTranslationsTable();
    initializeUserLanguageTable();
    
    // Insert demo data after all tables are created
    setTimeout(insertDemoData, 1000);
  });

  console.log('✅ Database tables initialization started');
}

// Initialize content translations table
function initializeTranslationsTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS content_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      content_field TEXT NOT NULL,
      language_code TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(content_id, content_type, content_field, language_code)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating content_translations table:', err);
    } else {
      console.log('✅ Content translations table created');
    }
  });
}

// Initialize user language preferences table
function initializeUserLanguageTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS user_language_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      language_code TEXT NOT NULL DEFAULT 'en',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating user_language_preferences table:', err);
    } else {
      console.log('✅ User language preferences table created');
    }
  });
}

// Insert demo data if tables are empty
function insertDemoData() {
  // Check if users table is empty
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
      console.error('Error checking users table:', err);
      return;
    }

    if (row.count === 0) {
      console.log('📝 Inserting demo data...');

      // Insert demo users
      const demoUsers = [
        ['Superadmin User', 'superadmin@core5.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'superadmin', 1],
        ['Admin User', 'admin@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 1],
        ['Mentor User', 'mentor@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'mentor', 1],
        ['Student User', 'student@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 1],
        ['Accountant User', 'accountant@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'accountant', 1],
        ['Storekeeper User', 'storekeeper@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'storekeeper', 1]
      ];

      const userStmt = db.prepare("INSERT INTO users (name, email, password, role, isApproved) VALUES (?, ?, ?, ?, ?)");
      demoUsers.forEach(user => {
        userStmt.run(user);
      });
      userStmt.finalize();

      // Insert demo inventory items
      const demoInventory = [
        ['Chalk', 'Stationery', 100, 2, null, '2024-01-01', 'White chalk for classroom use'],
        ['Whiteboard Marker', 'Stationery', 25, 15, null, '2024-01-01', 'Black markers for whiteboards'],
        ['Duster', 'Stationery', 15, 5, null, '2024-01-01', 'Board dusters'],
        ['Notebooks', 'Stationery', 100, 20, null, '2024-01-01', 'Student notebooks'],
        ['Pens', 'Stationery', 50, 5, null, '2024-01-01', 'Ball point pens']
      ];

      const inventoryStmt = db.prepare("INSERT INTO inventory (itemName, category, quantity, unitPrice, vendorId, purchaseDate, description) VALUES (?, ?, ?, ?, ?, ?, ?)");
      demoInventory.forEach(item => {
        inventoryStmt.run(item);
      });
      inventoryStmt.finalize();

      // Insert demo vendors
      const demoVendors = [
        ['Office Supplies Co.', 'contact@officesupplies.com', '123-456-7890', '123 Office St', 'Stationery', 4.5, 10, 5000],
        ['Education Materials Ltd', 'info@edumat.com', '987-654-3210', '456 Edu Ave', 'Books', 4.2, 5, 3000]
      ];

      const vendorStmt = db.prepare("INSERT INTO vendors (name, email, phone, address, category, rating, totalOrders, totalValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      demoVendors.forEach(vendor => {
        vendorStmt.run(vendor);
      });
      vendorStmt.finalize();

      console.log('✅ Demo data inserted successfully');
    }
  });

  // Initialize default fee structures for each grade
  // First, clear any existing fee structures to ensure clean state
  db.run(`DELETE FROM feeStructures`, (err) => {
    if (err) {
      console.error('Error clearing fee structures:', err);
    } else {
      console.log('✅ Cleared existing fee structures - starting fresh');
    }
  });

  db.get(`SELECT COUNT(*) as count FROM feeStructures`, (err, result) => {
    if (err) {
      console.error('Error checking fee structures:', err);
      return;
    }

    // Only add default fee structures if table is empty
    if (result && result.count === 0) {
      const defaultFeeStructures = [
        ['Primary', '1-4', 5000, 1000, 800, 500, 300, 700, 200, 8050, '2026-01-31'],
        ['Secondary', '5-12', 7000, 1500, 1200, 700, 500, 900, 300, 12100, '2026-01-31'],
      ];

      const feeStmt = db.prepare(
        `INSERT INTO feeStructures (category, grade, tuitionFee, transportFee, computerLabFee, libraryFee, sportsFee, examinationFee, miscellaneousFee, totalFee, dueDate) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      defaultFeeStructures.forEach(fees => {
        feeStmt.run(fees, (err) => {
          if (err && !err.message.includes('UNIQUE constraint failed')) {
            console.error('Error inserting fee structure:', err);
          }
        });
      });

      feeStmt.finalize(() => {
        console.log('✅ Default fee structures initialized');
      });
    }
  });
}

// Calendar events table
function initializeCalendarTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      startDate DATETIME NOT NULL,
      endDate DATETIME NOT NULL,
      publishFor TEXT,
      courseId INTEGER,
      createdByUser INTEGER NOT NULL,
      createdByRole TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (createdByUser) REFERENCES users(id),
      FOREIGN KEY (courseId) REFERENCES courses(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating calendar_events table:', err);
    } else {
      console.log('✅ Calendar events table created/verified');
    }
  });
}

// Initialize translations table
function initializeTranslationsTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_text TEXT NOT NULL,
      english_text TEXT NOT NULL,
      arabic_text TEXT NOT NULL,
      urdu_text TEXT NOT NULL,
      category TEXT,
      field_name TEXT,
      model_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(original_text, model_name, field_name)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating translations table:', err);
    } else {
      console.log('✅ Translations table created/verified');
    }
  });
}

// Call the initialization in initializeTables
// Add this to the end of initializeTables function
setTimeout(() => {
  initializeCalendarTable();
  initializeTranslationsTable();
  initializeUserLanguageTable();
  insertDemoData();
}, 1000);

module.exports = db;
