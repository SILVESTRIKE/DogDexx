"use client"

import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useI18n, I18nContextType } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n() as I18nContextType
  const mounted = useMounted()

  if (!mounted) {
    return <Button variant="outline" size="icon" className="h-9 w-9 bg-muted animate-pulse rounded-full" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("language.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale("vi")} className={locale === "vi" ? "bg-accent" : ""}>
          {t('nav.vietnamese')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale("en")} className={locale === "en" ? "bg-accent" : ""}>
          {t('nav.english')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
