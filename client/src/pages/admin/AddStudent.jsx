import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { Camera } from "lucide-react";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";

const AddStudent = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    fullName: "",
    parentName: "",
    email: "",
    phone: "",
    bloodGroup: "",
    address: "",
    admissionDate: "",
    dob: "",
    className: "",
    section: "",
  });

  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    if (e.target.files[0]) {
      setPhoto(URL.createObjectURL(e.target.files[0]));
    }
  };

  /* ================= SAVE STUDENT ================= */
  const handleSaveStudent = async () => {
    if (!form.fullName || !form.email) {
      return toast.error(t('name_and_email_required'));
    }

    try {
      setLoading(true);

      const res = await fetch(`${API}/admin/create-student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        return toast.error(data.message || t('failed_to_create_student'));
      }

      // ✅ FIXED: correct password key
      toast.success(
        `${t('student_created_successfully')}\n${t('login_password')}: ${data.student.password}`,
        { autoClose: false }
      );

      // reset form
      setForm({
        fullName: "",
        parentName: "",
        email: "",
        phone: "",
        bloodGroup: "",
        address: "",
        admissionDate: "",
        dob: "",
        className: "",
        section: "",
      });
      setPhoto(null);
    } catch (err) {
      toast.error(t('server_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* ===== PAGE TITLE ===== */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('add_student')}</h1>
          <p className="text-gray-500">{t('student_details')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ================= LEFT PROFILE CARD ================= */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  {photo ? (
                    <img
                      src={photo}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">{t('no_photo')}</span>
                  )}
                </div>

                <label className="absolute bottom-1 right-1 bg-primary text-white p-2 rounded-full cursor-pointer">
                  <Camera size={16} />
                  <input type="file" hidden onChange={handlePhotoChange} />
                </label>
              </div>

              <h2 className="mt-4 font-semibold text-lg">
                {form.fullName || t('full_name')}
              </h2>
              <p className="text-gray-500 text-sm">{t('student_role')}</p>

              <button
                onClick={handleSaveStudent}
                disabled={loading}
                data-tour="btn-save-student"
                className="mt-4 w-full bg-primary text-white py-2 rounded-lg"
              >
                {loading ? t('saving') : t('save_student')}
              </button>
            </div>
          </div>

          {/* ================= RIGHT FORM ================= */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4">{t('personal_information')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input data-tour="input-student-name" label={t('full_name')} name="fullName" value={form.fullName} onChange={handleChange} />
                <Input label={t('parent_name')} name="parentName" value={form.parentName} onChange={handleChange} />
                <Input label={t('email_address')} name="email" value={form.email} onChange={handleChange} />
                <Input label={t('phone')} name="phone" value={form.phone} onChange={handleChange} />
                <Input label={t('blood_group')} name="bloodGroup" value={form.bloodGroup} onChange={handleChange} />
                <Input label={t('date_of_birth')} type="date" name="dob" value={form.dob} onChange={handleChange} />
              </div>

              <div className="mt-4">
                <Input label={t('address')} name="address" value={form.address} onChange={handleChange} />
              </div>
            </div>

            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4">{t('academic_information')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('class')} name="className" value={form.className} onChange={handleChange} />
                <Input label={t('section')} name="section" value={form.section} onChange={handleChange} />
                <Input label={t('admission_date')} type="date" name="admissionDate" value={form.admissionDate} onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AddStudent;

/* ================= INPUT ================= */
const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    <input
      {...props}
      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
    />
  </div>
);
