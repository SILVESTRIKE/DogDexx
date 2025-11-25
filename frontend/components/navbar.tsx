"use client"

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth-modal"
import { User, Shield, Coins, Settings, Menu, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  
  // FIX 1: Không reset ref array trong render body để tránh mất tham chiếu
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([])
  const navContainerRef = useRef<HTMLDivElement>(null)
  
  // State lưu style của cục Pill
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
    { href: "/dogdex", label: t("nav.dogdex"), auth: false },
    { href: "/history", label: t("nav.history"), auth: true },
    { href: "/achievements", label: t("nav.achievements"), auth: true },
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
      // Lọc danh sách link hiện có trên màn hình
      const visibleLinks = navLinks.filter(link => !link.auth || (link.auth && isAuthenticated));
      
      const activeIndex = visibleLinks.findIndex(link => isLinkActive(link.href));
      const activeEl = itemsRef.current[activeIndex];

      if (activeEl && navContainerRef.current) {
        const containerRect = navContainerRef.current.getBoundingClientRect();
        const itemRect = activeEl.getBoundingClientRect();

        setIndicatorStyle({
          left: itemRect.left - containerRect.left,
          width: itemRect.width,
          opacity: 1, // Đảm bảo luôn hiện khi tìm thấy active
        });
      } else {
        // Nếu không tìm thấy active link nào thì ẩn đi
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    // Trigger tính toán
    calculateIndicator();
    
    // Fallback: Đôi khi font load chậm làm sai width, tính lại sau 150ms
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
          // Gán ref mà không reset mảng
          ref={(el) => { itemsRef.current[index] = el }}
          className={cn(
            "relative transition-colors duration-300 px-5 py-2 rounded-full text-sm font-bold z-10 whitespace-nowrap flex items-center h-full select-none",
            // Active: Trắng (nổi trên cục Pill màu nâu)
            // Inactive: Nâu nhạt -> Hover thành nâu đậm
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

  const allMobileLinks = useMemo(() => (
    navLinks
      .filter(link => !link.auth || isAuthenticated)
      .map(link => {
        const active = isLinkActive(link.href);
        return (
            <DropdownMenuItem key={`mobile-${link.href}`} asChild>
            <Link href={link.href} className={cn(
                "cursor-pointer w-full font-medium",
                active && "bg-primary/15 text-primary font-bold"
            )}>
                {link.label}
            </Link>
            </DropdownMenuItem>
        )
      })
  ), [navLinks, isAuthenticated, isLinkActive]);

  const userMenuContent = useMemo(() => {    
    // Phần hiển thị token, tách ra để tái sử dụng
    const tokenDisplay = user && typeof user.remainingTokens === 'number' ? (
      <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/60 dark:bg-secondary/50 border border-border px-3 py-1 text-sm font-medium text-foreground backdrop-blur-sm group-hover:bg-primary/10 transition-colors shadow-sm">
        <Coins className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />
        <span className="font-mono text-xs md:text-sm">{user.remainingTokens}/{user.tokenAllotment}</span>
      </div>
    ) : null;

    if (isAuthenticated && user) {
      return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                {tokenDisplay}
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
    
    return (
      <div className="flex items-center gap-2 md:gap-3">
        {tokenDisplay} {/* <-- Hiển thị token cho cả khách */}
        <div className="hidden md:flex items-center gap-2">
          <Button onClick={() => handleAuthClick("login")} variant="ghost" className="rounded-full h-9 font-semibold hover:bg-primary/10 hover:text-primary">{t("nav.login")}</Button>
          <Button onClick={() => handleAuthClick("register")} className="rounded-full h-9 bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-105">{t("nav.register")}</Button>
        </div>
        <div className="md:hidden flex items-center">
             {!user && (
                <Button onClick={() => handleAuthClick("login")} size="sm" className="rounded-full h-8 text-xs px-4 bg-primary text-white shadow-md">
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
        <div className="container mx-auto px-4 py-2 md:py-3 flex items-center justify-between">
          
          {/* 1. LOGO */}
          <div className="flex items-center gap-8 flex-1">
            <Link href="/" className="flex items-center gap-2 md:gap-3 text-2xl font-bold group">
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
              
              <span className="hidden md:inline bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary font-extrabold tracking-tight group-hover:to-primary transition-all">
                {t("common.appName")}
              </span>
              <span className="text-xs uppercase tracking-widest font-black md:hidden text-primary mt-1">
                DogDex
              </span>
            </Link>
          </div>

          {/* 2. DESKTOP NAV PILL */}
          <div className="hidden md:flex flex-1 justify-center">
            <div 
                ref={navContainerRef} 
                className="flex items-center justify-around relative bg-white/60 dark:bg-secondary/30 backdrop-blur-md border border-white/40 dark:border-white/5 rounded-full h-11 px-1.5 shadow-sm"
            >
              {mounted ? (
                <>
                  {/* FIX 2: SỬ DỤNG bg-primary (Màu nâu) thay vì primary-foreground */}
                  <div 
                    className="absolute rounded-full h-[calc(100%-10px)] shadow-md shadow-primary/25 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                        ...indicatorStyle,
                        top: '5px',
                        backgroundColor: 'var(--primary)', // Force màu nâu bằng style inline để chắc chắn không bị ghi đè
                    }} 
                  />
                  {navLinksContent}
                </>
              ) : (
                <div className="h-full w-96 bg-muted/20 rounded-full animate-pulse" />
              )}
            </div>
          </div>

          {/* 3. RIGHT ACTIONS */}
          <div className="flex items-center justify-end gap-2 md:gap-3 flex-1">
            {mounted ? userMenuContent : <div className="h-9 w-24 bg-muted/20 rounded-full animate-pulse" />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                  <Settings className="h-5 w-5" />
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

            <div className="md:hidden">
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