import { useState } from "react";
import { useAuth } from "../../auth/auth";
import { toast } from "react-toastify";
import { Building2, MapPin, Mail } from "lucide-react";

const CreateUniversityForm = ({ onSuccess }) => {
  const { API, token } = useAuth();
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    country: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Get token directly from localStorage as fallback
      const directToken = localStorage.getItem('token');
      const tokenToUse = token || directToken;
      
      const res = await fetch(`${API}/superadmin/create-university`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("✅ University created successfully!");

      setForm({
        name: "",
        address: "",
        city: "",
        country: "",
        email: "",
        phone: "",
      });

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      toast.error(err.message || "Failed to create university");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#ebdcaa]">
        <div className="w-12 h-12 bg-[#B99652]/10 border border-[#ebdcaa] rounded-none flex items-center justify-center text-[#B99652]">
          <Building2 size={22} />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">Create New Institute</h1>
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-1">Register a new institution under your network</p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-[#fffdf4] rounded-none shadow-sm border border-[#ebdcaa] overflow-hidden">
        <div className="p-8">
          <form onSubmit={handleCreate} className="space-y-6">
            {/* University Information */}
            <div className="mb-6">
              <h3 className="text-lg font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b] mb-4 flex items-center gap-2 pb-2 border-b border-[#ebdcaa]">
                <Building2 className="text-[#B99652]" size={18} />
                Institute Information
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">
                    Institute Name <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B99652]" size={18} />
                    <input
                      name="name"
                      data-tour="input-institute-name"
                      placeholder="e.g., Tech Institute of Engineering"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] transition-all text-[#1e1b4b] placeholder-slate-400 text-sm"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B99652]" size={18} />
                    <input
                      name="address"
                      placeholder="e.g., 123 Main Campus Avenue"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] transition-all text-[#1e1b4b] placeholder-slate-400 text-sm"
                      value={form.address}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">
                    City
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B99652]" size={18} />
                    <input
                      name="city"
                      placeholder="e.g., New Delhi"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] transition-all text-[#1e1b4b] placeholder-slate-400 text-sm"
                      value={form.city}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">
                    Country
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B99652]" size={18} />
                    <input
                      name="country"
                      placeholder="e.g., India"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] transition-all text-[#1e1b4b] placeholder-slate-400 text-sm"
                      value={form.country}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">
                    Official Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B99652]" size={18} />
                    <input
                      name="email"
                      type="email"
                      placeholder="admin@institute.edu"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] transition-all text-[#1e1b4b] placeholder-slate-400 text-sm"
                      value={form.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#1e1b4b]">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#B99652]" size={18} />
                    <input
                      name="phone"
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] focus:ring-1 focus:ring-[#B99652] transition-all text-[#1e1b4b] placeholder-slate-400 text-sm"
                      value={form.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-[#ebdcaa]">
              <button
                type="submit"
                disabled={loading}
                data-tour="btn-submit-institute"
                className="w-full bg-[#B99652] hover:bg-[#a38241] disabled:opacity-50 text-white font-semibold py-3.5 rounded-none uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-none h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Creating Institute...
                  </>
                ) : (
                  <>
                    <Building2 size={16} />
                    Create Institute
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateUniversityForm;
