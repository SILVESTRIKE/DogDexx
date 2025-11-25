import type React from "react";
import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/lib/app-providers";
import { AppLayout } from "@/components/app-layout";
import { DogClickEffect } from "@/components/paw-click";
import { BackgroundEffects } from "@/components/background-effects";
import WalkingDog from "@/components/walking-dog";
import RecaptchaProvider from "@/components/providers/recaptcha-provider"; 

import {
  Geist_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/LogoWebBlack.png", media: "(prefers-color-scheme: light)" },
      { url: "/LogoWebWhite.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
  title: "DogDex - Dog Breed Encyclopedia",
  description: "Discover and explore dog breeds from around the world",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="antialiased min-h-screen relative"
        suppressHydrationWarning={true}
        style={{ "--navbar-height": "69px" } as React.CSSProperties}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RecaptchaProvider>
            <AppProviders>
              {/* BACKGROUND */}
              <BackgroundEffects />
              
              {/* EFFECTS */}
              <DogClickEffect />
              
              {/* LAYOUT & CONTENT */}
              <AppLayout>
                {children}
              </AppLayout>
              
              {/* DECORATION */}
              <WalkingDog />
            </AppProviders>
          </RecaptchaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}