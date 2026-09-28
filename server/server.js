const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database-switch");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

// Load environment variables early
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import security middleware
const { securityMiddleware } = require('./middleware/security');
console.log('🛡️ Security middleware loaded with Helmet');

// Import rate limiting middleware
const { rateLimiters } = require('./middleware/rateLimiter');
console.log('✅ Rate limiting middleware loaded (50 requests per minute)');

// Import subscription scheduler for automated expiration
require('./schedulers/subscription-scheduler');
console.log('📅 Checking for expired subscriptions at 16/3/2026, 11:43:10 am');
require('./schedulers/plan-monitor');
console.log('🚀 Starting Automated Plan Monitoring System...');
console.log('📅 Checking for plan changes every 30 seconds');

console.log('Looking for .env at:', path.join(__dirname, '.env'));
console.log('.env file exists:', fs.existsSync(path.join(__dirname, '.env')));
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  console.log('.env file content:', envContent);
}

const app = express();

// Apply security middleware globally (after app creation, before other middleware)
app.use(securityMiddleware);

// Apply rate limiting to test endpoint
app.get('/api/test-rate-limit', rateLimiters.general, (req, res) => {
  res.json({
    success: true,
    message: 'Rate limiting test endpoint',
    timestamp: new Date().toISOString(),
    rateLimitInfo: {
      limit: 50,
      windowMs: 60000,
      message: '50 requests per minute allowed'
    }
  });
});

// Set timeout configurations for stability
app.use((req, res, next) => {
  res.setTimeout(300000, () => {
    console.log('Request timeout');
    res.status(408).send('Request timeout');
  });
  next();
});

// Increase body size limits for large requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Comprehensive CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Authorization', 'Cache-Control', 'Accept', 'X-CSRF-Token', 'X-Auth-Token'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Manual CORS middleware for additional control
app.use((req, res, next) => {
  console.log('🔍 Global CORS - Method:', req.method, 'URL:', req.url, 'Origin:', req.headers.origin);
  
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Authorization, Cache-Control, Accept, X-CSRF-Token, X-Auth-Token, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Global CORS Preflight - Sending 200');
    return res.status(200).send();
  }
  
  next();
});

console.log('Environment variables loaded:');
console.log('PORT:', process.env.PORT);
console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? 'SET' : 'NOT SET');

/* ================= DATABASE INITIALIZATION ================= */
const masterDB = require("./config/master-db");
const tenantConnectionManager = require("./config/tenant-connection-manager");

// Initialize master database connection
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing master database connection...');
    await masterDB.connect();
    
    // Set master database for tenant connection manager
    tenantConnectionManager.setMasterDB(masterDB);
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

// Initialize database before starting server
initializeDatabase();

/* ================= APP & SERVER ================= */
const server = http.createServer(app);

// Set server timeout configurations for stability
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 65000; // 65 seconds  
server.headersTimeout = 66000; // 66 seconds
server.requestTimeout = 300000; // 5 minutes

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://localhost:5174", 
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5177",
  "http://127.0.0.1:5178"
];

const extraCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedCorsOrigins = Array.from(new Set([...defaultCorsOrigins, ...extraCorsOrigins]));

console.log('CORS origins allowed:', allowedCorsOrigins);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: allowedCorsOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

/* Make io accessible in controllers */
app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// Make plan change emitter available globally for real-time updates
global.emitPlanChange = (planChangeData) => {
  console.log("📡 Emitting plan change to all connected clients:", planChangeData);
  io.emit('planChanged', planChangeData);
};

// Start server-side translator monitor (optional - controlled via MONITOR_* env vars)
try {
  const startTranslatorMonitor = require('./monitor/translatorMonitor');
  startTranslatorMonitor(io).catch && startTranslatorMonitor(io);
} catch (e) {
  console.warn('Could not start translator monitor:', e.message || e);
}

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Language middleware - extract user's language preference
const languageMiddleware = require('./middleware/languageMiddleware');
app.use(languageMiddleware);

app.use(
  cors({
    origin: allowedCorsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-User-ID"],
    preflightContinue: false,
    optionsSuccessStatus: 204
  })
);

/* ================= STATIC FILES ================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= TEST ROUTE (Early binding test) ================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/* ================= ROUTES ================= */

