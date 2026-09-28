const Result = require("../models/Result");
const Classroom = require("../models/Classroom");
const User = require("../models/User");

/* ================= ADD/UPDATE RESULT (TEACHER) ================= */
const addResult = async (req, res) => {
  try {
    // Accept both new and legacy payloads
    let { studentId, classroomId, subjects, term, comments, marks, totalMarks, status, remarks } = req.body;
    const userId = req.user.userId;

    // Verify Teacher Access
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) return res.status(404).json({ message: "Classroom not found" });

    // Allow class teacher or admin
    if (classroom.classTeacher?.toString() !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only class teacher can add results" });
    }

    // Normalize payload: if legacy fields provided, convert to subjects array
    let normalizedSubjects = Array.isArray(subjects) ? subjects : [];
    if ((!normalizedSubjects || normalizedSubjects.length === 0) && (marks !== undefined || totalMarks !== undefined || status)) {
      if (marks === undefined || totalMarks === undefined || !status) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      normalizedSubjects = [
        {
          name: "General",
          marks: Number(marks),
          total: Number(totalMarks || 100),
          status: String(status).toUpperCase() === "FAIL" ? "FAIL" : "PASS",
        },
      ];
      comments = remarks || comments || "";
    }
    // Validate subjects in new format
    if (!normalizedSubjects || normalizedSubjects.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Calculate overall stats
    let totalObtained = 0;
    let totalMax = 0;
    let failCount = 0;

    normalizedSubjects.forEach(sub => {
      totalObtained += parseFloat(sub.marks);
      totalMax += parseFloat(sub.total);
      if ((sub.status || "PASS") === "FAIL") failCount++;
    });

    const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const overallStatus = failCount > 0 ? "FAIL" : "PASS";

    // Update or Create
    let result = await Result.findOne({ student: studentId, classroom: classroomId, term });

    if (result) {
      result.subjects = normalizedSubjects;
      result.overallPercentage = overallPercentage.toFixed(2);
      result.overallStatus = overallStatus;
      result.comments = comments;
      await result.save();
    } else {
      result = await Result.create({
        student: studentId,
        classroom: classroomId,
        term: term || "General",
        subjects: normalizedSubjects,
        overallPercentage: overallPercentage.toFixed(2),
        overallStatus,
        comments,
        createdBy: userId,
      });
    }

    res.status(200).json({ message: "Result saved successfully", result });
  } catch (error) {
    console.error("ADD RESULT ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET STUDENT RESULTS (STUDENT) ================= */
const getMyResults = async (req, res) => {
  try {
    const userId = req.user.userId;
    const results = await Result.find({ student: userId })
      .populate("classroom", "name section")
      .sort({ createdAt: -1 });

    res.json(results);
  } catch (error) {
    console.error("GET MY RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET CLASSROOM RESULTS (TEACHER) ================= */
const getClassroomResults = async (req, res) => {
  try {
    const { classroomId } = req.params;
    const results = await Result.find({ classroom: classroomId })
      .populate("student", "name email")
      .sort({ "student.name": 1 });

    res.json(results);
  } catch (error) {
    console.error("GET CLASSROOM RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= LEGACY LIST ENDPOINTS (COMPAT) ================= */
const getResults = async (req, res) => {
  try {
    const { classroomId, studentId } = req.query;
    const query = {};
    if (classroomId) query.classroom = classroomId;
    if (studentId) query.student = studentId;
    const results = await Result.find(query)
      .populate("student", "name email")
      .populate("classroom", "name section")
      .sort({ createdAt: -1 });
    res.json(results);
  } catch (error) {
    console.error("GET RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getStudentResults = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { classroomId } = req.query;
    const query = { student: studentId };
    if (classroomId) query.classroom = classroomId;
    const results = await Result.find(query)
      .populate("classroom", "name section")
      .sort({ createdAt: -1 });
    res.json(results);
  } catch (error) {
    console.error("GET STUDENT RESULTS ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addResult,
  getMyResults,
  getClassroomResults,
  // Legacy names for backward-compat
  getResults,
  getStudentResults,
};
