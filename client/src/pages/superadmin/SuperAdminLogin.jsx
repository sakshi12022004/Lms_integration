import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Globe } from "lucide-react";
import { useTranslation } from "../../context/TranslationContext";
import { useAuth } from "../../auth/auth";

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const { t, currentLanguage, changeLanguage } = useTranslation();
  const { loginUser, API } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const languages = [
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "it", name: "Italiano", flag: "🇮🇹" },
    { code: "pt", name: "Português", flag: "🇵🇹" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "ja", name: "日本語", flag: "🇯🇵" },
    { code: "ko", name: "한국어", flag: "🇰🇷" },
    { code: "zh", name: "中文", flag: "🇨🇳" },
    { code: "hi", name: "हिंदी", flag: "🇮🇳" },
    { code: "ar", name: "العربية", flag: "🇸🇦" },
  ];

  const handleLanguageChange = async (langCode) => {
    setShowLanguageDropdown(false);
    await changeLanguage(langCode);
    const langName = languages.find(l => l.code === langCode)?.name || langCode;
    toast.success(`${t('language_changed')} ${langName}`);
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      // The server checks the password and signs the session; nothing is decided in the browser.
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      if (data.user.role !== "superadmin") {
        toast.error("❌ Access denied - Superadmin only");
        return;
      }

      // Use loginUser to update auth context and localStorage
      loginUser(data.token, data.user);

      toast.success("Super Admin logged in");
      navigate("/superadmin/dashboard");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1b4b] p-6 relative">
      {/* Language Selector */}
      <div className="absolute top-5 right-5 z-50 pointer-events-auto">
        <div className="relative flex items-center gap-2">
          <span className="text-white/70 text-xs font-semibold px-2 py-1 bg-white/10 rounded-none border border-white/20">
            {currentLanguage.toUpperCase()}
          </span>
          <button
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="bg-white/10 border border-white/20 p-2 rounded-none flex items-center justify-center text-white cursor-pointer hover:bg-white/20 transition-all w-9 h-9 pointer-events-auto"
            title="Change Language"
          >
            <Globe size={18} />
          </button>
        </div>

        {/* Language Dropdown */}
        {showLanguageDropdown && (
          <div className="absolute top-12 right-0 z-40 pointer-events-auto bg-[#1e1b4b] border border-[#ebdcaa] rounded-none shadow-xl max-h-64 overflow-y-auto min-w-48">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-4 py-2.5 hover:bg-white/10 transition-colors flex items-center gap-3 text-xs ${
                  currentLanguage === lang.code ? 'bg-[#B99652]/20 border-l-2 border-l-[#B99652]' : ''
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="text-white">{lang.name}</span>
                {currentLanguage === lang.code && <span className="ml-auto text-[#B99652]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#fffdf4] rounded-none border border-[#ebdcaa] p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#B99652]/10 text-[#B99652] border border-[#ebdcaa] rounded-none mx-auto mb-3 flex items-center justify-center">
            <span className="text-2xl font-bold font-['DM_Serif_Display',serif]">SA</span>
          </div>
          <h1 className="text-3xl font-bold font-['DM_Serif_Display',serif] text-[#1e1b4b]">Super Admin</h1>
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mt-1">Multi-University & Institutional Control</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-slate-700">Email Address</label>
            <input
              type="email"
              className="w-full px-3.5 py-2.5 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] transition text-sm text-[#1e1b4b]"
              placeholder="superadmin@lms.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs uppercase tracking-wider font-semibold text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-3.5 py-2.5 bg-white border border-[#ebdcaa] rounded-none focus:outline-none focus:border-[#B99652] transition text-sm text-[#1e1b4b]"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#B99652] hover:bg-[#a38241] text-white text-xs font-semibold uppercase tracking-wider py-3 rounded-none transition-colors disabled:opacity-50 shadow-sm mt-2"
          >
            {loading ? "Logging in..." : "Login to Super Admin"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#ebdcaa] text-center text-[11px] uppercase tracking-wider text-slate-400">
          <p>Secure Institutional Gateway</p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
