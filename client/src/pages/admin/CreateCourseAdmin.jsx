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
  const [searchStudent, setSearchStudent] = useState("");
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

  const filteredStudents = students.filter(student => 
    student.name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchStudent.toLowerCase())
  );

  if (fetching) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin h-12 w-12 border-t-2 border-b-2 border-[#B99652] rounded-none"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-[#ebdcaa] pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">
              {t('create_course_title')}
            </h1>
            <p className="text-gray-600 text-sm mt-1">{t('assign_mentor_students')}</p>
          </div>
          <button 
            onClick={() => navigate('/admin/dashboard')} 
            className="flex items-center gap-2 px-4 py-2 border border-[#ebdcaa] bg-white text-[#1e1b4b] hover:bg-[#ebdcaa]/20 rounded-none text-sm font-medium transition-all"
          >
            <ArrowLeft size={16} /> {t('back')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Course Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#fffdf4] p-6 rounded-none border border-[#ebdcaa] shadow-sm">
              <h2 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 pb-2 border-b border-[#ebdcaa] flex items-center gap-2">
                <BookOpen size={20} className="text-[#B99652]" />
                {t('course_details')}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('course_title_label')}</label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-[#ebdcaa] rounded-none px-4 py-2.5 text-sm focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] outline-none"
                    placeholder={t('course_title_placeholder')}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('category_label')}</label>
                    <input
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-[#ebdcaa] rounded-none px-4 py-2.5 text-sm focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] outline-none"
                      placeholder={t('category_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('duration_label')}</label>
                    <input
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      className="w-full bg-white border border-[#ebdcaa] rounded-none px-4 py-2.5 text-sm focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] outline-none"
                      placeholder={t('duration_placeholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('description_label')}</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="4"
                    className="w-full bg-white border border-[#ebdcaa] rounded-none px-4 py-2.5 text-sm focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] outline-none resize-none"
                    placeholder={t('description_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('course_cover_image')}</label>
                  <div className="border-2 border-dashed border-[#ebdcaa] rounded-none p-6 text-center hover:bg-[#ebdcaa]/10 transition-colors cursor-pointer relative bg-white">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {photo ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-700">
                        <Check size={20} />
                        <span className="font-semibold text-sm">{photo.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-gray-500">
                        <Upload size={24} className="mb-2 text-[#B99652]" />
                        <span className="text-sm font-medium">{t('click_to_upload_image')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* MENTOR SELECTION */}
            <div className="bg-[#fffdf4] p-6 rounded-none border border-[#ebdcaa] shadow-sm">
              <h2 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 pb-2 border-b border-[#ebdcaa] flex items-center gap-2">
                <Users size={20} className="text-[#B99652]" />
                {t('assign_mentor_label')}
              </h2>
              
              <select
                name="mentorId"
                value={formData.mentorId}
                onChange={handleInputChange}
                className="w-full bg-white border border-[#ebdcaa] rounded-none px-4 py-2.5 text-sm focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] outline-none text-[#1e1b4b]"
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
          <div className="bg-[#fffdf4] p-6 rounded-none border border-[#ebdcaa] shadow-sm h-fit">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#ebdcaa]">
              <h2 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] flex items-center gap-2">
                <Users size={20} className="text-[#B99652]" />
                {t('assign_students')}
              </h2>
              <span className="text-xs bg-[#B99652]/20 text-[#1e1b4b] font-bold px-2 py-1 rounded-none border border-[#ebdcaa]">
                {selectedStudents.size} {t('selected')}
              </span>
            </div>

            <div className="mb-4">
              <input 
                type="text" 
                placeholder={t('search_students')} 
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full bg-white border border-[#ebdcaa] rounded-none px-3 py-2 text-sm focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] outline-none"
              />
            </div>

            <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredStudents.length === 0 ? (
                <p className="text-gray-500 text-center py-6 text-sm">{t('no_students_found')}</p>
              ) : (
                filteredStudents.map(student => (
                  <div 
                    key={student._id}
                    onClick={() => toggleStudent(student._id)}
                    className={`p-3 rounded-none border cursor-pointer transition-all flex items-center justify-between ${
                      selectedStudents.has(student._id)
                        ? 'bg-[#B99652]/15 border-[#B99652] text-[#1e1b4b]'
                        : 'bg-white hover:bg-[#ebdcaa]/15 border-[#ebdcaa]'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-sm text-[#1e1b4b]">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                    {selectedStudents.has(student._id) && (
                      <Check size={16} className="text-[#B99652]" />
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
              className="w-full bg-[#B99652] hover:bg-[#a38241] text-white py-3.5 rounded-none font-semibold text-base transition-all disabled:opacity-50 shadow-sm"
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
