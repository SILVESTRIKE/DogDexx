"use client"

import { useI18n } from "@/lib/i18n-context"
import { X } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export default function AdBanner() {
  const { t } = useI18n()
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="position-absolute top-0 bg-gradient-to-r from-primary/20 to-primary/10 border-b border-primary/20 py-3 px-4">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {t("ad.banner") || "🎉 Upgrade to Premium and get unlimited detections!"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm font-medium text-primary hover:underline">
            {t("ad.upgrade") || "Upgrade Now"}
          </Link>
          <button onClick={() => setIsVisible(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
