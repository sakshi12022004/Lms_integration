const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Chapter = require('../models/Chapter');
const Progress = require('../models/Progress');
const User = require('../models/User');
const { generateCertificate } = require('../utils/generateCertificate');
const path = require('path');
const fs = require('fs');

// Check if student is eligible for certificate for a course
const checkEligibility = async (req, res) => {
  try {
    const { courseId } = req.params;

    // ✅ FIX HERE
    const studentId = req.user.userId;

    // Get all chapters for the course
    const chapters = await Chapter.find({
      courseId,
      isActive: true
    }).sort({ order: 1 });

    if (chapters.length === 0) {
      return res.status(404).json({
        message: 'No chapters found for this course'
      });
    }

    // Get completed chapters
    const completedChapters = await Progress.find({
      studentId,
      courseId,
      completed: true
    });

    const isEligible = chapters.length === completedChapters.length;

    res.json({
      eligible: isEligible,
      totalChapters: chapters.length,
      completedChapters: completedChapters.length
    });

  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Generate certificate if eligible
const generateCertificateController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.userId; 


    // Check eligibility first
    const chapters = await Chapter.find({ courseId, isActive: true });
    const completedChapters = await Progress.find({
      studentId,
      courseId,
      completed: true
    });

    if (chapters.length !== completedChapters.length) {
      return res.status(400).json({ message: 'Not eligible for certificate. Complete all chapters first.' });
    }

    // Check if certificate already exists
    const existingCert = await Certificate.findOne({ studentId, courseId });
    if (existingCert) {
      return res.status(400).json({ message: 'Certificate already exists', certificateUrl: existingCert.certificateUrl });
    }

    // Get student and course details
    const student = await User.findById(studentId);
    const course = await Course.findById(courseId);

    if (!student || !course) {
      return res.status(404).json({ message: 'Student or course not found' });
    }

    // Generate PDF
    const completionDate = new Date().toLocaleDateString();
    const filePath = await generateCertificate(student.name, course.title, completionDate);

    // Save certificate record
    const certificate = new Certificate({
      studentId,
      courseId,
      certificateUrl: filePath
    });

    await certificate.save();

    res.json({
      message: 'Certificate generated successfully',
      certificateUrl: filePath,
      certificateId: certificate._id
    });

  } catch (error) {
    console.error('Error generating certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Download certificate
const downloadCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const studentId = req.user.userId;

    const certificate = await Certificate.findById(certificateId);
    if (!certificate || !certificate.studentId.equals(studentId)) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    if (!fs.existsSync(certificate.certificateUrl)) {
      return res.status(404).json({ message: 'Certificate file not found' });
    }

    res.download(
      certificate.certificateUrl,
      `certificate_${certificateId}.pdf`
    );

  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


// Get student's certificates
const getCertificates = async (req, res) => {
  try {
    const studentId = req.user.userId.toString(); // Convert to string for compatibility

    console.log('Fetching certificates for studentId:', studentId);

    const certificates = await Certificate.find({ studentId })
      .populate('courseId', 'title')
      .sort({ issuedAt: -1 });

    console.log('Found certificates:', certificates.length);

    res.json(certificates);

  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


const viewCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const studentId = req.user.userId;

    const certificate = await Certificate.findById(certificateId);

    if (!certificate || !certificate.studentId.equals(studentId)) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    const absolutePath = path.resolve(certificate.certificateUrl);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Certificate file not found' });
    }

    res.sendFile(absolutePath);

  } catch (error) {
    console.error('Error viewing certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  checkEligibility,
  generateCertificateController,
  downloadCertificate,
  getCertificates,
  viewCertificate
};
