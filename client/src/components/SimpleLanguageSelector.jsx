import React, { useState } from 'react';
import { useSimpleTranslation } from '../context/SimpleTranslationContext';

const SimpleLanguageSelector = ({ 
  showFlag = true, 
  compact = false,
  className = '' 
}) => {
  const { currentLanguage = 'en', supportedLanguages = {}, changeLanguage, loading } = useSimpleTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Show loading state while context is initializing
  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center space-x-2 px-3 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-white">Loading...</span>
        </div>
      </div>
    );
  }

  // Fallback languages if context isn't ready
  const fallbackLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];

  const languages = Object.keys(supportedLanguages).length > 0 
    ? Object.entries(supportedLanguages).map(([code, lang]) => ({
        code,
        name: lang.name,
        flag: lang.code === 'en' ? '🇺🇸' : 
               lang.code === 'ar' ? '🇸🇦' : '🌐'
      }))
    : fallbackLanguages;

  const handleLanguageSelect = (languageCode) => {
    setIsOpen(false);
    if (changeLanguage) {
      changeLanguage(languageCode);
    } else {
      // Fallback if changeLanguage isn't available
      localStorage.setItem('preferred-language', languageCode);
      window.location.reload();
    }
  };

  const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <select
          value={currentLanguage}
          onChange={(e) => handleLanguageSelect(e.target.value)}
          className="appearance-none bg-white/10 backdrop-blur-xl border border-white/20 rounded-md px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {showFlag ? `${lang.flag} ` : ''}{lang.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {showFlag && <span className="text-lg">{currentLang.flag}</span>}
        <span className="text-sm font-medium text-white">
          {currentLang.name}
        </span>
        <svg 
          className={`w-4 h-4 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
            <div className="py-1">
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    lang.code === selectedLanguage 
                      ? 'bg-orange-50 text-[#F05A36]' 
                      : 'text-gray-700'
                  }`}
                >
                  {showFlag && <span className="text-lg">{lang.flag}</span>}
                  <span className="font-medium">{lang.name}</span>
                  {lang.code === selectedLanguage && (
                    <svg className="w-4 h-4 ml-auto text-[#F05A36]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SimpleLanguageSelector;
