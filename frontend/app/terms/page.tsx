"use client"

import { useI18n } from "@/lib/i18n-context"
import Footer from "@/components/footer"

export default function TermsPage() {
  const { t } = useI18n()

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">{t("terms.title") || "Terms of Service"}</h1>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">{t("terms.intro") || "Agreement to Terms"}</h2>
              <p>
                {t("terms.introText") ||
                  "By accessing and using DogDogDex, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service."}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {t("terms.userResponsibilities") || "User Responsibilities"}
              </h2>
              <p>
                {t("terms.userResponsibilitiesText") ||
                  "You are responsible for maintaining the confidentiality of your account and password and for restricting access to your computer. You agree to accept responsibility for all activities that occur under your account or password."}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {t("terms.intellectualProperty") || "Intellectual Property"}
              </h2>
              <p>
                {t("terms.intellectualPropertyText") ||
                  "The content, features, and functionality of DogDogDex are owned by DogDogDex, its licensors, or other providers of such material and are protected by international copyright, trademark, and other intellectual property laws."}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">{t("terms.disclaimer") || "Disclaimer"}</h2>
              <p>
                {t("terms.disclaimerText") ||
                  "DogDogDex is provided on an 'AS IS' and 'AS AVAILABLE' basis. DogDogDex makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights."}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {t("terms.limitation") || "Limitation of Liability"}
              </h2>
              <p>
                {t("terms.limitationText") ||
                  "In no event shall DogDogDex or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on DogDogDex."}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">{t("terms.contact") || "Contact Us"}</h2>
              <p>
                {t("terms.contactText") ||
                  "If you have any questions about these Terms of Service, please contact us at legal@dogdogdex.com."}
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
