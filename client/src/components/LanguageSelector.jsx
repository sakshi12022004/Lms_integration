import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from '../context/TranslationContext';

const LanguageSelector = () => {
  const { currentLanguage, changeLanguage } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Ensure document direction matches language on mount
    if (currentLanguage === 'ar' || currentLanguage === 'ur') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = currentLanguage;
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
  }, [currentLanguage]);

  const select = async (lang) => {
    setOpen(false);
    await changeLanguage(lang);
    // also set document direction immediately
    if (lang === 'ar' || lang === 'ur') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = lang;
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
  };

  return (
    <div className="relative">
      <button
        aria-label="Language"
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-full bg-white hover:bg-gray-200 transition"
      >
        <Globe className="w-5 h-5 text-black" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-50">
          <button
            onClick={() => select('en')}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${currentLanguage==='en' ? 'font-semibold' : ''}`}
          >
            English
          </button>
          <button
            onClick={() => select('ar')}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${currentLanguage==='ar' ? 'font-semibold' : ''}`}
          >
            العربية
          </button>
          <button
            onClick={() => select('ur')}
            className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${currentLanguage==='ur' ? 'font-semibold' : ''}`}
          >
            اردو
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
