const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/timetables");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `timetable-${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|jpg|jpeg|png/;
  const ext = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  if (ext) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and image files are allowed"));
  }
};

const uploadTimetable = multer({
  storage,
  fileFilter,
});

module.exports = uploadTimetable;
