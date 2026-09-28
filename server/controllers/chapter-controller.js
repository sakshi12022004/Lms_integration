const Chapter = require("../models/Chapter");
const Course = require("../models/Course");
const BilingualDataService = require("../services/BilingualDataService");

// Create a new chapter
const createChapter = async (req, res) => {
  try {
    const { courseId, title, description, imageUrl, videoUrl, order } = req.body;
    const userId = req.user.userId;

    // Handle file upload
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : "";

    // Validation
    if (!courseId || !title || !videoUrl || order === undefined) {
      return res.status(400).json({ message: "courseId, title, videoUrl, and order are required" });
    }

    // Check if course exists and user is authorized (Mentor or Course Teacher)
    const course = await Course.findOne({
      _id: courseId,
      $or: [{ mentorId: userId }, { courseTeacher: userId }]
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found or access denied" });
    }

    // Check if order is unique for the course
    const existingChapter = await Chapter.findOne({ courseId, order });
    if (existingChapter) {
      return res.status(400).json({ message: "Chapter order must be unique for this course" });
    }

    const chapter = new Chapter({
      courseId,
      title,
      description,
      imageUrl: imageUrl || "",
      videoUrl,
      fileUrl,
      order,
    });

    await chapter.save();
    
    // Notify clients
    if (req.io) {
      req.io.emit("course-content-updated", { courseId });
    }

    res.status(201).json({ message: "Chapter created successfully", chapter });
  } catch (error) {
    console.error("CREATE CHAPTER ERROR:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) { // Duplicate key error
      return res.status(400).json({ message: "Chapter order must be unique for this course" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a chapter
const updateChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { title, description, imageUrl, videoUrl, order } = req.body;
    const userId = req.user.userId;

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }

    // Verify ownership via course
    const course = await Course.findOne({
      _id: chapter.courseId,
      $or: [{ mentorId: userId }, { courseTeacher: userId }]
    });

    if (!course) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Handle file upload
    if (req.file) {
      chapter.fileUrl = `/uploads/${req.file.filename}`;
    }

    if (title) chapter.title = title;
    if (description) chapter.description = description;
    if (imageUrl) chapter.imageUrl = imageUrl;
    if (videoUrl) chapter.videoUrl = videoUrl;
    if (order) chapter.order = order;

    await chapter.save();
    res.json({ message: "Chapter updated successfully", chapter });
  } catch (error) {
    console.error("UPDATE CHAPTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a chapter
const deleteChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.userId;

    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found" });
    }

    // Verify ownership
    const course = await Course.findOne({
      _id: chapter.courseId,
      $or: [{ mentorId: userId }, { courseTeacher: userId }]
    });

    if (!course) {
      return res.status(403).json({ message: "Access denied" });
    }

    await chapter.deleteOne();
    res.json({ message: "Chapter deleted successfully" });
  } catch (error) {
    console.error("DELETE CHAPTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get chapters for a course
const getChapters = async (req, res) => {
  try {
    const { courseId } = req.query.courseId ? req.query : req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (!courseId) {
      return res.status(400).json({ message: "courseId parameter is required" });
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check for access rights
    // Allow if:
    // 1. Mentor is the creator
    // 2. Mentor is the assigned course teacher
    // 3. User is a student in the course OR in the classroom of the course
    // 4. User is admin
    const isMentor = userRole === 'mentor' && (course.mentorId?.toString() === userId.toString() || course.courseTeacher?.toString() === userId.toString());
    
    let isStudent = false;
    if (userRole === 'student') {
      // Check if student is in course list
      const isInCourse = course.students.some(s => s.toString() === userId.toString());
      
      // Check if course is in student's assigned list (Double check)
      const User = require("../models/User");
      const user = await User.findById(userId);
      const isAssigned = user && user.assignedCourses.some(c => c.toString() === courseId.toString());
      
      isStudent = isInCourse || isAssigned;
    }
    
    const isAdmin = userRole === 'admin';

    // Check classroom students if not directly in course
    let isClassroomStudent = false;
    if (userRole === 'student' && !isStudent) {
      const Classroom = require("../models/Classroom");
      const classroomId = course.classroomId || course.classroom;
      if (classroomId) {
        const classroom = await Classroom.findById(classroomId);
        if (classroom && classroom.students.some(s => s.toString() === userId.toString())) {
          isClassroomStudent = true;
        }
      }
    }

    if (!isMentor && !isStudent && !isAdmin && !isClassroomStudent) {
      return res.status(403).json({ message: "Access denied" });
    }

    const chapters = await Chapter.find({ courseId }).sort({ order: 1 });
    const language = req.language || 'en';
    const formatted = BilingualDataService.formatChapters(chapters, language);
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createChapter,
  updateChapter,
  deleteChapter,
  getChapters
};
