"use client"

import { createContext, useContext, type ReactNode, useCallback } from "react"
import { apiClient } from "./api-client"

interface AnalyticsContextType {
  trackVisit: (page: string) => void
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const trackVisit = useCallback((page: string) => {
    // Đây là một "fire-and-forget" call, chúng ta không cần đợi nó hoàn thành
    apiClient.trackVisit(page).catch((error: Error) => {
      console.warn("[Analytics] Failed to track visit:", error.message)
    })
  }, [])

  const value = { trackVisit }
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider")
  }
  return context
}
