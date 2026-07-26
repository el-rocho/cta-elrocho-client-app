import React, { createContext, useContext } from 'react';
import type { LanguageOption } from '../types/bloodPressure';
import { getTranslation } from './translations';

interface LanguageContextProps {
  language: LanguageOption;
  setLanguage?: (lang: LanguageOption) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextProps>({
  language: 'es',
  t: (path, params) => getTranslation('es', path, params),
});

interface LanguageProviderProps {
  language: LanguageOption;
  onLanguageChange?: (lang: LanguageOption) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language,
  onLanguageChange,
  children,
}) => {
  const t = (path: string, params?: Record<string, string | number>) =>
    getTranslation(language, path, params);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: onLanguageChange, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
