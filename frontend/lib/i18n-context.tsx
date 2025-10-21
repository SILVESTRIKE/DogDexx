"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getMessages } from './i18n-config';

type Locale = "en" | "vi"

export interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, replacements?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

import enMessages from "@/i18n/messages/en"
import viMessages from "@/i18n/messages/vi"

const messages = {
  en: enMessages,
  vi: viMessages,
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi")
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Load locale from cookie
    const savedLocale = document.cookie
      .split("; ")
      .find((row) => row.startsWith("NEXT_LOCALE="))
      ?.split("=")[1] as Locale | undefined

    if (savedLocale && (savedLocale === "en" || savedLocale === "vi")) {
      setLocaleState(savedLocale)
    }
    setIsMounted(true);
  }, [])

  // Trì hoãn việc render children cho đến khi client đã xác định được locale từ cookie.
  // Điều này đảm bảo không có sự không khớp hydration.
  // Server sẽ luôn render null, và client cũng sẽ render null ở lần đầu tiên.
  if (!isMounted) return null;

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    // Save to cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
  }

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split(".")
    let value: any = messages[locale]

    for (const k of keys) {
      value = value?.[k]
      if (value === undefined) {
        console.warn(`[i18n] Missing translation for key: ${key}`);
        return key
      }
    }
    
    let result = String(value || key);
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        result = result.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return result;
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return context
}
