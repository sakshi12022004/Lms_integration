import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/auth";
import StudentLayout from "../../components/StudentLayout";
import { toast } from "react-toastify";
import { useTranslation } from "../../context/TranslationContext";
import io from "socket.io-client";
import axios from "axios";
import { Video, X, Clock, Calendar } from "lucide-react";

const CourseViewer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { API, token, user } = useAuth();
  const { t } = useTranslation();

  const [course, setCourse] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedChapters, setCompletedChapters] = useState([]);
  const [completedMaterials, setCompletedMaterials] = useState([]);
  const [completedAssessments, setCompletedAssessments] = useState([]);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [progress, setProgress] = useState(0);
  const [liveClasses, setLiveClasses] = useState([]);
  const [showJitsiModal, setShowJitsiModal] = useState(false);
  const [jitsiUrl, setJitsiUrl] = useState("");
  const studentId = user?.id || 'demo'; // Get student ID from auth

  useEffect(() => {
    console.log('🎓 CourseViewer - courseId:', courseId);
    console.log('🎓 CourseViewer - token:', token);
    console.log('🎓 CourseViewer - Starting fetchCourseData...');
    if (token) {
      fetchCourseData();
      fetchProgress();
      fetchCourseLiveClasses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, token]);

  const fetchProgress = async () => {
    try {
      // Load chapters progress from database
      const res = await fetch(`${API}/progress/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        console.log('🎓 Progress data received:', data);
        
        // Handle both old and new data formats with safety checks
        const allProgress = Array.isArray(data.progress) ? data.progress : [];
        const chaptersProgress = Array.isArray(data.chaptersProgress) ? data.chaptersProgress : [];
        const materialsProgress = Array.isArray(data.materialsProgress) ? data.materialsProgress : [];
        const assessmentsProgress = Array.isArray(data.assessmentsProgress) ? data.assessmentsProgress : [];
        
        // Set completed chapters
        setCompletedChapters(chaptersProgress.filter(p => p && p.completed).map(p => p.chapterId || p.contentId).filter(Boolean) || 
                          allProgress.filter(p => p && p.completed && (p.contentType === 'chapter' || p.chapterId)).map(p => p.chapterId || p.contentId).filter(Boolean) || []);
        
        // Set completed materials from API ✅
        setCompletedMaterials(materialsProgress.filter(p => p && p.completed).map(p => p.contentId).filter(Boolean) || []);
        
        // Set completed assessments from API ✅
        setCompletedAssessments(assessmentsProgress.filter(p => p && p.completed).map(p => p.contentId).filter(Boolean) || []);
        
        // Set overall progress
        setProgress(typeof data.completionPercentage === 'number' ? data.completionPercentage : 0);
        
        console.log('🎓 Loaded from API:', {
          chapters: completedChapters.length,
          materials: (materialsProgress.filter(p => p && p.completed) || []).length,
          assessments: (assessmentsProgress.filter(p => p && p.completed) || []).length
        });
      }
      
    } catch (error) {
      console.error("Failed to fetch progress", error);
      
      // Fallback to localStorage for everything
      try {
        const materialsStorageKey = `completed_materials_${courseId}_${studentId}`;
        const assessmentsStorageKey = `completed_assessments_${courseId}_${studentId}`;
        
        const completedMaterialsStorage = JSON.parse(localStorage.getItem(materialsStorageKey) || '[]');
        const completedAssessmentsStorage = JSON.parse(localStorage.getItem(assessmentsStorageKey) || '[]');
        
        setCompletedChapters([]);
        setCompletedMaterials(completedMaterialsStorage);
        setCompletedAssessments(completedAssessmentsStorage);
        setProgress(0);
      } catch (localStorageError) {
        console.error("LocalStorage fallback failed:", localStorageError);
        setCompletedChapters([]);
        setCompletedMaterials([]);
        setCompletedAssessments([]);
        setProgress(0);
      }
    }
  };

  const markChapterAsComplete = async (chapterId) => {
    try {
      const res = await fetch(`${API}/progress/mark-completed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ chapterId })
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to mark as complete");
        return;
      }

      setCompletedChapters([...completedChapters, chapterId]);
      toast.success(t('chapter_completed'));
      fetchProgress(); // Refresh progress
    } catch (error) {
      console.error(error);
      toast.error(t('error_marking_complete'));
    }
  };

  const markMaterialAsComplete = async (materialId) => {
    try {
      console.log('🎯 markMaterialAsComplete called:', { materialId, courseId, studentId, token: token ? '***' : 'NO TOKEN' });
      
      // Try to save to database first
      const requestBody = {
        contentId: materialId,
        contentType: 'material',
        courseId
      };
      
      console.log('📤 Sending request:', { 
        url: `${API}/progress/mark-content-completed`,
        body: requestBody 
      });
      
      const res = await fetch(`${API}/progress/mark-content-completed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();
      console.log('📥 Response received:', { status: res.status, data });

      if (res.ok) {
        setCompletedMaterials([...completedMaterials, materialId]);
        toast.success(t('material_completed'));
        fetchProgress(); // Refresh progress from DB
        console.log('✅ Material marked as complete in database:', materialId);
      } else {
        console.warn('❌ Material API failed:', data.message);
        // Fallback to localStorage if API fails
        const storageKey = `completed_materials_${courseId}_${studentId || 'demo'}`;
        let completedMaterialsStorage = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!completedMaterialsStorage.includes(materialId)) {
          completedMaterialsStorage.push(materialId);
          localStorage.setItem(storageKey, JSON.stringify(completedMaterialsStorage));
          setCompletedMaterials([...completedMaterials, materialId]);
          toast.success(t('material_completed') + ' (offline)');
        }
      }
      calculateProgress();
    } catch (error) {
      console.error("❌ Error marking material as complete:", error);
      // Fallback to localStorage
      try {
        const storageKey = `completed_materials_${courseId}_${studentId || 'demo'}`;
        let completedMaterialsStorage = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!completedMaterialsStorage.includes(materialId)) {
          completedMaterialsStorage.push(materialId);
          localStorage.setItem(storageKey, JSON.stringify(completedMaterialsStorage));
          setCompletedMaterials([...completedMaterials, materialId]);
          toast.success(t('material_completed') + ' (offline)');
          calculateProgress();
        }
      } catch (e) {
        toast.error("Error marking material as complete");
      }
    }
  };

  const markAssessmentAsComplete = async (assessmentId) => {
    try {
      // Try to save to database first
      const res = await fetch(`${API}/progress/mark-content-completed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          contentId: assessmentId,
          contentType: 'assessment',
          courseId
        })
      });

      const data = await res.json();

      if (res.ok) {
        setCompletedAssessments([...completedAssessments, assessmentId]);
        toast.success(t('assessment_completed'));
        fetchProgress(); // Refresh progress from DB
        console.log('Assessment marked as complete in database:', assessmentId);
      } else {
        console.warn('Assessment API failed, falling back to localStorage:', data.message);
        // Fallback to localStorage if API fails
        const storageKey = `completed_assessments_${courseId}_${studentId || 'demo'}`;
        let completedAssessmentsStorage = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!completedAssessmentsStorage.includes(assessmentId)) {
          completedAssessmentsStorage.push(assessmentId);
          localStorage.setItem(storageKey, JSON.stringify(completedAssessmentsStorage));
          setCompletedAssessments([...completedAssessments, assessmentId]);
          toast.success(t('assessment_completed') + ' (offline)');
        }
      }
      calculateProgress();
    } catch (error) {
      console.error("Error marking assessment as complete:", error);
      // Fallback to localStorage
      try {
        const storageKey = `completed_assessments_${courseId}_${studentId || 'demo'}`;
        let completedAssessmentsStorage = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!completedAssessmentsStorage.includes(assessmentId)) {
          completedAssessmentsStorage.push(assessmentId);
          localStorage.setItem(storageKey, JSON.stringify(completedAssessmentsStorage));
          setCompletedAssessments([...completedAssessments, assessmentId]);
          toast.success(t('assessment_completed') + ' (offline)');
          calculateProgress();
        }
      } catch (e) {
        toast.error("Error marking assessment as complete");
      }
    }
  };

  const calculateProgress = () => {
    try {
      // Calculate overall progress based on completed items with safety checks
      const totalItems = (Array.isArray(chapters) ? chapters.length : 0) + 
                        (Array.isArray(materials) ? materials.length : 0) + 
                        (Array.isArray(assessments) ? assessments.length : 0);
      const completedItems = (Array.isArray(completedChapters) ? completedChapters.length : 0) + 
                           (Array.isArray(completedMaterials) ? completedMaterials.length : 0) + 
                           (Array.isArray(completedAssessments) ? completedAssessments.length : 0);
      const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      setProgress(progressPercentage);
    } catch (error) {
      console.error("Error calculating progress:", error);
      setProgress(0); // Set fallback progress
    }
  };

  const toggleWeekExpansion = (weekId) => {
    setExpandedWeek(expandedWeek === weekId ? null : weekId);
  };

  const markAsComplete = markChapterAsComplete; // Keep for backward compatibility

  const fetchCourseLiveClasses = async () => {
    try {
      console.log('🎬 Fetching live classes for courseId:', courseId);
      console.log('🎬 API URL:', `${API}/live-classes/course/${courseId}`);
      console.log('🎬 Token exists:', !!token);
      const response = await axios.get(
        `${API}/live-classes/course/${courseId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Live classes API response status:', response.status);
      console.log('🎬 Live classes response data:', response.data);
      console.log('🎬 Number of live classes:', Array.isArray(response.data) ? response.data.length : 0);
      setLiveClasses(Array.isArray(response.data) ? response.data : []);
      console.log('🎬 Live classes state updated');
    } catch (error) {
      console.error('❌ Error fetching live classes:', error.message);
      console.error('❌ Full error:', error);
      if (error.response) {
        console.error('❌ Error response status:', error.response.status);
        console.error('❌ Error response data:', error.response.data);
      }
      setLiveClasses([]);
    }
  };

  const handleJoinLiveClass = async (liveClassId, meetingLink) => {
    try {
      // Record attendance
      await axios.post(
        `${API}/live-classes/${liveClassId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Open Jitsi modal
      setJitsiUrl(
        `${meetingLink}?prejoinPageEnabled=false&userInfo={"displayName":"${user?.name || "Student"}","role":"participant"}`
      );
      setShowJitsiModal(true);
      toast.success(t('joined_live_class'));
    } catch (error) {
      console.error('Error joining live class:', error);
      toast.error(t('failed_join_live_class'));
    }
  };

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      console.log('🎓 fetchCourseData - Starting to fetch course data for courseId:', courseId);

      /* ================= COURSE ================= */
      console.log('🎓 Fetching course from:', `${API}/courses/${courseId}`);
      const courseRes = await fetch(`${API}/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('🎓 Course response status:', courseRes.status);
      if (!courseRes.ok) {
        console.error("Course fetch failed:", courseRes.status, courseRes.statusText);
        throw new Error(`Failed to load course: ${courseRes.statusText}`);
      }
      const courseData = await courseRes.json();
      console.log('🎓 Course data received:', courseData);
      setCourse(courseData);

      /* ================= CHAPTERS ================= */
      console.log('🎓 Fetching chapters from:', `${API}/chapters/course/${courseId}`);
      const chapterRes = await fetch(`${API}/chapters/course/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let chapterData = [];
      if (chapterRes.ok) {
        chapterData = await chapterRes.json();
        console.log('🎓 Chapters data received:', chapterData);
        setChapters(chapterData);
      } else {
        console.log('🎓 Chapters fetch failed:', chapterRes.status);
      }

      /* ================= MATERIALS ================= */
      console.log('🎓 Fetching materials from:', `${API}/materials/course/${courseId}`);
      const materialRes = await fetch(`${API}/materials/course/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let materialData = [];
      if (materialRes.ok) {
        materialData = await materialRes.json();
        console.log('🎓 Materials data received:', materialData);
        setMaterials(materialData);
      } else {
        console.log('🎓 Materials fetch failed:', materialRes.status);
      }

      /* ================= ASSESSMENTS ================= */
      console.log('🎓 Fetching assessments from:', `${API}/assessments/course/${courseId}`);
      const assessmentRes = await fetch(
        `${API}/assessments/course/${courseId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      let assessmentData = [];
      if (assessmentRes.ok) {
        assessmentData = await assessmentRes.json();
        console.log('🎓 Assessments data received:', assessmentData);
        setAssessments(assessmentData);
      } else {
        console.log('🎓 Assessments fetch failed:', assessmentRes.status);
      }

      /* ================= ORGANIZE BY WEEKS ================= */
      // Create weeks based on available content
      const weeksMap = new Map();
      
      // Create week 1 by default
      weeksMap.set('week-1', {
        id: 'week-1',
        title: 'Week 1',
        chapters: [],
        materials: [],
        assessments: []
      });
      
      // Add all chapters to week 1 for now (with safety checks)
      if (Array.isArray(chapterData)) {
        chapterData.forEach((chapter) => {
          if (chapter && chapter._id) {
            weeksMap.get('week-1').chapters.push(chapter);
          }
        });
      }

      // Add all materials to week 1 (with safety checks)
      if (Array.isArray(materialData)) {
        materialData.forEach((material) => {
          if (material && material._id) {
            weeksMap.get('week-1').materials.push(material);
          }
        });
      }

      // Add all assessments to week 1 (with safety checks)
      if (Array.isArray(assessmentData)) {
        assessmentData.forEach((assessment) => {
          if (assessment && assessment.id) {
            weeksMap.get('week-1').assessments.push(assessment);
          }
        });
      }

      const weeksArray = Array.from(weeksMap.values());
      console.log('🎓 Weeks organized:', weeksArray);
      console.log('🎓 Week 1 content:', {
        chapters: weeksArray[0]?.chapters?.length || 0,
        materials: weeksArray[0]?.materials?.length || 0,
        assessments: weeksArray[0]?.assessments?.length || 0
      });
      setWeeks(weeksArray);

    } catch (error) {
      console.error("🎓 fetchCourseData ERROR:", error);
      toast.error(t('failed_load_course'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <StudentLayout><div className="flex-1 overflow-y-auto scrollable-content p-3 sm:p-4 md:p-6">
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div></StudentLayout>
    );
  }

  if (!course) {
    return (
      <StudentLayout>
        <div className="p-6 text-center text-gray-500">
          Course not found
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-min-h-screen">

        {/* ================= COURSE HEADER ================= */}
        <div data-tour="course-title" className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{course.title}</h1>
              <p className="text-gray-600 text-lg">{course.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{progress}%</div>
              <div className="text-sm text-gray-500">{t('overall_progress')}</div>
            </div>
          </div>
        </div>

        {/* ================= WEEKS CARDS ================= */}
        {weeks.length > 0 ? (
          <div className="space-y-6">
            {weeks.map((week, weekIndex) => {
              // Safety checks for week data
              const weekChapters = Array.isArray(week.chapters) ? week.chapters : [];
              const weekMaterials = Array.isArray(week.materials) ? week.materials : [];
              const weekAssessments = Array.isArray(week.assessments) ? week.assessments : [];
              
              const weekTotalItems = weekChapters.length + weekMaterials.length + weekAssessments.length;
              const weekCompletedItems = 
                weekChapters.filter(ch => ch && ch._id && completedChapters.includes(ch._id)).length +
                weekMaterials.filter(m => m && m._id && completedMaterials.includes(m._id)).length +
                weekAssessments.filter(a => a && a.id && completedAssessments.includes(a.id)).length;
              const weekProgress = weekTotalItems > 0 ? Math.round((weekCompletedItems / weekTotalItems) * 100) : 0;
              const isExpanded = expandedWeek === week.id;

              return (
                <div key={`week-${week.id || weekIndex}`} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                  {/* Week Header with Progress Circle */}
                  <div 
                    data-tour={weekIndex === 0 ? 'course-weeks-progress' : undefined}
                    data-tour-week-items={weekTotalItems}
                    className="p-6 cursor-pointer bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors"
                    onClick={() => toggleWeekExpansion(week.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                          <svg className="transform -rotate-90 w-16 h-16">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="#e5e7eb"
                              strokeWidth="4"
                              fill="none"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              stroke="#3b82f6"
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 28}`}
                              strokeDashoffset={`${2 * Math.PI * 28 * (1 - weekProgress / 100)}`}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-gray-700">{weekProgress}%</span>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{week.title}</h3>
                          <p className="text-sm text-gray-600">
                            {weekCompletedItems} of {weekTotalItems} items completed
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm text-gray-500">{t('status')}</div>
                          <div className={`text-sm font-medium ${weekProgress === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                            {weekProgress === 100 ? 'Completed' : 'In Progress'}
                          </div>
                        </div>
                        <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Week Content (Expandable) */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                      
                      {/* Chapters Section */}
                      {weekChapters.length > 0 && (
                        <div className="mb-8">
                          <h4 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <span className="text-white text-sm">📖</span>
                            </div>
                            {t('chapters')}
                          </h4>
                          <div className="space-y-4">
                            {weekChapters.map((chapter, index) => {
                              if (!chapter || !chapter._id) return null;
                              const isCompleted = Array.isArray(completedChapters) && completedChapters.includes(chapter._id);
                              return (
                                <div key={`chapter-${chapter._id || index}`} className={`bg-white rounded-lg p-4 border ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-800">{chapter.title}</h5>
                                      <p className="text-sm text-gray-600 mt-1">{chapter.description}</p>
                                      <div className="flex gap-3 mt-3">
                                        {chapter.videoUrl && (
                                          <a href={chapter.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
                                            🎥 Watch Video
                                          </a>
                                        )}
                                        {chapter.pdfUrl && (
                                          <a href={chapter.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-red-600 hover:underline">
                                            📄 View PDF
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    {!isCompleted && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markChapterAsComplete(chapter._id);
                                        }}
                                        className="ml-4 px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                                      >
                                        ✓ Complete
                                      </button>
                                    )}
                                    {isCompleted && (
                                      <div className="ml-4 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                        COMPLETED
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Materials Section */}
                      {weekMaterials.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            📚 Materials
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {weekMaterials.map((material, index) => {
                              if (!material || !material._id) return null;
                              const isCompleted = Array.isArray(completedMaterials) && completedMaterials.includes(material._id);
                              return (
                                <div key={`material-${material._id || index}`} data-tour={weekIndex === 0 && index === 0 ? 'course-material-item' : undefined} className={`bg-white rounded-lg p-4 border ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-800">{material.title}</h5>
                                      <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mt-1">
                                        {material.type?.replace('_', ' ') || 'FILE'}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={material.type?.includes('link') ? material.linkUrl : `${API.replace('/api', '')}${material.fileUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                                      >
                                        View
                                      </a>
                                      {!isCompleted && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            markMaterialAsComplete(material._id);
                                          }}
                                          className="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                                        >
                                          ✓
                                        </button>
                                      )}
                                      {isCompleted && (
                                        <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                          ✓
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Assessments Section */}
                      {weekAssessments.length > 0 && (
                        <div data-tour={weekIndex === 0 ? 'course-assessments' : undefined} className="mb-6">
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            📝 Assessments
                          </h4>
                          <div className="space-y-3">
                            {weekAssessments.map((assessment, index) => {
                              if (!assessment || !assessment.id) return null;
                              const isCompleted = Array.isArray(completedAssessments) && completedAssessments.includes(assessment.id);
                              return (
                                <div key={`assessment-${assessment.id || index}`} className={`bg-white rounded-lg p-4 border ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-800">{assessment.title}</h5>
                                      <p className="text-sm text-gray-600 mt-1">{assessment.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {assessment.isUnlocked && !isCompleted && (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/student/assessment/${assessment.id}`);
                                            }}
                                            className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors"
                                          >
                                            Start
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              markAssessmentAsComplete(assessment.id);
                                            }}
                                            className="px-3 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                                          >
                                            ✓
                                          </button>
                                        </>
                                      )}
                                      {isCompleted && (
                                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                          COMPLETED
                                        </div>
                                      )}
                                      {!assessment.isUnlocked && (
                                        <div className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm">
                                          🔒 Locked
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {weekChapters.length === 0 && weekMaterials.length === 0 && weekAssessments.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="text-gray-400" size={32} />
                          </div>
                          <p>No content available for this week yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= FALLBACK TO ORIGINAL LAYOUT ================= */
          <div className="space-y-8">
            {/* Materials Section */}
            {materials.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Course Materials</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {materials.map((m, index) => (
                    <div key={`material-${m._id || index}`} className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                      <div>
                        <h3 className="font-medium">{m.title}</h3>
                        <p className="text-xs text-gray-500 uppercase font-semibold mt-1">
                          {m.type?.replace('_', ' ') || 'FILE'}
                        </p>
                      </div>
                      <a
                        href={m.type?.includes('link') ? m.linkUrl : `${API.replace('/api', '')}${m.fileUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chapters Section */}
            {chapters.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Course Content</h2>
                <div className="space-y-3">
                  {chapters.map((ch, index) => {
                    const isCompleted = completedChapters.includes(ch._id);
                    return (
                      <div
                        key={`chapter-${ch._id || index}`}
                        className={`bg-white border rounded-lg p-4 transition ${isCompleted ? 'border-green-500 bg-green-50' : 'hover:shadow-md'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 cursor-pointer" onClick={() => {
                            if (ch.videoUrl || ch.pdfUrl) {
                              window.open(ch.videoUrl || ch.pdfUrl, '_blank');
                            }
                          }}>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{ch.title}</h3>
                              {isCompleted && <span className="text-green-600 text-xs font-bold px-2 py-0.5 bg-green-100 rounded-full">COMPLETED</span>}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {ch.description}
                            </p>

                            {/* Display Chapter Content Links */}
                            <div className="flex gap-3 mt-3">
                              {ch.videoUrl && (
                                <a href={ch.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-blue-600 hover:underline">
                                  🎥 Watch Video
                                </a>
                              )}
                              {ch.pdfUrl && (
                                <a href={ch.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-red-600 hover:underline">
                                  📄 View PDF
                                </a>
                              )}
                            </div>
                          </div>

                          {!isCompleted && (
                            <button
                              onClick={() => markChapterAsComplete(ch._id)}
                              className="ml-4 px-3 py-1 text-xs bg-gray-100 hover:bg-green-600 hover:text-white text-gray-600 rounded-full transition border"
                            >
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assessments Section */}
            {assessments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Assessments</h2>
                <div className="space-y-3">
                  {assessments.map((a, index) => (
                    <div
                      key={`assessment-${a.id || index}`}
                      className="bg-white border rounded-xl p-4 flex justify-between items-center"
                    >
                      <div>
                        <h3 className="font-semibold">{a.title}</h3>
                        <p className="text-sm text-gray-500">
                          {a.description}
                        </p>
                      </div>

                      {a.isUnlocked ? (
                        <button
                          onClick={() =>
                            navigate(`/student/assessment/${a.id}`)
                          }
                          className="px-4 py-2 bg-blue-600 text-white rounded"
                        >
                          Take Assessment
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-gray-200 text-gray-600 rounded">
                          Locked
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {weeks.length === 0 && !loading && (
          <div className="bg-white rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-500 text-lg">No course content available yet</p>
            <p className="text-gray-400 text-sm mt-2">Content will be added by your instructor soon</p>
          </div>
        )}

        {/* ================= LIVE CLASSES SECTION ================= */}
        <div className="mb-8 space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Video size={28} className="text-purple-600" />
            🎥 Live Classes
          </h2>
          {liveClasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveClasses.map((liveClass, liveIndex) => (
                <div 
                  key={liveClass.id || liveClass._id}
                  data-tour={liveIndex === 0 ? 'course-live-video' : undefined}
                  className="bg-white rounded-xl shadow-lg p-5 border border-purple-200 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800">{liveClass.title}</h3>
                      {liveClass.description && (
                        <p className="text-sm text-gray-600 mt-1">{liveClass.description}</p>
                      )}
                    </div>
                    {liveClass.status === 'live' && (
                      <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse ml-2"></span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-700 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-500" />
                      <span>{new Date(liveClass.scheduledStartTime).toLocaleString()}</span>
                    </div>
                    {liveClass.duration && (
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-green-500" />
                        <span>Duration: {liveClass.duration} minutes</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      liveClass.status === 'live' 
                        ? 'bg-red-100 text-red-700'
                        : liveClass.status === 'completed'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {liveClass.status === 'live' ? '🔴 LIVE NOW' : 
                       liveClass.status === 'completed' ? 'Completed' :
                       'Scheduled'}
                    </span>
                    <button
                      onClick={() => handleJoinLiveClass(
                        liveClass.id || liveClass._id,
                        liveClass.meetingLink
                      )}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                    >
                      <Video size={16} />
                      {liveClass.status === 'live' ? 'Join Now' : 'Join Class'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div data-tour="course-live-video" className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 border-2 border-dashed border-purple-200 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="text-purple-500" size={32} />
              </div>
              <p className="text-gray-600 font-semibold mb-2">No live classes yet</p>
              <p className="text-gray-500 text-sm">Your instructor will add live classes here soon</p>
            </div>
          )}
        </div>

      </div>

      {/* JITSI MODAL FOR LIVE CLASS */}
      {showJitsiModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black rounded-2xl max-w-4xl w-full h-96 relative">
            {/* Close Button */}
            <button
              onClick={() => setShowJitsiModal(false)}
              className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/40 text-white p-2 rounded-lg transition-all"
            >
              <X size={24} />
            </button>

            {/* Jitsi Iframe */}
            <iframe
              src={jitsiUrl}
              allow="camera; microphone; fullscreen"
              className="w-full h-full rounded-2xl"
              title="Live Meeting"
            />
          </div>
        </div>
      )}
    </StudentLayout>
  );
};

export default CourseViewer;
