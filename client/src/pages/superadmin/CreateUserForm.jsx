import { useState, useEffect } from "react";
import { useTranslation } from "../../context/TranslationContext";
import { useAuth } from "../../auth/auth";
import QuotaLimitModal from "../../components/QuotaLimitModal";
import { toast } from "react-toastify";
import { UserPlus, User, Mail, Building2, Key, Copy, Shield } from "lucide-react";

const ROLES = ["admin", "accountant", "storekeeper"];

const CreateUserForm = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { API, token } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "admin",
    universityId: "",
  });

  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaDetails, setQuotaDetails] = useState(null);

  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        const res = await fetch(`${API}/superadmin/universities`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data && data.data) setUniversities(data.data);
      } catch (err) {
        console.error("Failed to load universities", err);
      }
    };

    fetchUniversities();
  }, [API, token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.role || !form.universityId) {
      toast.error("All fields are required");
      return;
    }

    // Check subscription for accountant and storekeeper roles
    if (form.role === "accountant" || form.role === "storekeeper") {
      try {
        const res = await fetch(`${API}/api/subscriptions/check-feature-access`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Feature check failed');
        const data = await res.json();

        // Block if on free plan
        if (data.currentPlan === 'free') {
          setQuotaDetails({
            type: 'feature',
            resourceType: form.role + ' creation',
            message: 'Your account is on the Free plan — upgrade to create ' + form.role + ' accounts.'
          });
          setShowQuotaModal(true);
          return;
        }
      } catch (err) {
        console.error('Feature check error', err);
        setQuotaDetails({
          type: 'feature',
          resourceType: form.role + ' creation',
          message: 'Your account is on the Free plan — upgrade to create ' + form.role + ' accounts.'
        });
        setShowQuotaModal(true);
        return;
      }
    }

    try {
      setLoading(true);

      const password = generatePassword();

      const res = await fetch(`${API}/superadmin/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create user");

      // Call success callback with credentials
      onSuccess({
        name: form.name,
        email: form.email,
        password: password,
        role: form.role,
      });

      setForm({
        name: "",
        email: "",
        role: "admin",
        universityId: "",
      });
      setGeneratedPassword(null);
    } catch (err) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <UserPlus className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">👥 Create New Staff Member</h1>
            <p className="text-gray-600">Add a new team member to your educational empire</p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-8">
          <form onSubmit={handleCreate} className="space-y-6">
            {/* User Information */}
            <div data-tour="staff-user-info" className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="text-purple-600" size={20} />
                User Information
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      name="name"
                      placeholder="e.g., John Doe"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      name="email"
                      type="email"
                      placeholder="user@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Role & Assignment */}
            <div data-tour="staff-role-assignment">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="text-blue-600" size={20} />
                Role & Assignment
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    User Role <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <select
                      name="role"
                      data-tour="select-staff-role"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 appearance-none bg-white"
                      value={form.role}
                      onChange={handleChange}
                      required
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    University <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <select
                      name="universityId"
                      data-tour="select-staff-university"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 appearance-none bg-white"
                      value={form.universityId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select University</option>
                      {universities.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                data-tour="btn-submit-staff"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating Staff Member...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    Create Staff Member
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Key className="text-white" size={18} />
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">🔐 Password Information</h4>
            <p className="text-gray-600 text-sm leading-relaxed">
              A strong random password will be automatically generated and displayed once. The staff member will need to save this password securely for their first login. They can change it later from their profile settings.
            </p>
          </div>
        </div>
      </div>

      {/* Quota Limit Modal */}
      {showQuotaModal && (
        <QuotaLimitModal
          details={quotaDetails}
          onClose={() => setShowQuotaModal(false)}
        />
      )}
    </div>
  );
};

export default CreateUserForm;
