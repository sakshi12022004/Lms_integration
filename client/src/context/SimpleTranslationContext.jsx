import React, { createContext, useContext, useState } from 'react';

const SimpleTranslationContext = createContext();

// Translation dictionary
const translations = {
  en: {
    'login': 'Login',
    'email': 'Email',
    'password': 'Password',
    'forgot_password': 'Forgot password?',
    'remember_me': 'Remember me',
    'sign_in': 'Sign In',
    'dont_have_account': "Don't have an account?",
    'sign_up': 'Sign Up',
    'or_continue_with': 'Or continue with',
    'edumentor_lms': 'EduMentor LMS',
    'your_learning_journey': 'Your Learning Journey Starts Here',
    'welcome_back': 'Welcome back! Please login to your account.',
    'login_to_continue': 'Login to continue to your dashboard',
    'email_placeholder': 'Enter your email',
    'password_placeholder': 'Enter your password',
    'show_password': 'Show password',
    'hide_password': 'Hide password',
    'demo_accounts': 'Quick Login - Demo Accounts:',
    'admin': 'Admin',
    'mentor': 'Mentor',
    'student': 'Student',
    'accountant': 'Accountant',
    'storekeeper': 'Storekeeper',
    'click_to_login': 'Click to Login'
  },
  ar: {
    'login': 'تسجيل الدخول',
    'email': 'البريد الإلكتروني',
    'password': 'كلمة المرور',
    'forgot_password': 'نسيت كلمة المرور؟',
    'remember_me': 'تذكرني',
    'sign_in': 'دخول',
    'dont_have_account': 'ليس لديك حساب؟',
    'sign_up': 'إنشاء حساب',
    'or_continue_with': 'أو تابع مع',
    'edumentor_lms': 'نظام إدارة التعلم',
    'your_learning_journey': 'رحلة التعلم تبدأ هنا',
    'welcome_back': 'مرحباً بعودتك! يرجى تسجيل الدخول إلى حسابك.',
    'login_to_continue': 'سجل الدخول للمتابعة إلى لوحة التحكم',
    'email_placeholder': 'أدخل بريدك الإلكتروني',
    'password_placeholder': 'أدخل كلمة المرور',
    'show_password': 'إظهار كلمة المرور',
    'hide_password': 'إخفاء كلمة المرور',
    'demo_accounts': 'تسجيل دخول سريع - حسابات تجريبية:',
    'admin': 'مدير',
    'mentor': 'مرشد',
    'student': 'طالب',
    'accountant': 'محاسب',
    'storekeeper': 'أمين مستودع',
    'click_to_login': 'اضغط لتسجيل الدخول'
  }
};

export const useSimpleTranslation = () => {
  const context = useContext(SimpleTranslationContext);
  if (!context) {
    return {
      currentLanguage: 'en',
      supportedLanguages: {
        en: { name: 'English', code: 'en', rtl: false },
        ar: { name: 'العربية', code: 'ar', rtl: true }
      },
      isRTL: false,
      changeLanguage: () => {},
      t: (key, fallback) => fallback || key,
      loading: false
    };
  }
  return context;
};

export const SimpleTranslationProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const supportedLanguages = {
    en: { name: 'English', code: 'en', rtl: false },
    ar: { name: 'العربية', code: 'ar', rtl: true }
  };

  // Initialize language from localStorage or browser preference
  useEffect(() => {
    const initializeLanguage = () => {
      try {
        // 1. Check localStorage first
        const savedLanguage = localStorage.getItem('preferred-language');
        
        if (savedLanguage && supportedLanguages[savedLanguage]) {
          setCurrentLanguage(savedLanguage);
          console.log('🌍 Loaded language from localStorage:', savedLanguage);
        } else {
          // 2. Check browser language preference
          const browserLanguage = navigator.language.split('-')[0]; // e.g., 'en' from 'en-US'
          const fallbackLanguage = supportedLanguages[browserLanguage] ? browserLanguage : 'en';
          
          setCurrentLanguage(fallbackLanguage);
          localStorage.setItem('preferred-language', fallbackLanguage);
          console.log('🌍 Detected browser language, set to:', fallbackLanguage);
        }
        
        // 3. Set document direction and language
        const newIsRTL = supportedLanguages[currentLanguage]?.rtl || false;
        document.documentElement.dir = newIsRTL ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLanguage;
        
      } catch (error) {
        console.error('🌍 Error initializing language:', error);
        setCurrentLanguage('en');
      } finally {
        setLoading(false);
      }
    };

    initializeLanguage();
  }, []);

  // Update document direction when language changes
  useEffect(() => {
    const newIsRTL = supportedLanguages[currentLanguage]?.rtl || false;
    document.documentElement.dir = newIsRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;
    console.log('🌍 Updated document direction to:', newIsRTL ? 'rtl' : 'ltr');
  }, [currentLanguage, supportedLanguages]);

  const isRTL = supportedLanguages[currentLanguage]?.rtl || false;

  // Load language preference from database for logged-in user
  const loadUserLanguagePreference = async (email) => {
    try {
      const response = await fetch(`/api/language/user/preference/${email}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.language && data.language !== currentLanguage) {
          setCurrentLanguage(data.language);
          localStorage.setItem('preferred-language', data.language);
          setVersion(prev => prev + 1);
          console.log('✅ Loaded language preference from database:', data.language);
        }
      }
    } catch (error) {
      console.log('⚠️ Error loading language preference from database:', error);
    }
  };

  const changeLanguage = async (languageCode) => {
    console.log('🔄 Changing language from', currentLanguage, 'to', languageCode);
    
    if (supportedLanguages[languageCode]) {
      setCurrentLanguage(languageCode);
      setVersion(prev => prev + 1); // Force re-render
      localStorage.setItem('preferred-language', languageCode);
      
      // Store in user profile if logged in
      try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (userInfo.email) {
          // Save to user profile in database
          const response = await fetch('/api/language/user/preference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userInfo.email,
              language: languageCode
            })
          });
          
          if (response.ok) {
            console.log('✅ Language preference saved to database for user:', userInfo.email);
          } else {
            console.log('⚠️ Failed to save language preference to database');
          }
        } else {
          console.log('🔄 No user logged in, saving only to localStorage');
        }
      } catch (error) {
        console.log('⚠️ Error saving language preference to database:', error);
        console.log('🔄 Language saved only to localStorage');
      }
      
      console.log('✅ Language changed successfully to:', languageCode);
    } else {
      console.error('❌ Unsupported language:', languageCode);
    }
  };

  const t = (key, fallback) => {
    // Try to get translation for current language
    const translation = translations[currentLanguage]?.[key];
    
    // If translation exists, return it
    if (translation) {
      return translation;
    }
    
    // Fallback to English if current language doesn't have translation
    const englishTranslation = translations['en']?.[key];
    
    if (englishTranslation) {
      return englishTranslation;
    }
    
    // Final fallback to the provided fallback or the key itself
    return fallback || key;
  };

  const value = {
    currentLanguage,
    supportedLanguages,
    isRTL,
    changeLanguage,
    loadUserLanguagePreference,
    t,
    version,
    loading
  };

  return (
    <SimpleTranslationContext.Provider value={value}>
      {children}
    </SimpleTranslationContext.Provider>
  );
};

export default SimpleTranslationProvider;
