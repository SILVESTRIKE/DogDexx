"use client"

import type React from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
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
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
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
          // Nếu login thành công, đóng modal
          resetAndClose()
        } else { // mode === 'register'
          if (!name.trim()) {
            setError(t("auth.errorNameRequired"))
            return
          }
          const response = await register(email, password, name)
          setMessage(response.message || "Mã OTP đã được gửi tới email của bạn.")
          setView("otp") // Chuyển sang view nhập OTP
        }
      } else { // view === 'otp'
        await verifyOtp(email, otp)
        setMessage("Xác thực thành công! Vui lòng đăng nhập.")
        setView("form")
        onSwitchMode("login") // Tự động chuyển sang tab login
      }
    } catch (err: any) {
      // Handle specific API errors or show a general message
      setError(err.message || t("auth.errorGeneral"))
    } finally {
      setIsLoading(false)
    }
  }

  const resetAndClose = () => {
    setEmail("")
    setPassword("")
    setName("")
    setOtp("")
    setError("")
    setMessage("")
    setView("form")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpencha-hiddenge={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? t("auth.loginDescription") : t("auth.registerDescription")}
          </DialogDescription>
        </DialogHeader>

        {view === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth.namePlaceholder")}
                  required
                />
              </div>
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
          <form onSubmit={handleSubmit} className="space-y-4 flex flex-col items-center">
            <Label htmlFor="otp">Nhập mã OTP</Label>
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

        <Button type="submit" form="auth-form" className="w-full" disabled={isLoading} onClick={handleSubmit}>
          {isLoading
            ? t("auth.processing")
            : view === "otp"
            ? "Xác thực"
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
