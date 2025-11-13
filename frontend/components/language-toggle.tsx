"use client"

import { Languages } from "lucide-react"
import { ButtonGroup } from "@/components/ui/button-group"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useI18n, I18nContextType } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n() as I18nContextType
  const mounted = useMounted()

  return (
    <ButtonGroup className="w-full">
      <Button
        variant={locale === "vi" ? "default" : "outline"}
        onClick={() => setLocale("vi")}
        className="w-1/2"
      >
        {t('nav.vietnamese')}
      </Button>
      <Button
        variant={locale === "en" ? "default" : "outline"}
        onClick={() => setLocale("en")}
        className="w-1/2"
      >
        {t('nav.english')}
      </Button>
    </ButtonGroup>
  )
}
