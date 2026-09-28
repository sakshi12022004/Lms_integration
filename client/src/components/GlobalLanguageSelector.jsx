import React from 'react';
import { useSimpleTranslation } from '../context/SimpleTranslationContext';

const GlobalLanguageSelector = ({ className = '', compact = false }) => {
  const { currentLanguage, supportedLanguages, changeLanguage } = useSimpleTranslation();

  const languages = Object.entries(supportedLanguages).map(([code, lang]) => ({
    code,
    name: lang.name,
    flag: lang.code === 'en' ? '🇺🇸' : 
           lang.code === 'ar' ? '🇸🇦' : '🌐'
  }));

  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  if (compact) {
    return (
      <button
        onClick={() => changeLanguage(currentLanguage === 'en' ? 'ar' : 'en')}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ${className}`}
        title={`Switch to ${currentLanguage === 'en' ? 'Arabic' : 'English'}`}
      >
        <span className="text-xl">{currentLang.flag}</span>
        <span className="text-sm font-medium text-white/80">{currentLang.name}</span>
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
        <span className="text-xl">{currentLang.flag}</span>
        <span className="text-sm font-medium text-white/80">{currentLang.name}</span>
      </div>
    </div>
  );
};

export default GlobalLanguageSelector;
