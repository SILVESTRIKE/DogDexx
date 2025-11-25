"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
// 1. Thay đổi import: Bỏ ReCaptcha cũ, dùng Hook mới
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ContactForm() {
  const { t } = useI18n(); 
  const { user, isAuthenticated, setAuthModalOpen, setAuthModalMode } = useAuth();
  
  // 2. Gọi Hook
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 3. Xóa cái useRef đi, không cần nữa
  // const recaptchaRef = useRef<ReCaptcha>(null);

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      setEmail(user.email);
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setAuthModalMode("login");
      setAuthModalOpen(true);
      return;
    }
    setIsSubmitting(true);

    try {
      // 4. KIỂM TRA & LẤY TOKEN BẰNG HOOK (Giống AuthModal)
      if (!executeRecaptcha) {
         toast.error("ReCAPTCHA chưa sẵn sàng.");
         return;
      }
      
      // Action đặt tên là 'contact' để phân biệt trong Google Console
      const captchaToken = await executeRecaptcha("contact"); 
      
      if (!captchaToken) {
        throw new Error(t("contact.captchaError"));
      }

      // Xóa dòng reset ref cũ đi
      // recaptchaRef.current?.reset();

      await apiClient.submitContactForm({
        email,
        message,
        captchaToken,
      });

      setSubmitted(true);
      toast.success(t("contact.successTitle"), {
        description: t("contact.successDescription"),
      });
    } catch (error: any) {
      toast.error(t("contact.errorTitle"), {
        description: error.message || t("contact.errorDescription"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... (Phần GlassContainer giữ nguyên) ...
  const GlassContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-ring/50 rounded-[2rem] blur opacity-30 transition duration-500 group-hover:opacity-50 pointer-events-none" />
      <div className={cn("relative z-10 bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[1.8rem] overflow-hidden p-6 md:p-10", className)}>
        {children}
      </div>
    </div>
  );

  if (submitted) {
     // ... (Giữ nguyên) ...
     return (
        // ... Code phần success giữ nguyên ...
        <GlassContainer className="flex flex-col items-center justify-center text-center py-16 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-600/20 flex items-center justify-center mb-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground">
            {t("contact.thankYouTitle")}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t("contact.thankYouDesc")}
            </p>
            <Button
            variant="ghost"
            className="mt-8 hover:bg-primary/10"
            onClick={() => {
                setSubmitted(false);
                setMessage("");
            }}
            >
            {t("contact.sendAnother")}
            </Button>
        </GlassContainer>
     );
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ... (Các input giữ nguyên) ... */}
        
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium ml-1">
            {t("contact.emailLabel")}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t("contact.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isAuthenticated}
            className="h-12 rounded-xl bg-secondary/30 border-white/10 focus:border-primary/50 focus:ring-primary/20 focus:bg-background/80 transition-all duration-300"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-sm font-medium ml-1">
            {t("contact.messageLabel")}
          </Label>
          <Textarea
            id="message"
            placeholder={t("contact.messagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            className="rounded-xl bg-secondary/30 border-white/10 focus:border-primary/50 focus:ring-primary/20 focus:bg-background/80 transition-all duration-300 resize-none min-h-[120px]"
          />
        </div>

        {/* 5. XÓA COMPONENT <ReCaptcha /> CŨ ĐI */}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={!email.trim() || !message.trim() || isSubmitting}
            className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-violet-600 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-300"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("contact.submitting")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t("contact.submitButton")}
              </span>
            )}
          </Button>
          
          {/* Giữ lại dòng này để tuân thủ chính sách Google */}
          <p className="text-[10px] text-muted-foreground/60 text-center mt-4">
            {t("contact.recaptchaText")}
          </p>
        </div>
      </form>
    </div>
  );
}