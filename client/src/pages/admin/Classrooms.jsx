import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import CreateClassroomModal from "./CreateClassroomModal";

const Classrooms = () => {
  const { API, token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);

  // Load classrooms from API
  const loadClassrooms = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/classrooms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Classrooms data:', data);
        
        // Handle both direct array and wrapped response formats
        if (data.success && Array.isArray(data.data)) {
          setClassrooms(data.data);
        } else if (Array.isArray(data)) {
          setClassrooms(data);
        } else {
          console.warn('Unexpected response format:', data);
          setClassrooms([]);
        }
      } else {
        console.error('Failed to load classrooms');
        setClassrooms([]);
      }
    } catch (error) {
      console.error('Error loading classrooms:', error);
      setClassrooms([]);
    } finally {
      setLoading(false);
    }
  };

  // Load classrooms on component mount
  useEffect(() => {
    loadClassrooms();
  }, []);

  const handleCreateClassroom = async (classroomData) => {
    try {
      const response = await fetch(`${API}/classrooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(classroomData)
      });
      
      if (response.ok) {
        toast.success(t('classroom_created_successfully'));
        setOpenModal(false);
        loadClassrooms(); // Reload classrooms
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || t('failed_to_create_classroom'));
      }
    } catch (error) {
      console.error('Create error:', error);
      toast.error(t('failed_to_create_classroom'));
    }
  };

  const handleDeleteClassroom = async (id) => {
    try {
      const response = await fetch(`${API}/classrooms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success(t('classroom_deleted_successfully'));
        loadClassrooms(); // Reload classrooms
      } else {
        toast.error(t('failed_to_delete_classroom'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('failed_to_delete_classroom'));
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t('classrooms')}</h1>
            <p className="text-gray-500">{t('manage_classrooms')}</p>
          </div>

          {/* ✅ ONLY CREATE CLASSROOM */}
          <button
            onClick={() => setOpenModal(true)}
            data-tour="btn-create-classroom"
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg"
          >
            <Plus size={18} />
            {t('create_classroom_button')}
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <p className="text-gray-500 text-center py-8">{t('loading_classrooms')}</p>
        ) : classrooms && classrooms.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('no_classrooms_created')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classrooms && classrooms.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/admin/classrooms/${c.id}`)}
                className="relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                style={{
                  backgroundImage: `url('https://media.giphy.com/media/l2Je66zG6mAAZxgqI/giphy.gif')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  minHeight: '200px'
                }}
              >
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition-all duration-300"></div>
                <div className="relative p-5 text-white h-full flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xl mb-2 animate-fade-in">
                      {c.name} {c.section && `- ${c.section}`}
                    </h3>
                      <p className="text-sm opacity-90">
                      {t('class_teacher')}:
                      <span className="font-medium ml-1">
                        {(typeof c.classTeacher === 'object' ? c.classTeacher?.name : c.classTeacher) || t('not_assigned')}
                      </span>
                    </p>
                  </div>
                  <div className="mt-4 text-sm font-medium">
                    {t('students')}: {c.studentCount || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CREATE CLASSROOM MODAL */}
        <CreateClassroomModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          onSuccess={loadClassrooms}
        />
      </div>
    </AdminLayout>
  );
};

export default Classrooms;
