import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import { Plus, Users, FileText, BarChart3, X, ChevronDown, Download, Lock, Video, Calendar, Clock } from "lucide-react";

const CourseTeacherPortal = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { API, token } = useAuth();
  const { t } = useTranslation();

  const [course, setCourse] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [showJitsiModal, setShowJitsiModal] = useState(false);
  const [jitsiUrl, setJitsiUrl] = useState("");
  const [activeLiveClassId, setActiveLiveClassId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [expandedTab, setExpandedTab] = useState('materials');

  const [showAddWeekModal, setShowAddWeekModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showAddAssessmentModal, setShowAddAssessmentModal] = useState(false);
  const [showAssignStudentsModal, setShowAssignStudentsModal] = useState(false);
  const [showAddQuestionsModal, setShowAddQuestionsModal] = useState(false);
  const [showLiveClassModal, setShowLiveClassModal] = useState(false);
  const [currentAssessmentId, setCurrentAssessmentId] = useState(null);

  const [weekForm, setWeekForm] = useState({ weekNumber: "", title: "", description: "" });
  const [materialForm, setMaterialForm] = useState({ weekId: "", title: "", type: "video_link", linkUrl: "", description: "", file: null });
  const [assessmentForm, setAssessmentForm] = useState({ weekId: "", title: "", description: "", startTime: "", endTime: "", timer: "" });
  const [liveClassForm, setLiveClassForm] = useState({ title: "", description: "", scheduledStartTime: "", scheduledEndTime: "", meetingLink: "", meetingId: "" });
  const [questionForm, setQuestionForm] = useState({ questionText: "", questionType: "multiple_choice", options: ["", "", ""], correctAnswer: "", marks: 1 });
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState([]);
  const [studentProgress, setStudentProgress] = useState({});

  // Fetch Course Data
  const fetchCourseData = async () => {
    try {
      setLoading(true);
      let courseData = null;

      // Fetch Course
      try {
        const courseRes = await fetch(`${API}/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (courseRes.ok) {
          courseData = await courseRes.json();
          setCourse(courseData);
        } else {
          console.warn("Failed to fetch course:", courseRes.status);
          setCourse(null);
        }
      } catch (err) {
        console.error("Error fetching course:", err);
        setCourse(null);
      }

      // Fetch Weeks
      try {
        const weeksRes = await fetch(`${API}/weeks?courseId=${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (weeksRes.ok) {
          const weeksData = await weeksRes.json();
          setWeeks(Array.isArray(weeksData) ? weeksData : []);
        } else {
          console.warn("Failed to fetch weeks:", weeksRes.status);
          setWeeks([]);
        }
      } catch (err) {
        console.error("Error fetching weeks:", err);
        setWeeks([]);
      }

      // Fetch Materials
      try {
        const materialsRes = await fetch(`${API}/materials?courseId=${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          setMaterials(Array.isArray(materialsData) ? materialsData : []);
        } else {
          console.warn("Failed to fetch materials:", materialsRes.status);
          setMaterials([]);
        }
      } catch (err) {
        console.error("Error fetching materials:", err);
        setMaterials([]);
      }

      // Fetch Assessments
      try {
        const assessmentsRes = await fetch(`${API}/assessments/course/${courseId}/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (assessmentsRes.ok) {
          const assessmentsData = await assessmentsRes.json();
          setAssessments(Array.isArray(assessmentsData) ? assessmentsData : []);
        } else {
          console.warn("Failed to fetch assessments:", assessmentsRes.status);
          setAssessments([]);
        }
      } catch (err) {
        console.error("Error fetching assessments:", err);
        setAssessments([]);
      }

      // Fetch Student Progress
      try {
        const progressRes = await fetch(`${API}/progress/mentor?courseId=${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          const progressMap = {};
          if (Array.isArray(progressData)) {
            progressData.forEach(item => {
              if (item.student) {
                // Use student.id for SQLite compatibility (not student._id)
                progressMap[item.student.id] = item.progress;
              }
            });
          }
          setStudentProgress(progressMap);
        } else {
          console.warn("Failed to fetch progress:", progressRes.status);
          setStudentProgress({});
        }
      } catch (err) {
        console.error("Error fetching progress:", err);
        setStudentProgress({});
      }

      // Fetch Assigned Students
      try {
        const studentsRes = await fetch(`${API}/courses/${courseId}/students`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          setStudents(Array.isArray(studentsData) ? studentsData : []);
        } else {
          console.warn("Failed to fetch assigned students:", studentsRes.status);
          setStudents([]);
        }
      } catch (err) {
        console.error("Error fetching assigned students:", err);
        setStudents([]);
      }

      // Fetch Live Classes
      try {
        const liveClassesRes = await fetch(`${API}/live-classes/course/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (liveClassesRes.ok) {
          const liveClassesData = await liveClassesRes.json();
          setLiveClasses(Array.isArray(liveClassesData) ? liveClassesData : []);
        } else {
          console.warn("Failed to fetch live classes:", liveClassesRes.status);
          setLiveClasses([]);
        }
      } catch (err) {
        console.error("Error fetching live classes:", err);
        setLiveClasses([]);
      }
    } catch (err) {
      console.error("Error in fetchCourseData:", err);
      toast.error("Failed to load course data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Available Students
  const fetchAvailableStudents = async () => {
    try {
      const res = await fetch(`${API}/users/students-simple`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allStudents = await res.json();
      const assignedIds = students.map(s => s._id || s.id);
      setAvailableStudents(allStudents.filter(s => !assignedIds.includes(s._id || s.id)));
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  // Auto-generate meeting id/link when live class modal opens
  useEffect(() => {
    if (showLiveClassModal && courseId) {
      const meetingId = `lms-${courseId}-${Date.now()}`;
      const jitsiMeetingUrl = `https://meet.jit.si/${meetingId}`;
      setLiveClassForm(prev => ({ ...prev, meetingLink: jitsiMeetingUrl, meetingId }));
    }
  }, [showLiveClassModal, courseId]);

  // Handle Add Week
  const handleAddWeek = async (e) => {
    e.preventDefault();
    if (!weekForm.weekNumber || !weekForm.title) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const res = await fetch(`${API}/weeks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          ...weekForm,
          weekNumber: parseInt(weekForm.weekNumber),
        }),
      });

      if (!res.ok) throw new Error("Failed to add week");

      toast.success("Week added successfully");
      setShowAddWeekModal(false);
      setWeekForm({ weekNumber: "", title: "", description: "" });
      fetchCourseData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to add week");
    }
  };

  // Handle Add Live Class
  const handleAddLiveClass = async (e) => {
    e.preventDefault();
    if (!liveClassForm.title || !liveClassForm.scheduledStartTime || !liveClassForm.scheduledEndTime) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      // Use pre-generated meetingId/link if available (modal generates on open)
      const meetingId = liveClassForm.meetingId || `lms-${courseId}-${Date.now()}`;
      const jitsiMeetingUrl = liveClassForm.meetingLink || `https://meet.jit.si/${meetingId}`;
      const res = await fetch(`${API}/live-classes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          title: liveClassForm.title,
          description: liveClassForm.description,
          scheduledStartTime: new Date(liveClassForm.scheduledStartTime).toISOString(),
          scheduledEndTime: new Date(liveClassForm.scheduledEndTime).toISOString(),
          meetingLink: jitsiMeetingUrl,
          meetingId: meetingId,
          platform: 'jitsi'
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: Failed to schedule live class`);
      }

      const data = await res.json();
      toast.success("Live class scheduled successfully with Jitsi Meet");
      setShowLiveClassModal(false);
      setLiveClassForm({ title: "", description: "", scheduledStartTime: "", scheduledEndTime: "", meetingLink: "" });
      fetchCourseData();
    } catch (err) {
      console.error("Error scheduling live class:", err);
      // Don't show toast for network errors to prevent spam
      if (err.name !== 'TypeError' && err.message !== 'Failed to fetch') {
        toast.error(err.message || "Failed to schedule live class");
      }
    }
  };

  // Close Jitsi modal (does not end class automatically)
  const handleCloseJitsi = () => {
    setShowJitsiModal(false);
    setJitsiUrl('');
    setActiveLiveClassId(null);
  };

  // Handle Start Live Class
  const handleStartLiveClass = async (liveClass) => {
    try {
      // Update the live class status to active
      const res = await fetch(`${API}/live-classes/${liveClass._id}/start`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actualStartTime: new Date().toISOString(),
          status: 'active'
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: Failed to start live class`);
      }

      // Embed Jitsi inside the app (modal iframe) and set teacher as moderator via userInfo
      const meetingUrl = `${liveClass.meetingLink}#config.prejoinPageEnabled=false&config.startWithAudioMuted=true&config.startWithVideoMuted=true&userInfo={"displayName":"Teacher","role":"moderator"}`;

      setJitsiUrl(meetingUrl);
      setActiveLiveClassId(liveClass._id);
      setShowJitsiModal(true);
      toast.success("Live class started — Jitsi opened in page");

      // Refresh data to update status
      fetchCourseData();
    } catch (err) {
      console.error("Error starting live class:", err);
      // Don't show toast for network errors to prevent spam
      if (err.name !== 'TypeError' && err.message !== 'Failed to fetch') {
        toast.error(err.message || "Failed to start live class");
      }
    }
  };

  // Handle Delete Live Class
  const handleDeleteLiveClass = async (liveClassId) => {
    if (!confirm("Are you sure you want to delete this live class?")) return;

    try {
      const res = await fetch(`${API}/live-classes/${liveClassId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete live class");

      toast.success("Live class deleted successfully");
      fetchCourseData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to delete live class");
    }
  };

  // Handle Add Material
  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.title || !materialForm.type) {
      toast.error("Please fill required fields");
      return;
    }

    if ((materialForm.type === "video_link" || materialForm.type === "pdf_link") && !materialForm.linkUrl) {
      toast.error("Please enter a valid link");
      return;
    }

    if ((materialForm.type === "video" || materialForm.type === "pdf" || materialForm.type === "file") && !materialForm.file) {
      toast.error("Please select a file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("courseId", courseId);
      formData.append("weekId", materialForm.weekId || "");
      formData.append("title", materialForm.title);
      formData.append("type", materialForm.type);
      if (materialForm.linkUrl) formData.append("linkUrl", materialForm.linkUrl);
      if (materialForm.file) formData.append("file", materialForm.file);

      const res = await fetch(`${API}/materials/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload material");

      toast.success("Material added successfully");
      setShowAddMaterialModal(false);
      setMaterialForm({ weekId: "", title: "", type: "video_link", linkUrl: "", description: "", file: null });
      fetchCourseData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to add material");
    }
  };

  // Handle Add Assessment
  const handleAddAssessment = async (e) => {
    e.preventDefault();
    if (!assessmentForm.title || !assessmentForm.startTime || !assessmentForm.endTime) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const res = await fetch(`${API}/assessments/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          ...assessmentForm,
          weekId: assessmentForm.weekId || null,
          timer: parseInt(assessmentForm.timer || 0),
        }),
      });

      if (!res.ok) throw new Error("Failed to create assessment");

      const data = await res.json();
      const assessmentId = data.assessment.id || data.assessment._id;

      toast.success("Assessment created successfully! Now add questions...");
      setShowAddAssessmentModal(false);
      setAssessmentForm({ weekId: "", title: "", description: "", startTime: "", endTime: "", timer: "" });
      setCurrentAssessmentId(assessmentId);
      setShowAddQuestionsModal(true);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to create assessment");
    }
  };

  // Handle Add Question
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.questionText) {
      toast.error("Please enter a question");
      return;
    }

    if (questionForm.questionType === "multiple_choice") {
      const validOptions = questionForm.options.filter(opt => opt.trim() !== "");
      if (validOptions.length < 2) {
        toast.error("Please enter at least 2 options");
        return;
      }
      if (!questionForm.correctAnswer) {
        toast.error("Please select a correct answer");
        return;
      }
    }

    try {
      // Find the index of the correct answer option
      let correctAnswerIndex = -1;
      if (questionForm.questionType === "multiple_choice") {
        const validOptions = questionForm.options.filter(opt => opt.trim() !== "");
        correctAnswerIndex = validOptions.findIndex(opt => opt === questionForm.correctAnswer);
      }

      const res = await fetch(`${API}/assessments/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assessmentId: currentAssessmentId,
          questionText: questionForm.questionText,
          questionType: questionForm.questionType,
          options: questionForm.questionType === "multiple_choice" ? questionForm.options.filter(opt => opt.trim() !== "") : null,
          correctAnswer: questionForm.questionType === "multiple_choice" ? correctAnswerIndex : questionForm.correctAnswer,
          marks: parseInt(questionForm.marks) || 1,
        }),
      });

      if (!res.ok) throw new Error("Failed to add question");

      const newQuestion = await res.json();
      setAssessmentQuestions([...assessmentQuestions, newQuestion.question]);
      
      toast.success("Question added successfully");
      setQuestionForm({ questionText: "", questionType: "multiple_choice", options: ["", "", ""], correctAnswer: "", marks: 1 });
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to add question");
    }
  };

  // Handle Finish Adding Questions
  const handleFinishQuestions = async () => {
    if (assessmentQuestions.length === 0) {
      toast.error("Please add at least one question");
      return;
    }

    toast.success("Assessment with questions created successfully!");
    setShowAddQuestionsModal(false);
    setCurrentAssessmentId(null);
    setAssessmentQuestions([]);
    fetchCourseData();
  };

  // Handle Assign Students to Course
  const handleAssignStudents = async (e) => {
    e.preventDefault();
    if (selectedStudentsToAdd.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    try {
      const res = await fetch(`${API}/courses/${courseId}/assign-students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentIds: selectedStudentsToAdd,
        }),
      });

      if (!res.ok) throw new Error("Failed to assign students");

      toast.success("Students assigned successfully");
      setShowAssignStudentsModal(false);
      setSelectedStudentsToAdd([]);
      fetchCourseData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to assign students");
    }
  };

  if (loading) return <MentorLayout><div className="p-6">Loading...</div></MentorLayout>;

  return (
    <MentorLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Course Header */}
        <div className="mb-6">
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:text-blue-700 mb-3">
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">{course?.title || "Course"}</h1>
          <p className="text-gray-600">{course?.description}</p>
          <div className="flex gap-6 mt-4 text-sm text-gray-600">
            <span>👥 {students.length} students assigned</span>
            <span>📅 {weeks.length} weeks</span>
            <span>📝 {assessments.length} assessments</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div data-tour="course-actions" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => setShowAddWeekModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Week
          </button>
          <button
            onClick={() => setShowAddMaterialModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Add Material
          </button>
          <button
            onClick={() => setShowAddAssessmentModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Assessment
          </button>
          <button
            onClick={() => {
              fetchAvailableStudents();
              setShowAssignStudentsModal(true);
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Assign Students
          </button>
        </div>

        {/* Tabs */}
        <div data-tour="course-info-tabs" className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setExpandedTab('materials')}
            className={`px-4 py-2 font-medium transition-colors ${
              expandedTab === 'materials'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📚 Weeks & Materials
          </button>
          <button
            onClick={() => setExpandedTab('assessments')}
            className={`px-4 py-2 font-medium transition-colors ${
              expandedTab === 'assessments'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📝 Assessments
          </button>
          <button
            onClick={() => setExpandedTab('live-classes')}
            data-tour="course-tab-live"
            className={`px-4 py-2 font-medium transition-colors ${
              expandedTab === 'live-classes'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🎥 Live Classes
          </button>
          <button
            onClick={() => setExpandedTab('students')}
            data-tour="course-tab-students"
            className={`px-4 py-2 font-medium transition-colors ${
              expandedTab === 'students'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 Student Progress
          </button>
        </div>

        {/* Content */}
        {expandedTab === 'materials' && (
          <div className="space-y-4">
            {weeks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No weeks added yet</p>
            ) : (
              weeks.map(week => (
                <div key={week._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedWeek(expandedWeek === week._id ? null : week._id)}
                    className="w-full p-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">Week {week.weekNumber}: {week.title}</h3>
                      <p className="text-sm text-gray-600">{week.description}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${expandedWeek === week._id ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {expandedWeek === week._id && (
                    <div className="p-4 border-t border-gray-200">
                      <div className="mb-4">
                        <h4 className="font-semibold mb-3">Materials</h4>
                        <div className="space-y-2">
                          {materials.filter(m => m.weekId === week._id).length === 0 ? (
                            <p className="text-gray-500 text-sm">No materials added for this week</p>
                          ) : (
                            materials
                              .filter(m => m.weekId === week._id)
                              .map(material => (
                                <div
                                  key={material._id}
                                  className="bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-start"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{material.title}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Type: {material.type.replace('_', ' ')} •{' '}
                                      {new Date(material.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {material.linkUrl && (
                                    <a
                                      href={material.linkUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-700 text-sm ml-2"
                                    >
                                      Open
                                    </a>
                                  )}
                                  {material.fileUrl && (
                                    <a
                                      href={material.fileUrl}
                                      className="text-blue-600 hover:text-blue-700 text-sm ml-2 flex items-center gap-1"
                                    >
                                      <Download className="w-4 h-4" /> Download
                                    </a>
                                  )}
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {expandedTab === 'assessments' && (
          <div className="space-y-4">
            {assessments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No assessments created yet</p>
            ) : (
              assessments.map(assessment => (
                <div key={assessment._id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{assessment.title}</h3>
                    {!assessment.published && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        <Lock className="w-3 h-3 inline mr-1" /> Draft
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{assessment.description}</p>
                  <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                      ⏰ <span className="font-medium">{new Date(assessment.startTime).toLocaleString()}</span>
                    </div>
                    <div>
                      ⏱️ <span className="font-medium">{assessment.endTime ? new Date(assessment.endTime).toLocaleString() : 'No end time'}</span>
                    </div>
                    <div>
                      ⌛ <span className="font-medium">{assessment.timer || 0} min</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/mentor/assessment/${assessment._id}`)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Manage Questions →
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {expandedTab === 'live-classes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Live Classes</h3>
              <button
                onClick={() => setShowLiveClassModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Video className="w-4 h-4" /> Schedule Live Class
              </button>
            </div>
            
            {liveClasses.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">No Live Classes Scheduled</p>
                <p className="text-gray-400 text-sm">Schedule your first live class to interact with students in real-time</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {liveClasses.map((liveClass, liveIndex) => (
                  <div key={liveClass._id} data-tour={liveIndex === 0 ? 'course-live-class-block' : undefined} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{liveClass.title}</h4>
                        <p className="text-gray-600 mb-4">{liveClass.description}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(liveClass.scheduledStartTime).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(liveClass.scheduledStartTime).toLocaleTimeString()} - {new Date(liveClass.scheduledEndTime).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        {liveClass.meetingLink && (
                          <>
                            {!liveClass.actualStartTime ? (
                              <button
                                onClick={() => handleStartLiveClass(liveClass)}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                              >
                                <Video className="w-4 h-4" /> Start Class
                              </button>
                            ) : (
                              <button
                                onClick={() => window.open(`${liveClass.meetingLink}#config.prejoinPageEnabled=false&userInfo={\"displayName\":\"Teacher\",\"role\":\"moderator\"}`, '_blank')}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                              >
                                <Video className="w-4 h-4" /> Rejoin Class
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteLiveClass(liveClass._id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {liveClass.actualStartTime && !liveClass.actualEndTime && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700 text-sm font-medium">🔴 Class is now live!</p>
                      </div>
                    )}
                    
                    {!liveClass.actualStartTime && new Date(liveClass.scheduledStartTime) > new Date() && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-700 text-sm font-medium">⏰ Scheduled - Class will start soon</p>
                      </div>
                    )}
                    
                    {liveClass.actualEndTime && (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-gray-700 text-sm font-medium">✅ Class Ended</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {expandedTab === 'students' && (
          <div data-tour="course-student-progress" className="space-y-4">
            {students.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No students assigned to this course</p>
            ) : (
              students.map(student => {
                const progress = studentProgress[student._id];
                return (
                  <div key={student._id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{student.name}</h3>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                    </div>
                    {progress ? (
                      <div className="text-sm text-gray-600">
                        <p>
                          📚 <span className="font-medium">{progress.completedChapters}/{progress.totalChapters}</span> chapters completed
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, progress.completionPercentage || 0)}%`, maxWidth: '100%' }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No progress yet</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* Add Week Modal */}
      {showAddWeekModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Week</h3>
              <button onClick={() => setShowAddWeekModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddWeek} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Week Number *</label>
                <input
                  type="number"
                  value={weekForm.weekNumber}
                  onChange={(e) => setWeekForm({ ...weekForm, weekNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={weekForm.title}
                  onChange={(e) => setWeekForm({ ...weekForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={weekForm.description}
                  onChange={(e) => setWeekForm({ ...weekForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddWeekModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Week
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Material</h3>
              <button onClick={() => setShowAddMaterialModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddMaterial} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Week (optional)</label>
                <select
                  value={materialForm.weekId}
                  onChange={(e) => setMaterialForm({ ...materialForm, weekId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">General (No Week)</option>
                  {weeks.map(w => (
                    <option key={w._id} value={w._id}>Week {w.weekNumber}: {w.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={materialForm.title}
                  onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select
                  value={materialForm.type}
                  onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="video_link">Video Link (YouTube, etc.)</option>
                  <option value="pdf_link">PDF Link</option>
                  <option value="video">Video Upload</option>
                  <option value="pdf">PDF Upload</option>
                  <option value="file">📁 Import File (Any Type)</option>
                </select>
              </div>
              {(materialForm.type === 'video_link' || materialForm.type === 'pdf_link') ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Link URL *</label>
                  <input
                    type="url"
                    value={materialForm.linkUrl}
                    onChange={(e) => setMaterialForm({ ...materialForm, linkUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {materialForm.type === 'file' ? 'Choose File *' : 'File *'}
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files[0] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                    accept={materialForm.type === 'video' ? 'video/*' : materialForm.type === 'pdf' ? '.pdf' : undefined}
                  />
                  {materialForm.file && (
                    <p className="text-xs text-gray-500 mt-2">Selected: {materialForm.file.name}</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="2"
                  placeholder="Add any notes about this material..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMaterialModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Assessment Modal */}
      {showAddAssessmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">Create Assessment</h3>
              <button onClick={() => setShowAddAssessmentModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddAssessment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Week (optional)</label>
                <select
                  value={assessmentForm.weekId}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, weekId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">General (No Week)</option>
                  {weeks.map(w => (
                    <option key={w._id} value={w._id}>Week {w.weekNumber}: {w.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={assessmentForm.title}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={assessmentForm.description}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Time *</label>
                <input
                  type="datetime-local"
                  value={assessmentForm.startTime}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time *</label>
                <input
                  type="datetime-local"
                  value={assessmentForm.endTime}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Timer (minutes)</label>
                <input
                  type="number"
                  value={assessmentForm.timer}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, timer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddAssessmentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Questions Modal */}
      {showAddQuestionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-bold">Add Questions to Assessment</h3>
              <button onClick={() => {
                setShowAddQuestionsModal(false);
                setCurrentAssessmentId(null);
                setAssessmentQuestions([]);
              }}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Question Form */}
              <form onSubmit={handleAddQuestion} className="border-b pb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Question Text *</label>
                  <textarea
                    value={questionForm.questionText}
                    onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="2"
                    placeholder="Enter your question here"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Question Type</label>
                  <select
                    value={questionForm.questionType}
                    onChange={(e) => setQuestionForm({ ...questionForm, questionType: e.target.value, correctAnswer: "" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="short_answer">Short Answer</option>
                    <option value="essay">Essay</option>
                    <option value="true_false">True/False</option>
                  </select>
                </div>

                {questionForm.questionType === "multiple_choice" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Options</label>
                    <div className="space-y-2">
                      {questionForm.options.map((opt, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...questionForm.options];
                            newOpts[idx] = e.target.value;
                            setQuestionForm({ ...questionForm, options: newOpts });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder={`Option ${idx + 1}`}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, ""] })}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add Option
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Correct Answer *</label>
                  {questionForm.questionType === "multiple_choice" ? (
                    <select
                      value={questionForm.correctAnswer}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select correct option</option>
                      {questionForm.options
                        .filter(opt => opt.trim() !== "")
                        .map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={questionForm.correctAnswer}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Enter correct answer"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Marks</label>
                  <input
                    type="number"
                    value={questionForm.marks}
                    onChange={(e) => setQuestionForm({ ...questionForm, marks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                    placeholder="1"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Question
                </button>
              </form>

              {/* Questions List */}
              <div>
                <h4 className="font-semibold mb-3">Questions Added ({assessmentQuestions.length})</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {assessmentQuestions.length === 0 ? (
                    <p className="text-sm text-gray-500">No questions added yet</p>
                  ) : (
                    assessmentQuestions.map((q, idx) => (
                      <div key={q._id || idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                        <p className="font-medium text-sm">{idx + 1}. {q.questionText}</p>
                        <p className="text-xs text-gray-600 mt-1">Type: {q.questionType} • Marks: {q.marks}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddQuestionsModal(false);
                    setCurrentAssessmentId(null);
                    setAssessmentQuestions([]);
                    fetchCourseData();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinishQuestions}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Students Modal */}
      {showAssignStudentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">Assign More Students</h3>
              <button onClick={() => setShowAssignStudentsModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAssignStudents} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Available Students</label>
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto p-2 space-y-2">
                  {availableStudents.length === 0 ? (
                    <p className="text-sm text-gray-500">No available students</p>
                  ) : (
                    availableStudents.map(student => (
                      <label key={student._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedStudentsToAdd.includes(student._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentsToAdd([...selectedStudentsToAdd, student._id]);
                            } else {
                              setSelectedStudentsToAdd(selectedStudentsToAdd.filter(id => id !== student._id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm">{student.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignStudentsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Assign Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Class Modal */}
      {showLiveClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">Schedule Live Class</h3>
              <button onClick={() => setShowLiveClassModal(false)}><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddLiveClass} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class Title</label>
                <input
                  type="text"
                  value={liveClassForm.title}
                  onChange={(e) => setLiveClassForm({ ...liveClassForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Introduction to React"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={liveClassForm.description}
                  onChange={(e) => setLiveClassForm({ ...liveClassForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Brief description of the live class"
                  rows="3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={liveClassForm.scheduledStartTime}
                  onChange={(e) => setLiveClassForm({ ...liveClassForm, scheduledStartTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={liveClassForm.scheduledEndTime}
                  onChange={(e) => setLiveClassForm({ ...liveClassForm, scheduledEndTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm font-medium mb-1">🎥 Jitsi Meet Integration</p>
                <p className="text-blue-600 text-xs">A secure meeting link will be automatically generated when you schedule this class.</p>
              </div>

              {/* Generated meeting link preview */}
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">Meeting Link (auto-generated)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={liveClassForm.meetingLink || ''}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      try { navigator.clipboard.writeText(liveClassForm.meetingLink || ''); toast.success('Meeting link copied'); }
                      catch (e) { toast.error('Copy failed'); }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLiveClassModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Schedule Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Jitsi Embed Modal */}
      {showJitsiModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[80vh] flex flex-col">
            <div className="p-3 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Live Class — Jitsi</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleCloseJitsi} className="px-3 py-1 bg-gray-200 rounded">Close</button>
              </div>
            </div>
            <div className="flex-1">
              <iframe
                title="Jitsi Meet"
                src={jitsiUrl}
                allow="camera; microphone; fullscreen"
                className="w-full h-full rounded-b-lg"
              />
            </div>
          </div>
        </div>
      )}
    </MentorLayout>
  );
};

export default CourseTeacherPortal;
