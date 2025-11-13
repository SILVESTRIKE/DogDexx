"use client"

import { useI18n } from "@/lib/i18n-context"
import { Mail, MapPin, Phone, Facebook, Twitter, Instagram, Github} from "lucide-react"
import Link from "next/link"

export default function Footer() {
  const { t } = useI18n()

  return (
    <footer className="bg-background border-t mt-16">
      <div className="container mx-auto px-4 py-12">
        {/* Footer Content */}
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.company") || "Company"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.about") || "About Us"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.blog") || "Blog"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.careers") || "Careers"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.press") || "Press"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.product") || "Product"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/dogdex" className="hover:text-foreground transition">
                  {t("footer.dogdex") || "DogDex"}
                </Link>
              </li>
              <li>
                <Link href="/live" className="hover:text-foreground transition">
                  {t("footer.liveDetection") || "Live Detection"}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition">
                  {t("footer.pricing") || "Pricing"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.documentation") || "Documentation"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.support") || "Support"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.help") || "Help Center"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.contact") || "Contact Us"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.faq") || "FAQ"}
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-foreground transition">
                  {t("footer.status") || "Status"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">{t("footer.contact") || "Contact"}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <a href="mailto:ctytest8@gmail.com" className="hover:text-foreground transition">
                  ctytest8@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a href="tel:+84867174256" className="hover:text-foreground transition">
                  +84 867174256
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>Ho Chi Minh city, Vietnam</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Links & Copyright */}
        <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {t("footer.copyright") || "© 2025 Dog DogDex. All rights reserved."}
          </p>

          <div className="flex gap-4">
            <a href="https://www.facebook.com/hukudevon" className="text-muted-foreground hover:text-foreground transition">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition">
              <Twitter className="h-5 w-5" />
            </a>
            <a href="https://www.instagram.com/hukudevon" className="text-muted-foreground hover:text-foreground transition">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="https://github.com/SILVESTRIKE" className="text-muted-foreground hover:text-foreground transition">
              <Github className="h-5 w-5" />
            </a>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition">
              {t("footer.privacy") || "Privacy"}
            </Link>
            <Link href="/" className="hover:text-foreground transition">
              {t("footer.terms") || "Terms"}
            </Link>
            <Link href="/" className="hover:text-foreground transition">
              {t("footer.cookies") || "Cookies"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
