import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { Camera } from "lucide-react";
import { useAuth } from "../../auth/auth";
import { useTranslation } from "../../context/TranslationContext";
import { toast } from "react-toastify";

const AddTeacher = () => {
  const { token, API } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    joiningDate: "",
    qualification: "",
    subject: "",
    address: "",
    bloodGroup: "",
    dob: "",
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

  /* ================= SAVE TEACHER ================= */
  const handleSaveTeacher = async () => {
    if (!form.fullName || !form.email) {
      return toast.error(t('name_and_email_required'));
    }

    try {
      setLoading(true);

      const res = await fetch(`${API}/admin/create-teacher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.fullName,
          email: form.email,
          phone: form.phone,
          joiningDate: form.joiningDate,
          qualification: form.qualification,
          subject: form.subject,
          address: form.address,
          bloodGroup: form.bloodGroup,
          dob: form.dob,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        return toast.error(data.message || t('failed_to_create_teacher'));
      }

      toast.success(
        `${t('teacher_created_successfully')} 🎉 ${t('temporary_password')}: ${data.generatedPassword}`,
        { autoClose: false }
      );

      // reset form
      setForm({
        fullName: "",
        email: "",
        phone: "",
        joiningDate: "",
        qualification: "",
        subject: "",
        address: "",
        bloodGroup: "",
        dob: "",
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
          <h1 className="text-2xl font-bold">{t('add_teacher_title')}</h1>
          <p className="text-gray-500">{t('teacher_details')}</p>
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
                      alt="Teacher"
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
              <p className="text-gray-500 text-sm">{t('teacher')}</p>

              <button
                onClick={handleSaveTeacher}
                disabled={loading}
                data-tour="btn-save-teacher"
                className="mt-4 w-full bg-primary text-white py-2 rounded-lg"
              >
                {loading ? t('saving') : t('save_teacher')}
              </button>
            </div>
          </div>

          {/* ================= RIGHT FORM ================= */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4">{t('personal_information')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input data-tour="input-teacher-name" label={t('full_name')} name="fullName" value={form.fullName} onChange={handleChange} />
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
              <h3 className="font-semibold mb-4">{t('professional_information')}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('qualification')} name="qualification" value={form.qualification} onChange={handleChange} />
                <Input label={t('subject_expertise')} name="subject" value={form.subject} onChange={handleChange} />
                <Input label={t('joining_date')} type="date" name="joiningDate" value={form.joiningDate} onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AddTeacher;

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
