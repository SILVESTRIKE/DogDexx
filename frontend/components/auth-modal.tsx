"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useState, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Country } from 'country-state-city';
import { CountryStatePicker } from "@/components/CountryStatePicker";
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, Lock } from "lucide-react";
// 1. IMPORT RECAPTCHA
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: "login" | "register"
  onSwitchMode: (mode: "login" | "register") => void
}

export function AuthModal({ isOpen, onClose, mode, onSwitchMode }: AuthModalProps) {
  const { login, register, verifyOtp } = useAuth()

  // 2. KHỞI TẠO HOOK
  const { executeRecaptcha } = useGoogleReCaptcha();

  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  // --- FORM STATES ---
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [forgotEmail, setForgotEmail] = useState("")

  // --- LOCATION STATES ---
  const [selectedCountryCode, setSelectedCountryCode] = useState("VN")
  const [selectedCityName, setSelectedCityName] = useState("")

  // Memoized callbacks for LocationPicker to prevent re-renders
  const handleCountryChange = useCallback((code: string) => {
    setSelectedCountryCode(code);
    setSelectedCityName("");
  }, []);
  const handleCityChange = useCallback((city: string) => setSelectedCityName(city), []);

  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [view, setView] = useState<"form" | "otp" | "forgot" | "reset">("form")
  const [message, setMessage] = useState("")

  // --- HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (view === "form") {
        if (!executeRecaptcha) {
          console.error("ReCAPTCHA chưa sẵn sàng.");
          toast.error("Hệ thống bảo mật chưa sẵn sàng, vui lòng reload trang.");
          setIsLoading(false);
          return;
        }

        const token = await executeRecaptcha(mode === "login" ? "login" : "register");

        if (!token) {
          toast.error("Không thể xác thực danh tính (Bot detection).");
          setIsLoading(false);
          return;
        }

        if (mode === "login") {
          await login(email, password, token)

          toast.success(t('auth.loginTitle') + " thành công!")
          resetAndClose()

          // Small delay to ensure dialog overlay is fully unmounted before redirect
          const redirectUrl = searchParams.get("redirect")
          setTimeout(() => {
            if (redirectUrl) {
              const [path, params] = redirectUrl.split('?')
              const redirectParams = new URLSearchParams(params || '')
              router.push(`${path}?${redirectParams.toString()}`)
            } else {
              router.push("/")
            }
          }, 150)
        } else {
          if (!username.trim()) {
            setError(t("auth.errorUsernameRequired"))
            setIsLoading(false)
            return
          }

          if (password !== confirmPassword) {
            setError("Mật khẩu xác nhận không khớp.")
            setIsLoading(false)
            return
          }

          const countryName = selectedCountryCode === "VN" ? "Vietnam" : selectedCountryCode;

          const response = await register({
            email,
            password,
            username,
            firstName,
            lastName,
            country: countryName,
            city: selectedCityName,
            phoneNumber,
            captchaToken: token
          })

          setMessage(response.message || "Mã OTP đã được gửi tới email của bạn.")
          setView("otp")
        }
      } else {
        await verifyOtp(email, otp)
        setMessage(t('auth.otpSuccess'))
        toast.success("Xác thực thành công! Vui lòng đăng nhập.")
        setView("form")
        onSwitchMode("login")
      }
    } catch (err: any) {
      // Kiểm tra nếu lỗi là do tài khoản chưa xác thực
      if (err.message && (
        err.message.includes("Tài khoản chưa được xác thực") ||
        err.message.includes("Tài khoản chưa xác thực")
      )) {
        toast.error("Tài khoản chưa xác thực", { description: "Vui lòng nhập mã OTP vừa được gửi đến email của bạn." });
        setMessage("Vui lòng nhập mã OTP để xác thực tài khoản.");
        setView("otp");
        return;
      }

      toast.error("Thất bại", { description: err.message || "Có lỗi xảy ra" });
      setError(err.message);
    } finally {
      setIsLoading(false)
    }
  }

  // --- FORGOT PASSWORD HANDLER ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { apiClient } = await import("@/lib/api-client");
      await apiClient.forgotPassword(forgotEmail);
      toast.success("Đã gửi mã OTP!", { description: "Vui lòng kiểm tra email của bạn." });
      setView("reset");
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message || "Không thể gửi mã OTP" });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- RESET PASSWORD HANDLER ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmNewPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    // Validate password theo backend rules
    const passwordErrors = [];
    if (newPassword.length < 8) passwordErrors.push("ít nhất 8 ký tự");
    if (!/[A-Z]/.test(newPassword)) passwordErrors.push("1 chữ hoa");
    if (!/[a-z]/.test(newPassword)) passwordErrors.push("1 chữ thường");
    if (!/[0-9]/.test(newPassword)) passwordErrors.push("1 số");
    if (!/[^A-Za-z0-9]/.test(newPassword)) passwordErrors.push("1 ký tự đặc biệt");

    if (passwordErrors.length > 0) {
      setError(`Mật khẩu phải có: ${passwordErrors.join(", ")}`);
      return;
    }

    setIsLoading(true);

    try {
      const { apiClient } = await import("@/lib/api-client");
      await apiClient.resetPassword(forgotEmail, otp, newPassword);
      toast.success("Đặt lại mật khẩu thành công!", { description: "Vui lòng đăng nhập với mật khẩu mới." });

      // Reset states and go back to login
      setForgotEmail("");
      setOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      setView("form");
      onSwitchMode("login");
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message || "Không thể đặt lại mật khẩu" });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setEmail(""); setPassword(""); setConfirmPassword(""); setUsername(""); setFirstName(""); setLastName(""); setOtp("");
    setSelectedCountryCode("VN"); setSelectedCityName("");
    setForgotEmail(""); setNewPassword(""); setConfirmNewPassword("");
    setError(""); setMessage(""); setView("form"); setShowPassword(false);
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className={`overflow-y-auto max-h-[90vh] ${mode === 'register' ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <DialogHeader>
          <DialogTitle>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? t("auth.loginDescription") : t("auth.registerDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Form Content */}
        {view === 'form' && (
          <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* --- Hàng 1: Họ & Tên --- */}
                <div className="space-y-2">
                  <Label>{t("auth.lastName")} <span className="text-muted-foreground text-xs">({t("common.optional") || "Tùy chọn"})</span></Label>
                  <Input
                    value={lastName}
                    onChange={e => { setLastName(e.target.value); setError(""); }}
                    placeholder="Last Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("auth.firstName")} <span className="text-muted-foreground text-xs">({t("common.optional") || "Tùy chọn"})</span></Label>
                  <Input
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); setError(""); }}
                    placeholder="First Name"
                  />
                </div>

                {/* --- Hàng 2: Username & Số điện thoại --- */}
                <div className="space-y-2">
                  <Label>Username <span className="text-destructive">*</span></Label>
                  <Input
                    value={username}
                    onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(""); }}
                    required
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("auth.phoneNumber")} <span className="text-muted-foreground text-xs">({t("common.optional") || "Tùy chọn"})</span></Label>
                  <Input
                    type="text"
                    value={phoneNumber}
                    onChange={e => { setPhoneNumber(e.target.value); setError(""); }}
                    placeholder="0123456789"
                  />
                </div>

                {/* --- Hàng 3: Email (Full width) --- */}
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("auth.email")} <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    required
                    placeholder="example@gmail.com"
                  />
                </div>

                {/* --- Hàng 4: Location (Full width container) --- */}
                {/* Giả sử LocationPicker render ra 2 ô select, ta bọc nó vào col-span-2 để nó có không gian */}
                <div className="md:col-span-2">
                  <CountryStatePicker
                    selectedCountryCode={selectedCountryCode}
                    onCountryChange={handleCountryChange}
                    selectedCityName={selectedCityName}
                    onCityChange={handleCityChange}
                  />
                </div>

                {/* --- Hàng 5: Mật khẩu & Xác nhận mật khẩu --- */}
                <div className="space-y-2">
                  <Label>{t("auth.password")} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      required
                      placeholder="******"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Xác nhận mật khẩu <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
                      required
                      placeholder="******"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Login Form (Single Column)
              <>
                <div className="space-y-2">
                  <Label>{t("auth.email")}</Label>
                  <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} required placeholder="email@example.com" />
                </div>

                <div className="space-y-2">
                  <Label>{t("auth.password")}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      required
                      placeholder="******"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {mode === 'login' && (
              <div className="flex justify-between items-center mt-2">
                <button type="button" onClick={() => {
                  toast.info("Vui lòng nhập Email và chọn 'Đăng ký' để nhận mã OTP mới.");
                  onSwitchMode('register');
                }} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                  Tài khoản chưa xác thực?
                </button>

                <button type="button" onClick={() => setView('forgot')} className="text-xs text-primary hover:underline">
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}
          </form>
        )}

        {view === 'otp' && (
          <form id="otp-form" onSubmit={handleSubmit} className="space-y-6 flex flex-col items-center py-4">
            <div className="text-center space-y-2">
              <Label className="text-base">Nhập mã OTP gồm 6 chữ số</Label>
              <p className="text-xs text-muted-foreground">Đã gửi đến {email}</p>
            </div>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </form>
        )}

        {view === 'forgot' && (
          <form id="forgot-form" onSubmit={handleForgotPassword} className="space-y-4 py-4">
            <div className="text-center space-y-2 mb-4">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Quên mật khẩu?</h3>
              <p className="text-sm text-muted-foreground">Nhập email để nhận mã xác thực đặt lại mật khẩu</p>
            </div>

            <div className="space-y-2">
              <Label>Email đã đăng ký</Label>
              <Input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Đang gửi..." : "Gửi mã xác thực"}
            </Button>

            <button
              type="button"
              onClick={() => { setView('form'); setError(''); }}
              className="w-full text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Quay lại đăng nhập
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form id="reset-form" onSubmit={handleResetPassword} className="space-y-4 py-4">
            <div className="text-center space-y-2 mb-4">
              <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold">Đặt lại mật khẩu</h3>
              <p className="text-sm text-muted-foreground">Mã OTP đã được gửi đến <span className="font-medium">{forgotEmail}</span></p>
            </div>

            <div className="space-y-2">
              <Label>Mã OTP (6 số)</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Lock className="h-3 w-3" /> Mật khẩu mới</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Yêu cầu: 8+ ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt
              </p>
            </div>

            <div className="space-y-2">
              <Label>Xác nhận mật khẩu mới</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
            </Button>

            <button
              type="button"
              onClick={() => { setView('forgot'); setOtp(''); setError(''); }}
              className="w-full text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Gửi lại mã
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}

        <Button
          type="submit"
          form={view === 'form' ? 'auth-form' : 'otp-form'}
          className="w-full mt-4"
          disabled={isLoading}
        >
          {isLoading ? "Đang xử lý..." :
            view === "otp" ? "Xác thực OTP" :
              mode === "login" ? t("auth.loginButton") : t("auth.registerButton")}
        </Button>

        <div className="text-center text-sm mt-4">
          {mode === "login" ? (
            <span>{t("auth.noAccount")} <button type="button" onClick={() => onSwitchMode("register")} className="text-primary hover:underline font-medium">{t("auth.registerNow")}</button></span>
          ) : (
            <span>{t("auth.hasAccount")} <button type="button" onClick={() => onSwitchMode("login")} className="text-primary hover:underline font-medium">{t("auth.loginNow")}</button></span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}