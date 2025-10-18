// navbar.tsx

"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth-modal"
import { User, Shield } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"

export function Navbar() {
  const { user, logout, isLoading, isAuthenticated } = useAuth()
  const { t } = useI18n()
  const mounted = useMounted()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [scrolled, setScrolled] = useState(false)

  const handleAuthClick = (mode: "login" | "register") => {
    setAuthMode(mode)
    setShowAuthModal(true)
  }

  useEffect(() => {
    const handleScroll = () => {
      // Set trạng thái 'scrolled' thành true nếu người dùng cuộn xuống hơn 10px
      setScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const renderNavLinks = () => {
    if (!mounted) {
      return (
        <>
          <div className="h-5 w-16 bg-muted rounded-md animate-pulse" />
          <div className="h-5 w-12 bg-muted rounded-md animate-pulse" />
        </>
      );
    }

    // Định nghĩa navLinks bên trong hàm render để đảm bảo `t()` được gọi lại mỗi khi re-render
    const navLinks = [
      { href: "/", label: t("nav.detect"), auth: false },
      { href: "/live", label: t("nav.live"), auth: false },
      { href: "/pokedex", label: t("nav.pokedex"), auth: true },
      { href: "/achievements", label: t("nav.achievements"), auth: true },
    ]

    return navLinks
      .filter((link) => !link.auth || (link.auth && isAuthenticated))
      .map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-foreground/70 hover:text-foreground transition-colors"
        >
          {link.label}
        </Link>
      ));
  }

  const renderUserMenu = () => {
    // Nếu chưa mounted hoặc đang loading, hiển thị skeleton/loading
    if (!mounted || isLoading) {
      return (
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-muted rounded-md animate-pulse" />
        </div>
      );
    }

    // Nếu đã xác thực (sau khi loading xong)
    if (isAuthenticated) {
      // Khi isAuthenticated là true, user CHẮC CHẮN phải có dữ liệu sau khi isLoading = false.
      const userNameDisplay = user?.username || t("nav.account"); 

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <User className="h-4 w-4 mr-2" />
              {userNameDisplay}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                {t("nav.profile")}
              </Link>
            </DropdownMenuItem>
            
            {user?.role === "admin" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield className="h-4 w-4 mr-2" />
                    {t("nav.adminPanel")}
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer">
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // Nếu không, hiển thị nút đăng nhập/đăng ký
    return (
      <>
        <Button onClick={() => handleAuthClick("login")} variant="outline" size="sm">{t("nav.login")}</Button>
        <Button onClick={() => handleAuthClick("register")} size="sm">{t("nav.register")}</Button>
      </>
    );
  }

  return (
    <>
      <nav
        className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
          scrolled ? "bg-background/90 backdrop-blur-sm border-border" : "bg-background border-transparent"
        }`}
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold">
              {mounted ? t("common.appName") : "DogDex AI"}
            </Link>
            <nav className="hidden md:flex gap-4">{renderNavLinks()}</nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageToggle />
            {renderUserMenu()}
          </div>
        </div>
      </nav>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        onSwitchMode={(mode) => setAuthMode(mode)}
      />
    </>
  )
}