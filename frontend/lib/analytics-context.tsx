"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"

interface AnalyticsContextType {
  trackVisit: () => void
  trackPrediction: () => void
  getVisits: () => number
  getPredictions: () => number
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Initialize analytics if not exists
    if (!localStorage.getItem("dogdex_visits")) {
      localStorage.setItem("dogdex_visits", "0")
    }
    if (!localStorage.getItem("dogdex_predictions")) {
      localStorage.setItem("dogdex_predictions", "0")
    }
  }, [])

  const trackVisit = () => {
    const currentVisits = Number.parseInt(localStorage.getItem("dogdex_visits") || "0")
    localStorage.setItem("dogdex_visits", (currentVisits + 1).toString())
  }

  const trackPrediction = () => {
    const currentPredictions = Number.parseInt(localStorage.getItem("dogdex_predictions") || "0")
    localStorage.setItem("dogdex_predictions", (currentPredictions + 1).toString())
  }

  const getVisits = () => {
    return Number.parseInt(localStorage.getItem("dogdex_visits") || "0")
  }

  const getPredictions = () => {
    return Number.parseInt(localStorage.getItem("dogdex_predictions") || "0")
  }

  return (
    <AnalyticsContext.Provider value={{ trackVisit, trackPrediction, getVisits, getPredictions }}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider")
  }
  return context
}
