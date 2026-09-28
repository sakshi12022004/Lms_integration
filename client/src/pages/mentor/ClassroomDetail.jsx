import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MentorLayout from "../../components/MentorLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";
import {
  Plus,
  BookOpen,
  Users,
  X,
  ChevronDown,
  BarChart3,
  Clock,
  ArrowLeft,
} from "lucide-react";

const ClassroomDetail = () => {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const { API, token, user } = useAuth();
  const { t } = useTranslation();

  const [classroom, setClassroom] = useState(null);
  const [courses, setCourses] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [students, setStudents] = useState([]); // Students assigned to classroom
  const [allStudents, setAllStudents] = useState([]); // All students for assignment dropdown
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showAssignStudentsModal, setShowAssignStudentsModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    category: "",
    duration: "",
    courseTeacherId: "",
    studentIds: [],
  });

  // Helper function to unwrap API responses
  const unwrapResponse = (data) => {
    if (data && typeof data === 'object') {
      if ('data' in data && 'success' in data) {
        return data.data; // Wrapped response
      }
      if (Array.isArray(data)) {
        return data; // Direct array response
      }
      return data; // Direct object response
    }
    return null;
  };

  // Fetch all data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Fetch classroom details
        const classroomRes = await fetch(`${API}/classrooms/${classroomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const classroomData = await classroomRes.json();
        const classroom = unwrapResponse(classroomData);
        setClassroom(classroom);

        // Fetch courses for this classroom
        const coursesRes = await fetch(
          `${API}/courses/classroom?classroomId=${classroomId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const coursesData = await coursesRes.json();
        const courses = unwrapResponse(coursesData);
        setCourses(Array.isArray(courses) ? courses : []);

        // Fetch students assigned to this classroom
        const classroomStudentsRes = await fetch(
          `${API}/classrooms/${classroomId}/students`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const classroomStudentsData = await classroomStudentsRes.json();
        console.log('🔍 Classroom students response:', classroomStudentsData);
        
        // Handle both wrapped and direct responses
        let classroomStudents = unwrapResponse(classroomStudentsData);
        
        // If it's already an array, use it directly
        if (Array.isArray(classroomStudentsData)) {
          classroomStudents = classroomStudentsData;
        }
        
        console.log('🔍 Processed classroom students:', classroomStudents);
        setStudents(Array.isArray(classroomStudents) ? classroomStudents : []);

        // Fetch mentors for course creation dropdown
        const mentorsRes = await fetch(`${API}/users/mentors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mentorsData = await mentorsRes.json();
        const mentorsList = unwrapResponse(mentorsData);
        setMentors(Array.isArray(mentorsList) ? mentorsList : []);

        // Fetch all students for assignment modal
        const allStudentsRes = await fetch(`${API}/users/students-simple`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const allStudentsData = await allStudentsRes.json();
        const allStudentsList = unwrapResponse(allStudentsData);
        setAllStudents(Array.isArray(allStudentsList) ? allStudentsList : []);
      } catch (err) {
        console.error("Fetch error:", err);
        toast.error("Failed to load classroom details");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [classroomId, API, token]);

  // Create Course
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      if (!courseForm.title || !courseForm.description || !courseForm.courseTeacherId) {
        toast.error("Please fill all required fields");
        return;
      }

      const res = await fetch(`${API}/courses/create-course`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: courseForm.title,
          description: courseForm.description,
          category: courseForm.category,
          duration: courseForm.duration,
          mentorId: courseForm.courseTeacherId, // Map courseTeacherId to mentorId for backend
          classroomId: classroomId,
          studentIds: courseForm.studentIds,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      const response = await res.json();
      // Handle both wrapped { message, course } and direct course responses
      const newCourse = response.course || response;
      setCourses([...courses, newCourse]);
      setShowCreateCourseModal(false);
      setCourseForm({
        title: "",
        description: "",
        category: "",
        duration: "",
        courseTeacherId: "",
        studentIds: [],
      });
      toast.success("Course created successfully!");
      // Observed by GuideBot (ActionGuard) only — fires strictly after the request succeeded.
      window.dispatchEvent(new CustomEvent('guidebot:action-success', { detail: { actionId: 'course-created' } }));
    } catch (err) {
      console.error("Create course error:", err);
      toast.error(err.message || "Failed to create course");
    }
  };

  // Assign Students to Classroom
  const handleAssignStudents = async (e) => {
    e.preventDefault();
    try {
      const selectedStudents = Array.from(
        document.querySelectorAll('input[name="studentIds"]:checked')
      ).map((el) => el.value);

      if (selectedStudents.length === 0) {
        toast.error("Please select at least one student");
        return;
      }

      if (!classroomId) {
        toast.error("Classroom ID is missing");
        return;
      }

      // Assign each student to the classroom
      for (const studentId of selectedStudents) {
        console.log(`Assigning student ${studentId} to classroom ${classroomId}`);
        const res = await fetch(`${API}/classrooms/assign-student`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            classroomId: String(classroomId),
            studentId: String(studentId),
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          console.error(`Failed to assign student ${studentId}:`, error);
          throw new Error(error.message || `Failed to assign student ${studentId}`);
        }
        const result = await res.json();
        console.log(`Successfully assigned student:`, result);
      }

      setShowAssignStudentsModal(false);
      toast.success("Students assigned successfully!");
      // Observed by GuideBot (ActionGuard) only — fires strictly after the requests succeeded.
      window.dispatchEvent(new CustomEvent('guidebot:action-success', { detail: { actionId: 'classroom-students-assigned' } }));

      // Refresh classroom data and students
      const classroomRes = await fetch(`${API}/classrooms/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const classroomData = await classroomRes.json();
      const classroom = unwrapResponse(classroomData);
      setClassroom(classroom);

      // Also refresh students list
      const classroomStudentsRes = await fetch(
        `${API}/classrooms/${classroomId}/students`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const classroomStudentsData = await classroomStudentsRes.json();
      console.log('🔍 Refreshed classroom students response:', classroomStudentsData);
      
      // Handle both wrapped and direct responses
      let classroomStudents = unwrapResponse(classroomStudentsData);
      
      // If it's already an array, use it directly
      if (Array.isArray(classroomStudentsData)) {
        classroomStudents = classroomStudentsData;
      }
      
      console.log('🔍 Refreshed processed classroom students:', classroomStudents);
      setStudents(Array.isArray(classroomStudents) ? classroomStudents : []);
    } catch (err) {
      console.error("Assign student error:", err);
      toast.error(err.message || "Failed to assign students");
    }
  };

  if (loading) {
    return (
      <MentorLayout>
        <div className="p-6 flex justify-center items-center h-screen">
          <div className="text-xl text-gray-500">Loading...</div>
        </div>
      </MentorLayout>
    );
  }

  return (
    <MentorLayout>
      <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/mentor/classrooms")}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition duration-200"
            >
              <ArrowLeft size={20} /> Back to Classrooms
            </button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {classroom?.name}
              </h1>
              {classroom?.section && (
                <p className="text-lg text-gray-600 mt-1">Section: {classroom.section}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Students: <span className="text-2xl font-bold text-blue-600">{students.length}</span></p>
            <p className="text-sm text-gray-500 mt-1">Total Courses: <span className="text-2xl font-bold text-green-600">{courses.length}</span></p>
          </div>
        </div>

        {/* Enhanced Quick Actions Grid */}
        <div data-tour="classroom-quick-actions" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Create Course */}
          <button
            onClick={() => setShowCreateCourseModal(true)}
            className="bg-white border-l-4 border-blue-500 p-6 rounded-lg shadow-sm hover:shadow-md transition transform hover:scale-105 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition">
                <Plus size={28} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">Create Course</p>
                <p className="text-xs text-gray-500">Add new course</p>
              </div>
            </div>
          </button>

          {/* Assign Students */}
          <button
            onClick={() => setShowAssignStudentsModal(true)}
            className="bg-white border-l-4 border-green-500 p-6 rounded-lg shadow-sm hover:shadow-md transition transform hover:scale-105 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition">
                <Users size={28} className="text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">Assign Students</p>
                <p className="text-xs text-gray-500">Manage enrollment</p>
              </div>
            </div>
          </button>

          {/* Attendance */}
          <button
            onClick={() => navigate(`/mentor/attendance?classroomId=${classroomId}`)}
            className="bg-white border-l-4 border-yellow-500 p-6 rounded-lg shadow-sm hover:shadow-md transition transform hover:scale-105 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-yellow-100 p-3 rounded-lg group-hover:bg-yellow-200 transition">
                <Clock size={28} className="text-yellow-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">Attendance</p>
                <p className="text-xs text-gray-500">Track attendance</p>
              </div>
            </div>
          </button>

          {/* Add Result */}
          <button
            onClick={() => navigate(`/mentor/results?classroomId=${classroomId}`)}
            className="bg-white border-l-4 border-purple-500 p-6 rounded-lg shadow-sm hover:shadow-md transition transform hover:scale-105 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition">
                <BarChart3 size={28} className="text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">Add Result</p>
                <p className="text-xs text-gray-500">Record grades</p>
              </div>
            </div>
          </button>
        </div>

        {/* Courses Section */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1">📚 Courses in this Classroom</h2>
              <p className="text-gray-600 text-sm">Total: <span className="font-bold text-blue-600">{courses.length}</span> courses</p>
            </div>
            <button
              data-tour="classroom-create-course-btn"
              onClick={() => setShowCreateCourseModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2 font-semibold"
            >
              <Plus size={20} /> Create Course
            </button>
          </div>
          {courses.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="text-blue-500" size={40} />
              </div>
              <p className="text-gray-700 text-lg font-bold">No Courses Yet</p>
              <p className="text-gray-500 text-sm mt-2">Create your first course to get started</p>
              <button
                onClick={() => setShowCreateCourseModal(true)}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition font-medium"
              >
                Create First Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl overflow-hidden hover:shadow-xl transition group"
                >
                  {/* Course Header */}
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 text-white">
                    <h3 className="text-xl font-bold group-hover:text-blue-100 transition">{course.title}</h3>
                    <p className="text-blue-100 text-xs mt-1">{course.description || "No description"}</p>
                  </div>

                  {/* Course Info */}
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex items-center justify-between bg-white bg-opacity-60 p-3 rounded-lg">
                      <span className="text-sm font-semibold text-gray-700">👨‍🏫 Teacher</span>
                      <span className="text-sm text-gray-900 font-bold">{course.courseTeacher?.name || "Not Assigned"}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white bg-opacity-60 p-3 rounded-lg">
                      <span className="text-sm font-semibold text-gray-700">👨‍🎓 Students</span>
                      <span className="text-sm text-gray-900 font-bold">{course.students?.length || 0}</span>
                    </div>
                    {course.category && (
                      <div className="flex items-center justify-between bg-white bg-opacity-60 p-3 rounded-lg">
                        <span className="text-sm font-semibold text-gray-700">📂 Category</span>
                        <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold">{course.category}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-blue-100 space-y-2">
                    <button
                      onClick={() => navigate(`/mentor/course/${course._id}`)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-md transition font-semibold text-sm"
                    >
                      📖 Course Portal
                    </button>
                    <button
                      onClick={() => navigate(`/mentor/course/${course._id}/manage`)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:shadow-md transition font-semibold text-sm"
                    >
                      ⚙️ Manage Course
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students Section */}
        <div className="bg-white rounded-xl shadow-md p-8 border-t-4 border-green-500">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1">👥 Class Students</h2>
              <p className="text-gray-600 text-sm">Total: <span className="font-bold text-green-600">{students.length}</span> students assigned</p>
            </div>
            <button
              data-tour="classroom-assign-students-btn"
              onClick={() => setShowAssignStudentsModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-md transition flex items-center gap-2 font-semibold"
            >
              <Plus size={20} /> Assign Students
            </button>
          </div>
          
          {students.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Users className="text-green-600" size={40} />
              </div>
              <p className="text-gray-700 text-lg font-bold">No Students Assigned</p>
              <p className="text-gray-500 text-sm mt-2">Add students to this classroom to get started</p>
              <button
                onClick={() => setShowAssignStudentsModal(true)}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition font-medium"
              >
                Assign First Student
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">No.</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Student Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Email</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Roll Number</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr
                      key={student._id}
                      className="border-b border-gray-100 hover:bg-green-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-bold text-gray-700 bg-gray-50 rounded-l">{index + 1}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">{student.rollNumber || "—"}</td>
                      <td className="px-6 py-4 text-center rounded-r">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => navigate(`/student/portal/${student._id}`)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 transition font-semibold border border-blue-300"
                            title="View Student Portal"
                          >
                            👁️ {t('portal')}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`${t('remove')} ${student.name} ${t('from_classroom')}?`)) {
                                toast.info(t('student_removal_coming_soon'));
                              }
                            }}
                            className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 transition font-semibold border border-red-300"
                            title="Remove Student"
                          >
                            ✕ Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div data-tour="classroom-create-course-form" className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b-2 border-blue-100 bg-gradient-to-r from-blue-500 to-indigo-600">
              <h2 className="text-2xl font-bold text-white">📖 Create New Course</h2>
              <button
                onClick={() => setShowCreateCourseModal(false)}
                className="text-white hover:text-blue-100 hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, title: e.target.value })
                  }
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition"
                  placeholder="Enter course title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) =>
                    setCourseForm({
                      ...courseForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition"
                  rows="3"
                  placeholder="Describe your course"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Category
                </label>
                <input
                  type="text"
                  value={courseForm.category}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, category: e.target.value })
                  }
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition"
                  placeholder="e.g., Mathematics, Science"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Duration
                </label>
                <input
                  type="text"
                  value={courseForm.duration}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, duration: e.target.value })
                  }
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 hover:bg-white transition"
                  placeholder="e.g., 3 months"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  Course Teacher <span className="text-red-500">*</span>
                </label>
                <select
                  value={courseForm.courseTeacherId}
                  onChange={(e) =>
                    setCourseForm({
                      ...courseForm,
                      courseTeacherId: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a mentor</option>
                  {mentors && mentors.length > 0 ? (
                    mentors.map((mentor) => (
                      <option key={mentor._id} value={mentor._id}>
                        {mentor.name} ({mentor.email})
                      </option>
                    ))
                  ) : (
                    <option disabled>No mentors available</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Assign Students
                </label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {students.length > 0 ? (
                    students.map((student) => (
                      <label key={student._id} className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          name="studentIds"
                          value={student._id}
                          onChange={(e) => {
                            const studentIds = courseForm.studentIds;
                            if (e.target.checked) {
                              setCourseForm({
                                ...courseForm,
                                studentIds: [...studentIds, student._id],
                              });
                            } else {
                              setCourseForm({
                                ...courseForm,
                                studentIds: studentIds.filter(
                                  (id) => id !== student._id
                                ),
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{student.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No students available</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg hover:shadow-lg font-bold transition"
                >
                  Create Course
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-bold transition border border-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Students Modal */}
      {showAssignStudentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div data-tour="classroom-assign-form" className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b-2 border-green-100 bg-gradient-to-r from-green-500 to-emerald-600">
              <h2 className="text-2xl font-bold text-white">👥 Assign Students</h2>
              <button
                onClick={() => setShowAssignStudentsModal(false)}
                className="text-white hover:text-green-100 hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAssignStudents} className="p-6 space-y-4">
              <div className="border-2 border-gray-200 rounded-lg p-4 max-h-72 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100">
                {allStudents.length > 0 ? (
                  <div className="space-y-2">
                    {allStudents.map((student) => (
                      <label key={student._id} className="flex items-center p-3 hover:bg-green-50 rounded-lg transition cursor-pointer border border-transparent hover:border-green-300 bg-white hover:shadow-md">
                        <input
                          type="checkbox"
                          name="studentIds"
                          value={student._id}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                        />
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-gray-200 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                      <Users className="text-gray-400" size={24} />
                    </div>
                    <p className="text-sm text-gray-600 font-medium">No students available</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:shadow-lg font-bold transition"
                >
                  Assign Students
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignStudentsModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 font-bold transition border border-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MentorLayout>
  );
};

export default ClassroomDetail;