/* Auth & Users */
app.use("/api/auth", require("./routes/auth-routes"));
app.use("/api/password-reset", require("./routes/passwordResetRoutes"));
app.use("/api/users", require("./routes/user-routes"));
const tenantDatabaseIsolation = require("./middleware/tenant-db-isolated");
// app.use("/api/superadmin", tenantDatabaseIsolation, require("./routes/superadminRoutes")); // REMOVED - DUPLICATE
app.use("/api/student", require("./routes/student-routes"));

/* Language Preferences */
app.use("/api/language", require("./routes/languageRoutes"));


/* Admin (ADD STUDENT / TEACHER / CLASSROOM later) */
app.use("/api/admin", require("./routes/adminRoutes"));

/* ✅ CLASSROOMS (NEW – NO LOGIC CHANGE) */
app.use("/api/classrooms", require("./routes/classroomRoutes"));

/* LMS Core */
app.use("/api/chapters", require("./routes/chapter-routes"));
app.use("/api/courses", require("./routes/course-routes"));
app.use("/api/progress", require("./routes/progress-routes"));
app.use("/api/certificates", require("./routes/certificate-routes"));
app.use("/api/materials", require("./routes/materialRoutes"));
app.use("/api/assessments", require("./routes/assessmentRoutes"));
app.use("/api/weeks", require("./routes/weekRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
// app.use("/api/results", require("./routes/resultRoutes")); // DISABLED: Using SQLite via universalRoutes instead

/* Calendar */
app.use("/api/calendar", require("./routes/calendarRoutes"));

/* Live Classes */
app.use("/api/live-classes", require("./routes/liveClassRoutes"));

/* Announcements */
app.use("/api/announcements", require("./routes/announcementRoutes"));

/* Database Export */
app.use("/api/database-export", require("./routes/databaseExportRoutes"));

/* Database Translations */
app.use("/api/database-translations", require("./routes/translations"));

/* Accountant Export */
app.use("/api/accountant-export", require("./routes/accountantExportRoutes"));

/* Translation */
app.use("/api/translation", require("./routes/translationRoutes"));

/* User Language */
app.use("/api/user", require("./routes/userLanguageRoutes"));

/* Translations */
app.use("/api", require("./routes/translate"));

/* Bilingual Database Operations */
app.use("/api/bilingual", require("./routes/bilingual"));

/* Payments */
app.use("/api/payments", require("./routes/payment-routes"));

/* Subscriptions */
app.use("/api/subscriptions", require("./routes/subscription-routes"));

/* Plan Inheritance System */
app.use("/api/plan-inheritance", require("./routes/plan-inheritance-routes"));

/* Plan Monitor System */
app.use("/api/plan-monitor", require("./routes/plan-monitor-routes"));

/* Transactions */
app.use("/api/transactions", require("./routes/transaction-routes"));

/* Requirements - MUST come BEFORE Universal Routes */
app.use("/api/requirements", require("./routes/requirement-routes"));

/* Orders */
app.use("/api/orders", require("./routes/orders-routes"));

/* Expenses */
app.use("/api/expenses", require("./routes/expenses-routes"));

/* Accountant Portal */
app.use("/api/accountant", require("./routes/accountantRoutes"));

/* Storekeeper Portal */
app.use("/api/storekeeper", require("./routes/storekeeperRoutes"));

/* Enhanced Stock Requests System */
app.use("/api/stock-requests", require("./routes/stockRequestsRoutes"));
app.use("/api/stock-requests/templates", require("./routes/requestTemplatesRoutes"));

/* Vendor Portal */
app.use("/api/vendor", require("./routes/vendorRoutes"));

/* Superadmin Portal */
app.use("/api/superadmin", require("./routes/superadminRoutes"));

/* Universal CRUD Routes for All Entities - MUST be last */
app.use("/api", require("./routes/universalRoutes"));

/* Global Error Handler */
const { globalErrorHandler } = require('./middleware/global-error-handler');
app.use(globalErrorHandler);

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.json({ message: "🚀 Unstop LMS API running" });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5002;

server.on('error', (err) => {
  console.error('❌ Server socket error:', err.message, err.code);
  process.exit(1);
});

server.on('clientError', (err, socket) => {
  console.error('❌ Client error:', err.message);
});

console.log('[DEBUG] About to call server.listen()');
const listenServer = server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Server is actively listening on 0.0.0.0:${PORT}`);
});

listenServer.on('error', (err) => {
  console.error('❌ Listen error:', err.message, err.code);
  process.exit(1);
});

// Log listening status after a delay
setTimeout(() => {
  console.log('[DEBUG] Server still running after 2 seconds');
}, 2000);
