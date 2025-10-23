"use client"

import Link from "next/link"
import { useState, useEffect, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { I18nContextType, useI18n } from "@/lib/i18n-context"
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
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Navbar() {
  const { user, logout, isLoading, isAuthenticated } = useAuth()
  const { t } = useI18n()
  const mounted = useMounted()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navContainerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({})

  const handleAuthClick = (mode: "login" | "register") => {
    setAuthMode(mode)
    setShowAuthModal(true)
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    handleScroll() // Check initial scroll position
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // THAY ĐỔI: Tự động mở modal nếu có query param 'auth'
  useEffect(() => {
    const authAction = searchParams.get("auth")
    if (authAction === "login" || authAction === "register") {
      setAuthMode(authAction)
      setShowAuthModal(true)
    }
  }, [])

  const navLinks = useMemo(() => [
    { href: "/", label: t("nav.detect"), auth: false },
    { href: "/live", label: t("nav.live"), auth: false },
    { href: "/pokedex", label: t("nav.pokedex"), auth: false },
    { href: "/achievements", label: t("nav.achievements"), auth: true },
    { href: "/history", label: t("nav.history"), auth: true },
  ], [t]);

  useEffect(() => {
    const activeLink = navContainerRef.current?.querySelector(`[data-active="true"]`) as HTMLElement;
    if (activeLink) {
      setIndicatorStyle({
        left: activeLink.offsetLeft,
        width: activeLink.offsetWidth,
        opacity: 1,
      });
    } else {
      setIndicatorStyle({ opacity: 0 });
    }
  }, [pathname, navLinks, isAuthenticated]);

  const navLinksContent = useMemo(() => (
    navLinks
    .filter((link) => !link.auth || (link.auth && isAuthenticated))
    .map((link) => {
      const isActive = pathname === link.href;
      return (
        <Link
          key={link.href}
          href={link.href}
          data-active={isActive}
          className={cn(
            "relative transition-colors px-4 rounded-full text-sm font-medium z-10 whitespace-nowrap h-full flex items-center",
            isActive ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"
          )}
        >
          {link.label}
        </Link>
      );
    })
  ), [navLinks, isAuthenticated, pathname]);

  const mobileNavLinks = useMemo(() => (
    navLinks
      .filter(link => !link.auth || isAuthenticated)
      .map(link => (
        <DropdownMenuItem key={`mobile-${link.href}`} asChild>
          <Link href={link.href} className={cn(
            "cursor-pointer",
            pathname === link.href && "bg-accent"
          )}>
            {link.label}
          </Link>
        </DropdownMenuItem>
      ))
  ), [navLinks, isAuthenticated, pathname]);

  const userMenuContent = useMemo(() => {
    if (isLoading) {
      return <div className="h-10 w-24 bg-muted rounded-md animate-pulse" /> // Tăng chiều cao cho skeleton loader
    }

    if (isAuthenticated && user) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 rounded-full pl-1.5 pr-3 h-9">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatarUrl} alt={user.username} />
                <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              {user.username}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Mobile Nav Links */}
            <div className="md:hidden">
              {mobileNavLinks}
              <DropdownMenuSeparator />
            </div>

            <DropdownMenuItem asChild><Link href="/profile" className="cursor-pointer"><User className="h-4 w-4 mr-2" />{t("nav.profile")}</Link></DropdownMenuItem>
            {user.role === "admin" && (
              <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/admin" className="cursor-pointer"><Shield className="h-4 w-4 mr-2" />{t("nav.adminPanel")}</Link></DropdownMenuItem></>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">{t("nav.logout")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    return (
      <>
        <Button onClick={() => handleAuthClick("login")} variant="outline" className="rounded-full h-9">{t("nav.login")}</Button>
        <Button onClick={() => handleAuthClick("register")} className="rounded-full h-9">{t("nav.register")}</Button>
      </>
    )
  }, [isLoading, isAuthenticated, user, t, logout, mobileNavLinks, pathname])

  return (
    <>
      <nav className={`sticky top-0 z-50 border-b transition-colors duration-300 ${scrolled ? "bg-background/90 backdrop-blur-lg border-border" : "bg-background border-transparent"}`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
              <img src="/LogoWebWhite.png" alt={t("common.appName")} className="w-8 h-auto" />
              <span>{t("common.appName")}</span>
            </Link>
          </div>
          <div className="hidden md:flex flex-1 justify-center">
            <div ref={navContainerRef} className="flex items-center justify-around relative bg-muted rounded-full h-9">
              {mounted ? (
                <>
                  <div className="absolute bg-primary rounded-full h-[calc(100%-2px)] transition-all duration-300 ease-in-out" style={indicatorStyle} />
                  {navLinksContent}
                </>
              ) : (
                <div className="h-full w-96 bg-muted-foreground/10 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 flex-1">
            <ThemeToggle />
            <LanguageToggle />
            {/* Thay đổi chiều cao skeleton loader để khớp với button mặc định */}
            {mounted ? userMenuContent : <div className="h-9 w-24 bg-muted rounded-md animate-pulse" />}
          </div>
        </div>
      </nav>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} mode={authMode} onSwitchMode={setAuthMode} />
    </>
  )
}