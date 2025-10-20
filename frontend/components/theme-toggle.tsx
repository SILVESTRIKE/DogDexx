"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useMounted } from "@/hooks/use-mounted"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/lib/i18n-context"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    // Render a placeholder to avoid hydration mismatch
    return <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
  }

  const isDarkMode = theme === "dark"

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light")
  }

  return (
    <div className="flex items-center gap-2 border p-1 rounded-full bg-muted h-9">
      <Sun className={`h-5 w-5 p-0.5 transition-colors ${!isDarkMode ? 'text-primary' : 'text-muted-foreground'}`} />
      <Switch id="theme-switch" checked={isDarkMode} onCheckedChange={handleThemeChange} />
      <Moon className={`h-5 w-5 p-0.5 transition-colors ${isDarkMode ? 'text-primary' : 'text-muted-foreground'}`} />
    </div>
  )
}
