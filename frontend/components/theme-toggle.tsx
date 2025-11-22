"use client"

import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { useMounted } from "@/hooks/use-mounted"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) return <div className="h-8 w-full bg-muted/50 animate-pulse rounded-full" />

  return (
    <div className="flex items-center p-1 bg-muted/50 rounded-full border border-border/50 relative">
      {/* Light Mode */}
      <button
        onClick={() => setTheme("light")}
        className={`flex-1 flex items-center justify-center rounded-full text-sm font-medium h-7 transition-all duration-200 ease-in-out ${
          theme === 'light' 
            ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Light</span>
      </button>

      {/* Dark Mode */}
      <button
        onClick={() => setTheme("dark")}
        className={`flex-1 flex items-center justify-center rounded-full text-sm font-medium h-7 transition-all duration-200 ease-in-out ${
          theme === 'dark' 
            ? "bg-background text-foreground shadow-sm ring-1 ring-black/5" 
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon className="h-4 w-4" />
        <span className="sr-only">Dark</span>
      </button>
      
      {/* Nếu muốn thêm nút System thì thêm 1 nút tương tự ở đây */}
    </div>
  )
}