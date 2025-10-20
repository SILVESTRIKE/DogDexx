"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { useAuth } from "@/lib/auth-context"
import Footer from "@/components/footer"
import AdBanner from "@/components/ad-banner"
import Link from "next/link"

interface PricingPlan {
  id: string
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
  }
  features: {
    name: string
    included: boolean
  }[]
}

export default function PricingPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")

  const plans: PricingPlan[] = [
    {
      id: "free",
      name: t("pricing.free"),
      description: t("pricing.freeDescription"),
      price: { monthly: 0, yearly: 0 },
      features: [
        { name: "10 detections/month", included: true },
        { name: "1GB storage", included: true },
        { name: "Basic support", included: true },
        { name: t("pricing.apiAccess"), included: false },
        { name: t("pricing.priority"), included: false },
        { name: t("pricing.customModels"), included: false },
      ],
    },
    {
      id: "starter",
      name: t("pricing.starter"),
      description: t("pricing.starterDescription"),
      price: { monthly: 9.99, yearly: 99.9 },
      features: [
        { name: "100 detections/month", included: true },
        { name: "10GB storage", included: true },
        { name: "Email support", included: true },
        { name: t("pricing.apiAccess"), included: true },
        { name: t("pricing.priority"), included: false },
        { name: t("pricing.customModels"), included: false },
      ],
    },
    {
      id: "professional",
      name: t("pricing.professional"),
      description: t("pricing.professionalDescription"),
      price: { monthly: 29.99, yearly: 299.9 },
      features: [
        { name: t("pricing.unlimited") + " detections", included: true },
        { name: "100GB storage", included: true },
        { name: t("pricing.priority") + " support", included: true },
        { name: t("pricing.apiAccess"), included: true },
        { name: "Advanced analytics", included: true },
        { name: t("pricing.customModels"), included: false },
      ],
    },
    {
      id: "enterprise",
      name: t("pricing.enterprise"),
      description: t("pricing.enterpriseDescription"),
      price: { monthly: 99.99, yearly: 999.9 },
      features: [
        { name: t("pricing.unlimited") + " detections", included: true },
        { name: t("pricing.unlimited") + " storage", included: true },
        { name: "24/7 dedicated support", included: true },
        { name: t("pricing.apiAccess"), included: true },
        { name: "Advanced analytics", included: true },
        { name: t("pricing.customModels"), included: true },
      ],
    },
  ]

  const handleUpgrade = (planId: string) => {
    if (!user) {
      alert(t("auth.loginTitle"))
      return
    }
    // TODO: Integrate with Stripe payment
    console.log(`Upgrading to ${planId}`)
  }

  return (
    <>
      <AdBanner />
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 text-balance">{t("pricing.title")}</h1>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto mb-8">
              {t("pricing.description")}
            </p>

            {/* Billing Toggle */}
            <div className="flex justify-center gap-4 mb-12">
              <Button
                variant={billingPeriod === "monthly" ? "default" : "outline"}
                onClick={() => setBillingPeriod("monthly")}
              >
                {t("pricing.monthly")}
              </Button>
              <Button
                variant={billingPeriod === "yearly" ? "default" : "outline"}
                onClick={() => setBillingPeriod("yearly")}
              >
                {t("pricing.yearly")}
                <Badge variant="secondary" className="ml-2">
                  {t("pricing.save")}
                </Badge>
              </Button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`flex flex-col p-6 transition-all ${
                  plan.id === "professional" ? "ring-2 ring-primary lg:scale-105" : ""
                }`}
              >
                {plan.id === "professional" && (
                  <Badge className="mb-4 w-fit">{t("pricing.featured") || "Most Popular"}</Badge>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="text-4xl font-bold">
                    ${billingPeriod === "monthly" ? plan.price.monthly : plan.price.yearly}
                  </div>
                  <p className="text-sm text-muted-foreground">{billingPeriod === "monthly" ? "/month" : "/year"}</p>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  variant={plan.id === "professional" ? "default" : "outline"}
                  className="mb-6 w-full"
                >
                  {plan.id === "free" ? t("common.getStarted") || "Get Started" : t("pricing.upgrade")}
                </Button>

                {/* Features */}
                <div className="space-y-3 flex-1">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${feature.included ? "" : "text-muted-foreground"}`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">{t("pricing.faq") || "Frequently Asked Questions"}</h2>

            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ1") || "Can I change my plan anytime?"}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA1") ||
                    "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately."}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ2") || "What payment methods do you accept?"}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA2") || "We accept all major credit cards, PayPal, and bank transfers for enterprise."}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ3") || "Is there a free trial?"}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA3") ||
                    "Yes, the Free plan includes 10 detections per month with no credit card required."}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ4") || "Do you offer refunds?"}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA4") || "We offer a 30-day money-back guarantee for all paid plans."}
                </p>
              </Card>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <h2 className="text-3xl font-bold mb-4">{t("pricing.ready") || "Ready to get started?"}</h2>
            <p className="text-muted-foreground mb-6">
              {t("pricing.readyDescription") || "Join thousands of users detecting dog breeds with AI"}
            </p>
            <Link href="/">
              <Button size="lg">{t("pricing.startFree") || "Start Free"}</Button>
            </Link>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-12 pb-12 border-b">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">{t("footer.adSection1Title") || "Premium Features"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection1Description") || "Unlock unlimited detections and advanced analytics"}
            </p>
            <Link href="/pricing" className="text-primary text-sm font-medium hover:underline">
              {t("footer.learnMore") || "Learn More"} →
            </Link>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">{t("footer.adSection2Title") || "API Access"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection2Description") || "Integrate dog detection into your applications"}
            </p>
            <Link href="/pricing" className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              {t("footer.learnMore") || "Learn More"} →
            </Link>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">{t("footer.adSection3Title") || "Enterprise"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection3Description") || "Custom solutions for large-scale deployments"}
            </p>
            <Link href="/pricing" className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">
              {t("footer.learnMore") || "Learn More"} →
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
