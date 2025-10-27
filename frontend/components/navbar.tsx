"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { I18nContextType, useI18n } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"
import { Button, buttonVariants } from "@/components/ui/button"
import { AuthModal } from "@/components/auth-modal"
import { User, Shield, Coins } from "lucide-react"
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
import { Menu } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Navbar() {
  const { user, logout, isLoading, isAuthenticated, isAuthModalOpen, setAuthModalOpen, authModalMode, setAuthModalMode } = useAuth()
  const { t } = useI18n()
  const mounted = useMounted()
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navContainerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({})

  const handleAuthClick = (mode: "login" | "register") => {    
    setAuthModalMode(mode)
    setAuthModalOpen(true)
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    handleScroll() // Check initial scroll position
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const authAction = searchParams.get("auth")
    if (authAction === "login" || authAction === "register") {
      setAuthModalMode(authAction)
      setAuthModalOpen(true)
    }
  }, [searchParams, setAuthModalMode, setAuthModalOpen])

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

  const allMobileLinks = useMemo(() => (
    <>
      {mobileNavLinks}
      {!isAuthenticated && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAuthClick("login")} className="cursor-pointer">
            {t("nav.login")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAuthClick("register")} className="cursor-pointer">
            {t("nav.register")}
          </DropdownMenuItem>
        </>
      )}
    </>
  ), [mobileNavLinks, isAuthenticated, t, handleAuthClick]);




  const userMenuContent = useMemo(() => {
    if (isAuthenticated && user) {
      return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="font-mono">{user.remainingTokens}/{user.tokenAllotment}</span>
                </div>
                <Button variant="outline" className="flex items-center gap-2 rounded-full pl-1.5 pr-3 h-9">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatarUrl} alt={user.username} />
                    <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {user.username}
                </Button>
              </div>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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

    // Nếu chưa đăng nhập nhưng có thông tin user (trường hợp guest)
    if (!isAuthenticated && user) {
      return (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="font-mono">{user.remainingTokens}/{user.tokenAllotment}</span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button onClick={() => handleAuthClick("login")} variant="outline" className="rounded-full h-9">{t("nav.login")}</Button>
            <Button onClick={() => handleAuthClick("register")} className="rounded-full h-9">{t("nav.register")}</Button>
          </div>
        </div>
      )
    }

    // Trường hợp 3: Chưa có thông tin gì (đang tải hoặc chưa có phiên)
    return (
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-3">
          <Button onClick={() => handleAuthClick("login")} variant="outline" className="rounded-full h-9">{t("nav.login")}</Button>
          <Button onClick={() => handleAuthClick("register")} className="rounded-full h-9">{t("nav.register")}</Button>
        </div>
      </div>
    )
  }, [isLoading, isAuthenticated, user, user?.remainingTokens, t, logout, mobileNavLinks, pathname, handleAuthClick])

  return (
    <>
      <nav className={`sticky top-0 z-50 border-b transition-colors duration-300 ${scrolled ? "bg-background/90 backdrop-blur-lg border-border" : "bg-background border-transparent"}`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <Link href="/" className="flex flex-col md:flex-row items-center md:gap-2 text-2xl font-bold">
              <img src="/LogoWebWhite.png" alt={t("common.appName")} className="w-9 h-auto" />
              <span className="hidden md:inline">{t("common.appName")}</span>
              <span className="text-xs font-semibold md:hidden">{t("common.appName")}</span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
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
            {mounted ? userMenuContent : <div className="h-9 w-24 bg-muted rounded-full animate-pulse" />}

            {/* Mobile Menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allMobileLinks}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
        </div>
      </nav>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} mode={authModalMode} onSwitchMode={setAuthModalMode} />
    </>
  )
}