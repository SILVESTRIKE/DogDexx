"use client"

import { useI18n, I18nContextType } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"

export function LanguageToggle() {
  const { locale, setLocale } = useI18n() as I18nContextType
  const mounted = useMounted()

  if (!mounted) return <div className="h-8 w-full bg-muted/50 animate-pulse rounded-full" />

  return (
    <div className="flex items-center p-1 bg-muted/50 rounded-full border border-border/50">
      <button
        onClick={() => setLocale("vi")}
        className={`flex-1 flex items-center justify-center rounded-full text-xs font-bold h-7 transition-all duration-200 ease-in-out ${
          locale === 'vi' 
            ? "bg-background text-primary shadow-sm ring-1 ring-black/5" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        VI
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`flex-1 flex items-center justify-center rounded-full text-xs font-bold h-7 transition-all duration-200 ease-in-out ${
          locale === 'en' 
            ? "bg-background text-primary shadow-sm ring-1 ring-black/5" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  )
}