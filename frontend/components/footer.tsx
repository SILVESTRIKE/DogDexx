"use client"

import { useI18n } from "@/lib/i18n-context"
import { Mail, MapPin, Phone, Facebook, Twitter, Instagram, Github, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Footer() {
  const { t } = useI18n()

  return (
    <footer className="relative border-t bg-background/40 backdrop-blur-lg overflow-hidden">
      {/* 1. BACKGROUND GLOW EFFECTS (Đồng bộ với theme) */}
      <div className="pointer-events-none absolute inset-0 z-0">
         {/* Top Gradient Line */}
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
         {/* Bottom Glow */}
         <div className="absolute bottom-[-200px] left-[-100px] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
         <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-16">
        {/* Footer Content Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          
          {/* Column 1: Company */}
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
              {t("footer.company") || "Company"}
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {["About Us", "Blog", "Careers", "Press"].map((item) => (
                <li key={item}>
                  <Link href="/" className="hover:text-primary hover:translate-x-1 transition-all duration-200 inline-flex items-center gap-1">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-lg text-foreground">
               {t("footer.product") || "Product"}
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/dogdex" className="hover:text-primary hover:translate-x-1 transition-all duration-200 block">
                  {t("footer.dogdex") || "DogDex"}
                </Link>
              </li>
              <li>
                <Link href="/live" className="hover:text-primary hover:translate-x-1 transition-all duration-200 block">
                  {t("footer.liveDetection") || "Live Detection"}
                  <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">BETA</span>
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-primary hover:translate-x-1 transition-all duration-200 block">
                  {t("footer.pricing") || "Pricing"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-primary hover:translate-x-1 transition-all duration-200 block">
                  {t("footer.documentation") || "Documentation"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-lg text-foreground">
                {t("footer.support") || "Support"}
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {["Help Center", "Contact Us", "FAQ", "Status"].map((item) => (
                <li key={item}>
                  <Link href="/" className="hover:text-primary hover:translate-x-1 transition-all duration-200 block">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div className="flex flex-col gap-4">
            <h4 className="font-bold text-lg text-foreground">{t("footer.contact") || "Contact"}</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3 group">
                <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Mail className="h-4 w-4" />
                </div>
                <a href="mailto:ctytest8@gmail.com" className="hover:text-primary transition-colors mt-1">
                  ctytest8@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3 group">
                <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Phone className="h-4 w-4" />
                </div>
                <a href="tel:+84867174256" className="hover:text-primary transition-colors mt-1">
                  +84 867 174 256
                </a>
              </li>
              <li className="flex items-start gap-3 group">
                <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <MapPin className="h-4 w-4" />
                </div>
                <span className="mt-1">Ho Chi Minh city, Vietnam</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section: Brand, Socials, Copyright */}
        <div className="border-t border-border/40 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* Brand & Copyright */}
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <Link href="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                <img src="/LogoWebBlack.png" alt="DogDex" className="w-6 h-auto dark:hidden" />
                <img src="/LogoWebWhite.png" alt="DogDex" className="w-6 h-auto hidden dark:block" />
                <span className="font-bold text-lg">DogDex</span>
            </Link>
            <span className="hidden md:inline text-muted-foreground/30">|</span>
            <p className="text-sm text-muted-foreground">
              {t("footer.copyright") || "© 2025 DogDex. All rights reserved."}
            </p>
          </div>

          {/* Social Links (Modern Circles) */}
          <div className="flex gap-3">
            {[
                { icon: Facebook, href: "https://www.facebook.com/hukudevon" },
                { icon: Twitter, href: "#" },
                { icon: Instagram, href: "https://www.instagram.com/hukudevon" },
                { icon: Github, href: "https://github.com/SILVESTRIKE" }
            ].map((social, idx) => (
                <a 
                    key={idx}
                    href={social.href} 
                    className="p-2 rounded-full bg-secondary/50 text-muted-foreground hover:bg-primary hover:text-white hover:-translate-y-1 transition-all duration-300 shadow-sm"
                >
                    <social.icon className="h-4 w-4" />
                </a>
            ))}
          </div>

          {/* Legal Links */}
          <div className="flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              {t("footer.privacy") || "Privacy"}
            </Link>
            <Link href="/" className="hover:text-primary transition-colors">
              {t("footer.terms") || "Terms"}
            </Link>
            <Link href="/" className="hover:text-primary transition-colors">
              {t("footer.cookies") || "Cookies"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}