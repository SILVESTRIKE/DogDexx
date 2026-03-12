import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";

import enMessages from "../i18n/messages/en";
import viMessages from "../i18n/messages/vi";

type Locale = "en" | "vi";

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const messages = {
  en: enMessages,
  vi: viMessages,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Load locale from AsyncStorage
    const loadLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem("APP_LOCALE");
        if (savedLocale === "en" || savedLocale === "vi") {
          setLocaleState(savedLocale);
        }
      } catch (e) {
        console.warn("Failed to load locale:", e);
      } finally {
        setIsMounted(true);
      }
    };
    loadLocale();
  }, []);

  if (!isMounted) return null;

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      await AsyncStorage.setItem("APP_LOCALE", newLocale);
    } catch (e) {
      console.warn("Failed to save locale:", e);
    }
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split(".");
    let value: any = messages[locale];

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`[i18n] Missing translation for key: ${key}`);
        return key;
      }
    }

    let result = String(value || key);
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        result = result.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return result;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
