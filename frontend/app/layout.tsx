import type React from "react";
import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/lib/app-providers";
import { AppLayout } from "@/components/app-layout";
import {DogClickEffect} from "@/components/paw-click"
import {
  Geist,
  Geist_Mono,
  Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans,
  IBM_Plex_Mono as V0_Font_IBM_Plex_Mono,
  Lora as V0_Font_Lora,
} from "next/font/google";
import WalkingDog from "@/components/walking-dog";
// Initialize fonts
const plusJakartaSans = V0_Font_Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-geist-sans", // Sử dụng lại biến CSS cũ để không cần sửa file CSS
});
const _ibmPlexMono = V0_Font_IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});
const _lora = V0_Font_Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    // Cung cấp các icon khác nhau cho theme sáng và tối
    icon: [
      // Icon cho theme sáng (nền trắng)
      { url: "/LogoWebBlack.png", media: "(prefers-color-scheme: light)" },
      // Icon cho theme tối (nền đen)
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
        className="antialiased"
        // className="antialiased select-none"
        suppressHydrationWarning={true}
        style={{ "--navbar-height": "69px" } as React.CSSProperties}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppProviders>
            <DogClickEffect />
            <AppLayout>{children}</AppLayout>
          </AppProviders>
          <WalkingDog />
        </ThemeProvider>
      </body>
    </html>
  );
}
