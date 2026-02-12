"use client"

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth-modal"
import { User, Shield, Coins, Settings, Menu, LogOut, LogIn, UserPlus, ImageIcon, Video, Radio, MessageSquare, PawPrint } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import React from "react";

export function Navbar() {
  const { user, logout, isAuthenticated, isAuthModalOpen, setAuthModalOpen, authModalMode, setAuthModalMode } = useAuth()
  const { t } = useI18n()
  const mounted = useMounted()
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([])
  const navContainerRef = useRef<HTMLDivElement>(null)

  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    opacity: 0,
    width: 0,
    left: 0
  })

  const handleAuthClick = useCallback((mode: "login" | "register") => {
    setAuthModalMode(mode)
    setAuthModalOpen(true)
  }, [setAuthModalMode, setAuthModalOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll)
    handleScroll()
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
    { href: "/community", label: t("nav.lostFound"), auth: false },
    { href: "/dogdex", label: t("nav.dogdex"), auth: false },
    { href: "/history", label: t("nav.history"), auth: true },
    { href: "/rank", label: t("nav.rank"), auth: false },
    { href: "/pricing", label: t("nav.pricing"), auth: true },
    { href: "/about", label: t("nav.about"), auth: false },
  ], [t]);

  const isLinkActive = useCallback((href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }, [pathname]);

  // --- LOGIC TÍNH TOÁN VỊ TRÍ PILL ---
  useEffect(() => {
    if (!mounted) return;

    const calculateIndicator = () => {
      const visibleLinks = navLinks.filter(link => !link.auth || (link.auth && isAuthenticated));
      const activeIndex = visibleLinks.findIndex(link => isLinkActive(link.href));
      const activeEl = itemsRef.current[activeIndex];

      if (activeEl && navContainerRef.current) {
        const containerRect = navContainerRef.current.getBoundingClientRect();
        const itemRect = activeEl.getBoundingClientRect();

        setIndicatorStyle({
          left: itemRect.left - containerRect.left,
          width: itemRect.width,
          opacity: 1,
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    calculateIndicator();
    const timeoutId = setTimeout(calculateIndicator, 150);
    window.addEventListener("resize", calculateIndicator);

    return () => {
      window.removeEventListener("resize", calculateIndicator);
      clearTimeout(timeoutId);
    };
  }, [pathname, navLinks, isAuthenticated, mounted, isLinkActive]);


  const navLinksContent = useMemo(() => (
    navLinks
      .filter((link) => !link.auth || (link.auth && isAuthenticated))
      .map((link, index) => {
        const active = isLinkActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            ref={(el) => { itemsRef.current[index] = el }}
            className={cn(
              "relative transition-colors duration-300 px-3 lg:px-5 py-2 rounded-full text-xs lg:text-sm font-bold z-10 whitespace-nowrap flex items-center h-full select-none",
              active
                ? "text-white"
                : "text-muted-foreground hover:text-primary"
            )}
          >
            {link.label}
          </Link>
        );
      })
  ), [navLinks, isAuthenticated, isLinkActive]);

  // --- TOKEN DISPLAY (Tách riêng để dùng ở Left Section) ---
  const tokenDisplay = useMemo(() => {
    if (!user || typeof user.remainingTokens !== 'number') return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/60 dark:bg-secondary/50 border border-border px-2 py-0.5 sm:px-3 sm:py-1 backdrop-blur-sm group-hover:bg-primary/10 transition-colors shadow-sm cursor-pointer hover:bg-primary/5">
            <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-600 dark:text-yellow-500" />
            <span className="font-mono text-xs sm:text-sm font-bold text-foreground">
              {user.remainingTokens}/{user.tokenAllotment}
            </span>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="end">
          <div className="space-y-3">
            <h4 className="font-semibold text-sm leading-none text-primary mb-2">Token Usage Cost</h4>
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-500" />
                  <span>Image Detection</span>
                </div>
                <span className="font-mono font-bold">2</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-purple-500" />
                  <span>Video Analysis</span>
                </div>
                <span className="font-mono font-bold">10</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-red-500" />
                  <span>Live Stream</span>
                </div>
                <span className="font-mono font-bold">5</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  <span>AI Chat</span>
                </div>
                <span className="font-mono font-bold">1</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }, [user]);

  // --- MENU MOBILE ---
  const allMobileLinks = useMemo(() => {
    const links = navLinks
      .filter(link => !link.auth || isAuthenticated)
      .map(link => {
        const active = isLinkActive(link.href);
        return (
          <DropdownMenuItem key={`mobile-${link.href}`} asChild>
            <Link href={link.href} className={cn(
              "cursor-pointer w-full font-medium py-2",
              active && "bg-primary/15 text-primary font-bold"
            )}>
              {link.label}
            </Link>
          </DropdownMenuItem>
        )
      });

    if (!isAuthenticated) {
      links.push(
        <DropdownMenuSeparator key="mobile-sep-auth" />,
        <DropdownMenuItem key="mobile-login" onClick={() => handleAuthClick("login")} className="cursor-pointer text-primary font-semibold">
          <LogIn className="h-4 w-4 mr-2" />
          {t("nav.login")}
        </DropdownMenuItem>,
        <DropdownMenuItem key="mobile-register" onClick={() => handleAuthClick("register")} className="cursor-pointer font-semibold">
          <UserPlus className="h-4 w-4 mr-2" />
          {t("nav.register")}
        </DropdownMenuItem>
      );
    }

    return links;
  }, [navLinks, isAuthenticated, isLinkActive, handleAuthClick, t]);

  // --- RIGHT MENU (Đã bỏ token display ở đây) ---
  const userMenuContent = useMemo(() => {
    if (isAuthenticated && user) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 md:gap-3 cursor-pointer group select-none">
              <Button variant="ghost" className="flex items-center gap-2 rounded-full pl-1 pr-2 h-8 md:h-9 hover:bg-primary/10">
                <Avatar className="h-7 w-7 md:h-8 md:w-8 border-2 border-white shadow-sm">
                  <AvatarImage src={user.avatarUrl} alt={user.username} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden lg:inline text-sm font-bold text-foreground">{user.username}</span>
              </Button>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-xl border-border/50 shadow-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none text-primary">{user.username}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/profile" className="cursor-pointer hover:text-primary focus:text-primary"><User className="h-4 w-4 mr-2" />{t("nav.profile")}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/my-dogs" className="cursor-pointer hover:text-primary focus:text-primary"><PawPrint className="h-4 w-4 mr-2" />{t("nav.myPets")}</Link></DropdownMenuItem>
            {user.role === "admin" && (
              <React.Fragment key="admin-menu">
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/admin" className="cursor-pointer"><Shield className="h-4 w-4 mr-2" />{t("nav.adminPanel")}</Link></DropdownMenuItem>
              </React.Fragment>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="h-4 w-4 mr-2" />
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }

    // --- CHƯA ĐĂNG NHẬP ---
    return (
      <div className="flex items-center gap-2 md:gap-3">
        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Button onClick={() => handleAuthClick("login")} variant="ghost" className="rounded-full h-9 font-semibold hover:bg-primary/10 hover:text-primary">{t("nav.login")}</Button>
          <Button onClick={() => handleAuthClick("register")} className="rounded-full h-9 bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-105">{t("nav.register")}</Button>
        </div>

        {/* Mobile Button */}
        <div className="md:hidden flex items-center">
          {!user && (
            <Button onClick={() => handleAuthClick("login")} size="sm" variant="default" className="rounded-full h-8 text-xs px-3 bg-primary text-white shadow-sm">
              {t("nav.login")}
            </Button>
          )}
        </div>
      </div>
    )
  }, [isAuthenticated, user, t, logout, handleAuthClick])

  return (
    <>
      <nav
        className={cn(
          "sticky top-0 z-50 transition-all duration-500 border-b",
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-border/60 shadow-sm"
            : "bg-transparent border-transparent"
        )}
      >
        <div className="w-full px-4 lg:px-8 py-2 md:py-3 flex items-center justify-between">

          {/* ======================= */}
          {/* 1. LEFT SECTION (Logo + Tokens) */}
          {/* ======================= */}
          <div className="flex items-center justify-start gap-4 md:gap-6 md:flex-1 min-w-fit">
            <Link href="/" className="flex items-center gap-2 md:gap-3 text-2xl font-bold group flex-shrink-0">
              <div className="relative">
                <img
                  src="/LogoWebBlack.png"
                  alt={t("common.appName")}
                  className="w-8 h-auto md:w-10 dark:hidden group-hover:rotate-12 transition-transform duration-300"
                />
                <img
                  src="/LogoWebWhite.png"
                  alt={t("common.appName")}
                  className="w-8 h-auto md:w-10 hidden dark:block group-hover:rotate-12 transition-transform duration-300"
                />
              </div>

              <span className="hidden xl:inline whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary font-extrabold tracking-tight group-hover:to-primary transition-all">
                {t("common.appName")}
              </span>
              <span className="text-base uppercase tracking-widest font-black xl:hidden text-primary mt-1">
                DogDex
              </span>
            </Link>
            <div className="hidden pr-6 lg:block">
              {mounted && tokenDisplay}
            </div>
          </div>

          {/* ======================= */}
          {/* 2. CENTER SECTION (Nav Pill) */}
          {/* ======================= */}
          <div className="hidden lg:flex justify-center flex-shrink">
            <div
              ref={navContainerRef}
              className="flex items-center justify-around relative bg-white/60 dark:bg-secondary/30 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-full h-10 lg:h-11 px-1 lg:px-1.5 shadow-sm max-w-full overflow-hidden"
            >
              {mounted ? (
                <>
                  <div
                    className="absolute rounded-full h-[calc(100%-10px)] shadow-md shadow-primary/25 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      ...indicatorStyle,
                      top: '5px',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                  {navLinksContent}
                </>
              ) : (
                <div className="h-full w-96 bg-muted/20 rounded-full animate-pulse" />
              )}
            </div>
          </div>

          {/* ======================= */}
          {/* 3. RIGHT SECTION (User Menu & Settings) */}
          {/* ======================= */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-3 md:flex-1">

            {/* Hiển thị Token trên Mobile (nếu muốn) hoặc ẩn đi. Ở đây tôi để ẩn trên Desktop (vì đã có ở bên trái), hiện trên Mobile để user check */}
            <div className="lg:hidden">
              {mounted && tokenDisplay}
            </div>

            {mounted ? userMenuContent : <div className="h-9 w-24 bg-muted/20 rounded-full animate-pulse" />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-9 md:w-9 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                  <Settings className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background/90 backdrop-blur-xl border-border shadow-lg">
                <DropdownMenuLabel className="text-primary">{t('nav.light')}/{t('nav.dark')}</DropdownMenuLabel>
                <div className="px-2 py-1"><ThemeToggle /></div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-primary">{t('language.toggle')}</DropdownMenuLabel>
                <div className="px-2 py-1"><LanguageToggle /></div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 rounded-full">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-background/95 backdrop-blur-xl border-border shadow-xl mt-2">
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