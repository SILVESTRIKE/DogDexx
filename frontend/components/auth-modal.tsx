"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "login" | "register"
  onSwitchMode: (mode: "login" | "register") => void
}

export function AuthModal({ isOpen, onClose, mode, onSwitchMode }: AuthModalProps) {
  const { login, register, verifyOtp } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [avatar, setAvatar] = useState<File | null>(null)
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [view, setView] = useState<"form" | "otp">("form")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (view === "form") {
        if (mode === "login") {
          await login(email, password)
          toast.success(t('auth.loginTitle') + " " + t('common.success').toLowerCase());
          resetAndClose()

          // Xử lý chuyển hướng sau khi đăng nhập
          const redirectUrl = searchParams.get("redirect")
          if (redirectUrl) {
            // Lấy các params từ redirectUrl (ví dụ: plan, period)
            const redirectParams = new URLSearchParams(redirectUrl.split('?')[1] || '');
            const finalRedirectPath = redirectUrl.split('?')[0];
            router.push(`${finalRedirectPath}?${redirectParams.toString()}`);
          } else {
            router.refresh() // Làm mới trang hiện tại nếu không có redirect
          }
        } else { // mode === 'register'
          if (!username.trim()) {
            setError(t("auth.errorUsernameRequired"))
            return
          }
          const response = await register({
            email,
            password,
            username,
            firstName,
            lastName,
            avatar: avatar || undefined,
          })
          setMessage(response.message || "Mã OTP đã được gửi tới email của bạn.")
          setView("otp") // Chuyển sang view nhập OTP
        }
      } else { // view === 'otp'
        await verifyOtp(email, otp)
        setMessage(t('auth.otpSuccess'))
        setView("form")
        onSwitchMode("login") // Tự động chuyển sang tab login
      }
    } catch (err: any) {
      // Handle specific API errors or show a general message
      // SỬA ĐỔI: Sử dụng toast để hiển thị lỗi thay vì state
      toast.error(t('auth.loginTitle') + " " + t('common.failed').toLowerCase(), {
        description: err.message || t("auth.errorGeneral"),
      });
    } finally {
      setIsLoading(false)
    }
  }

  const resetAndClose = () => {
    setEmail("")
    setPassword("")
    setUsername("")
    setFirstName("")
    setLastName("")
    setAvatar(null)
    setOtp("")
    setError("")
    setMessage("")
    setView("form")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? t("auth.loginDescription") : t("auth.registerDescription")}
          </DialogDescription>
        </DialogHeader>

        {view === "form" ? (
          <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("auth.firstName")} ({t('auth.optional')})</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Văn" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("auth.lastName")} ({t('auth.optional')})</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="A" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">{t("auth.username")}</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      // Tự động chuyển đổi username thành dạng slug (chữ thường, không dấu, không cách)
                      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setUsername(slug);
                    }}
                    placeholder={t("auth.usernamePlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar">{t("auth.avatar")}</Label>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAvatar(e.target.files[0])
                      }
                    }}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                required
                disabled={isLoading}
              />
            </div>
          </form>
        ) : (
          <form id="otp-form" onSubmit={handleSubmit} className="space-y-4 flex flex-col items-center">
            <Label htmlFor="otp">{t('auth.enterOtp')}</Label>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-sm text-muted-foreground">{message}</p>
          </form>
        )}

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        {message && !error && <p className="text-sm text-green-600 text-center">{message}</p>}

        <Button type="submit" form={view === 'form' ? 'auth-form' : 'otp-form'} className="w-full" disabled={isLoading}>
          {isLoading
            ? t("auth.processing")
            : view === "otp"
            ? t("auth.verify")
            : mode === "login"
            ? t("auth.loginButton")
            : t("auth.registerButton")}
        </Button>

        <div className="text-center text-sm">
          {mode === "login" ? (
            <span>
              {t("auth.noAccount")}{" "}
              <button type="button" onClick={() => onSwitchMode("register")} className="text-primary hover:underline">
                {t("auth.registerNow")}
              </button>
            </span>
          ) : (
            <span>
              {t("auth.hasAccount")}{" "}
              <button type="button" onClick={() => onSwitchMode("login")} className="text-primary hover:underline">
                {t("auth.loginNow")}
              </button>
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
