"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useI18n } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"

export function ThemeToggle() {
  const { setTheme } = useTheme()
  const { t } = useI18n()
  const mounted = useMounted()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{mounted ? t("theme.toggle") : "Toggle theme"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>{mounted ? t("theme.light") : "Light"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>{mounted ? t("theme.dark") : "Dark"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>{mounted ? t("theme.system") : "System"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
