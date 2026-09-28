import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Globe } from "lucide-react";
import { useTranslation } from "../../context/TranslationContext";
import { useAuth } from "../../auth/auth";

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const { t, currentLanguage, changeLanguage } = useTranslation();
  const { loginUser } = useAuth();

  // Hard-coded superadmin credentials
  const SUPERADMIN_EMAIL = "superadmin@lms.com";
  const SUPERADMIN_PASSWORD = "SuperAdmin@123";

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

      // Check if credentials match hard-coded superadmin
      if (email === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD) {
        // Create a proper JWT-like token with superadmin role
        const mockToken = "superadmin-" + btoa(JSON.stringify({ 
          role: "superadmin", 
          email: SUPERADMIN_EMAIL,
          name: "Super Admin"
        }));
        
        const mockUser = {
          id: "superadmin-id",
          name: "Super Admin",
          email: SUPERADMIN_EMAIL,
          role: "superadmin",
        };

        // Use loginUser to update auth context and localStorage
        loginUser(mockToken, mockUser);

        toast.success("✅ Super Admin logged in successfully!");
        navigate("/superadmin/dashboard");
        return;
      }

      // If not superadmin, try normal login
      const res = await fetch("/api/auth/login", {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900">
      {/* Language Selector */}
      <div className="absolute top-5 right-5 z-50 pointer-events-auto">
        <div className="relative flex items-center gap-2">
          <span className="text-white/70 text-xs font-semibold px-2 py-1 bg-black/40 rounded backdrop-blur-md border border-white/20">
            {currentLanguage.toUpperCase()}
          </span>
          <button
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="bg-black/40 backdrop-blur-md border border-white/20 p-2 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-white/10 transition-all w-10 h-10 pointer-events-auto"
            title="Change Language"
          >
            <Globe size={20} />
          </button>
        </div>

        {/* Language Dropdown */}
        {showLanguageDropdown && (
          <div className="absolute top-16 right-0 z-40 pointer-events-auto bg-black/90 backdrop-blur-md border border-white/20 rounded-lg shadow-xl max-h-64 overflow-y-auto min-w-48">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3 ${
                  currentLanguage === lang.code ? 'bg-white/20 border-l-2 border-l-blue-400' : ''
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="text-white">{lang.name}</span>
                {currentLanguage === lang.code && <span className="ml-auto text-green-400">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">⚙️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Super Admin</h1>
          <p className="text-gray-600">Manage Universities & Users</p>
        </div>

        {/* Credentials Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-700 mb-2 font-semibold">🔐 Default Credentials:</p>
          <p className="text-sm text-gray-800 font-mono">Email: superadmin@lms.com</p>
          <p className="text-sm text-gray-800 font-mono">Pass: SuperAdmin@123</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition"
              placeholder="superadmin@lms.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 transition"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-gray-600 hover:text-gray-900"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>🔒 Secure Super Admin Portal</p>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
