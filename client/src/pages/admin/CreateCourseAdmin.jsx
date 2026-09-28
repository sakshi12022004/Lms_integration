import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../auth/auth';
import { useTranslation } from '../../context/TranslationContext';
import { toast } from 'react-toastify';
import { ArrowLeft, Upload, Users, BookOpen, Check } from 'lucide-react';

const CreateCourseAdmin = () => {
  const navigate = useNavigate();
  const { token, API } = useAuth();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    duration: "",
    mentorId: "",
  });
  const [photo, setPhoto] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setFetching(true);
      // Fetch Mentors
      const mentorsRes = await fetch(`${API}/users/mentors-simple`);
      const mentorsData = await mentorsRes.json();
      
      // Fetch All Users (to filter students)
      const usersRes = await fetch(`${API}/users/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      const studentsData = usersData.filter(u => u.role === 'student');

      if (Array.isArray(mentorsData)) setMentors(mentorsData);
      if (Array.isArray(studentsData)) setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(t('failed_to_load_mentors_students'));
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0]);
    }
  };

  const toggleStudent = (studentId) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.mentorId) {
      toast.error(t('title_and_mentor_required'));
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append("category", formData.category);
      data.append("duration", formData.duration);
      data.append("mentorId", formData.mentorId);
      
      if (photo) {
        data.append("photo", photo);
      }

      // Append selected students
      Array.from(selectedStudents).forEach(id => {
        data.append("studentIds[]", id); // Backend expects array, express handles duplicate keys as array
      });
      // NOTE: If express body parser doesn't handle array automatically, we might need to send JSON. 
      // But uploadImage middleware implies multipart/form-data.
      // Let's ensure backend handles `studentIds` from body. 
      // Typically `multer` parses text fields. If we send multiple keys, it becomes an array.
      
    } catch (error) {
       // ...
    }

    // Changing strategy: Send JSON if no photo, or careful FormData construction.
    // The backend `createCourse` expects `studentIds` in body. 
    // Multer populates `req.body` with text fields.
    // Let's stick to FormData but check how array is sent.
    
    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    if (photo) submitData.append("photo", photo);
    
    // For arrays in FormData for Express/Multer:
    const studentIdsArray = Array.from(selectedStudents);
    studentIdsArray.forEach((id, index) => {
      submitData.append(`studentIds[${index}]`, id);
    });

    try {
      const response = await fetch(`${API}/courses/create-course`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Content-Type is set automatically for FormData
        },
        body: submitData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create course");
      }

      toast.success(t('course_created_successfully'));
      navigate("/admin/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* HEADER */}
          <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{t('create_course_title')}</h1>
            <p className="text-gray-600">{t('assign_mentor_students')}</p>
          </div>
          <button 
            onClick={() => navigate('/admin/dashboard')} 
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft size={18} /> {t('back')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Course Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <BookOpen size={20} className="text-primary" />
                {t('course_details')}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('course_title_label')}</label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder={t('course_title_placeholder')}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('category_label')}</label>
                    <input
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder={t('category_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('duration_label')}</label>
                    <input
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder={t('duration_placeholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('description_label')}</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="4"
                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    placeholder={t('description_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('course_cover_image')}</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {photo ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <Check size={20} />
                        <span className="font-medium">{photo.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-gray-500">
                        <Upload size={24} className="mb-2" />
                        <span>{t('click_to_upload_image')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* MENTOR SELECTION */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users size={20} className="text-primary" />
                {t('assign_mentor_label')}
              </h2>
              
              <select
                name="mentorId"
                value={formData.mentorId}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                required
              >
                <option value="">{t('select_a_mentor')}</option>
                {mentors.map(m => (
                  <option key={m._id} value={m._id}>{m.name} ({m.email})</option>
                ))}
              </select>
            </div>
          </div>

          {/* RIGHT COLUMN: Student Selection */}
          <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users size={20} className="text-primary" />
                {t('assign_students')}
              </h2>
              <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {selectedStudents.size} {t('selected')}
              </span>
            </div>

            <div className="mb-4">
              <input 
                type="text" 
                placeholder={t('search_students')} 
                className="w-full border rounded-lg px-3 py-2 text-sm"
                onChange={(e) => {
                  // Implement local search if needed
                }}
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {students.length === 0 ? (
                <p className="text-gray-500 text-center py-4">{t('no_students_found')}</p>
              ) : (
                students.map(student => (
                  <div 
                    key={student._id}
                    onClick={() => toggleStudent(student._id)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      selectedStudents.has(student._id)
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                    {selectedStudents.has(student._id) && (
                      <Check size={16} className="text-blue-600" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-lg hover:bg-primary/90 transition disabled:opacity-50"
            >
              {loading ? t('creating_course') : t('create_course_assign_students')}
            </button>
          </div>

        </form>
      </div>
    </AdminLayout>
  );
};

export default CreateCourseAdmin;
