"use client";

import { useState, useRef } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import ReCaptcha from "react-google-recaptcha";
import { toast } from "sonner";

export function ContactForm() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recaptchaRef = useRef<ReCaptcha>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const captchaToken = await recaptchaRef.current?.executeAsync();
      if (!captchaToken) {
        throw new Error("Could not verify CAPTCHA. Please try again.");
      }
      recaptchaRef.current?.reset();

      await apiClient.submitContactForm({
        email,
        message,
        captchaToken,
      });

      setSubmitted(true);
      toast.success(t('contact.successTitle'), {
        description: t('contact.successDescription'),
      });

    } catch (error: any) {
      toast.error(t('contact.errorTitle'), {
        description: error.message || t('contact.errorDescription'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-2 border-primary">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Send className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('contact.thankYou')}</h3>
            <p className="text-muted-foreground">
              {t('contact.thankYouDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('contact.title')}</CardTitle>
        <CardDescription>{t('contact.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">{t('contact.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('contact.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">{t('contact.messageLabel')}</Label>
            <Textarea
              id="message"
              placeholder={t('contact.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              className="resize-none text-base"
            />
          </div>

          <ReCaptcha
            ref={recaptchaRef}
            size="invisible"
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
          />

          <Button
            type="submit"
            disabled={!email.trim() || !message.trim() || isSubmitting}
            size="lg"
            className="w-full gap-2"
          >
            <Send className="h-5 w-5" />
            {isSubmitting ? t('contact.submitting') : t('contact.submit')}
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" className="underline">Privacy Policy</a> and <a href="https://policies.google.com/terms" className="underline">Terms of Service</a> apply.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
