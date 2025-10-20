import type React from "react"
import type { Metadata } from "next"

import "./globals.css"
import { CollectionProvider } from "@/lib/collection-context"
import { AuthProvider } from "@/lib/auth-context"
import { AnalyticsProvider } from "@/lib/analytics-context"
import { I18nProvider } from "@/lib/i18n-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"
import { AppLayout } from "@/components/app-layout"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

import { Geist, Geist_Mono, Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans, IBM_Plex_Mono as V0_Font_IBM_Plex_Mono, Lora as V0_Font_Lora } from 'next/font/google'

// Initialize fonts
const _plusJakartaSans = V0_Font_Plus_Jakarta_Sans({ subsets: ['latin'], weight: ["200","300","400","500","600","700","800"] })
const _ibmPlexMono = V0_Font_IBM_Plex_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700"] })
const _lora = V0_Font_Lora({ subsets: ['latin'], weight: ["400","500","600","700"] })

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "DogDex - Dog Breed Encyclopedia",
  description: "Discover and explore dog breeds from around the world",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased" style={{ '--navbar-height': '69px' } as React.CSSProperties}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider>
            <AuthProvider>
              <AnalyticsProvider>
                <CollectionProvider>
                  <AppLayout>{children}</AppLayout>
                </CollectionProvider>
              </AnalyticsProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
