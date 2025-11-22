"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useState, useMemo } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Country, State } from 'country-state-city';

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

  // --- FORM STATES ---
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [otp, setOtp] = useState("")
  
  // --- LOCATION STATES ---
  const [selectedCountryCode, setSelectedCountryCode] = useState("VN") // Mặc định Vietnam
  const [selectedCityName, setSelectedCityName] = useState("")

  // Memoize danh sách để tối ưu hiệu năng
  const allCountries = useMemo(() => Country.getAllCountries(), []);
  const citiesOfCountry = useMemo(() => {
    return State.getStatesOfCountry(selectedCountryCode) || [];
  }, [selectedCountryCode]);

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
        if (mode === "login") {
          await login(email, password)
          toast.success(t('auth.loginTitle') + " thành công!")
          resetAndClose()
          
          // Redirect logic
          const redirectUrl = searchParams.get("redirect")
          if (redirectUrl) {
            const [path, params] = redirectUrl.split('?')
            const redirectParams = new URLSearchParams(params || '')
            router.push(`${path}?${redirectParams.toString()}`)
          } else {
            router.refresh()
          }
        } else { 
          // === REGISTER LOGIC ===
          if (!username.trim()) {
            setError(t("auth.errorUsernameRequired"))
            setIsLoading(false)
            return
          }

          // Lấy tên quốc gia từ mã code (để lưu vào DB cho đẹp)
          const countryData = allCountries.find(c => c.isoCode === selectedCountryCode);
          const countryName = countryData ? countryData.name : "Vietnam";

          const response = await register({
            email,
            password,
            username,
            firstName,
            lastName,
            country: countryName, // Gửi tên quốc gia
            city: selectedCityName, // Gửi tên thành phố
            // avatar: avatar // Nếu có upload avatar thì thêm vào
          })
          
          setMessage(response.message || "Mã OTP đã được gửi tới email của bạn.")
          setView("otp") // Chuyển sang màn hình nhập OTP
        }
      } else { 
        // === OTP LOGIC ===
        await verifyOtp(email, otp)
        setMessage(t('auth.otpSuccess'))
        
        // Sau khi verify xong, chuyển về login để người dùng đăng nhập lại
        // Hoặc có thể tự động login luôn tùy logic auth context của bạn
        toast.success("Xác thực thành công! Vui lòng đăng nhập.")
        setView("form")
        onSwitchMode("login")
      }
    } catch (err: any) {
      // Hiển thị lỗi từ backend (VD: "Tài khoản chưa xác thực...")
      toast.error("Thất bại", { description: err.message || "Có lỗi xảy ra" });
      setError(err.message);
    } finally {
      setIsLoading(false)
    }
  }

  const resetAndClose = () => {
    setEmail(""); setPassword(""); setUsername(""); setFirstName(""); setLastName(""); setOtp("");
    setSelectedCountryCode("VN"); setSelectedCityName("");
    setError(""); setMessage(""); setView("form");
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "login" ? t("auth.loginDescription") : t("auth.registerDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* VIEW: FORM LOGIN/REGISTER */}
        {view === 'form' && (
          <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Họ</Label>
                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nguyen" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tên</Label>
                    <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Van A" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input 
                    value={username} 
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                    required 
                    placeholder="username_123"
                  />
                </div>

                {/* SELECTION QUỐC GIA & THÀNH PHỐ */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quốc gia</Label>
                    <div className="relative">
                      <select
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={selectedCountryCode}
                        onChange={(e) => {
                          setSelectedCountryCode(e.target.value);
                          setSelectedCityName(""); // Reset city khi đổi nước
                        }}
                      >
                        {allCountries.map((c) => (
                          <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Thành phố</Label>
                    <div className="relative">
                      <select
                         className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                         value={selectedCityName}
                         onChange={(e) => setSelectedCityName(e.target.value)}
                         disabled={citiesOfCountry.length === 0}
                      >
                        <option value="">-- Chọn TP --</option>
                        {/* SỬA LỖI KEY Ở ĐÂY: Thêm index vào key */}
                        {citiesOfCountry.map((state, index) => (
                          <option key={`${state.name}-${index}`} value={state.name}>{state.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{t("auth.email")}</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.password")}</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="******" />
            </div>

            {/* HELPER LINK FOR LOGIN */}
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

        {/* VIEW: OTP INPUT */}
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

        {/* VIEW: FORGOT/RESET (Giữ nguyên hoặc gọi component con) */}
        {view === 'forgot' && (
           <div className="text-center py-8 text-sm text-gray-500">Tính năng quên mật khẩu đang cập nhật... <button onClick={()=>setView('form')} className="text-primary underline">Quay lại</button></div>
        )}

        {/* ERROR MESSAGE */}
        {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}

        {/* SUBMIT BUTTON */}
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

        {/* SWITCH MODE FOOTER */}
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