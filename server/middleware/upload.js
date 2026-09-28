const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Create filename with timestamp and sanitized name
    const sanitized = file.originalname.replace(/\s+/g, "_").toLowerCase();
    cb(null, Date.now() + "-" + sanitized);
  }
});

// ✅ ALLOW MULTIPLE FILE TYPES FOR COURSE MATERIALS
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/gif",
    "text/plain",
    "application/zip",
    "application/x-rar-compressed"
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, true); // Allow all files but you can restrict if needed
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max file size
  }
});

module.exports = upload;

