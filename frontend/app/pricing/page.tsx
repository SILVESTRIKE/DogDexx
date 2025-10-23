"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { useAuth } from "@/lib/auth-context"
import Footer from "@/components/footer"
import AdBanner from "@/components/ad-banner"
import { apiClient } from "@/lib/api-client"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface PricingPlan {
  slug: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  features: {
    name: string
    included: boolean
  }[]
  isFeatured?: boolean
}

export default function PricingPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiClient.request<any>("/bff/user/public/plans") // Sửa lại endpoint công khai
        const formattedPlans = response.data.map((plan: any) => ({
          slug: plan.slug,
          name: t(`pricing.${plan.slug}`) || plan.name,
          description: t(`pricing.${plan.slug}Description`) || `Description for ${plan.name}`,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          isFeatured: plan.slug === "professional",
          features: [
            { name: t("pricing.featureImageLimit", { count: plan.imageLimit }), included: true },
            { name: t("pricing.featureVideoLimit", { count: plan.videoLimit }), included: true },
            { name: t("pricing.featureStorage", { count: plan.storageLimitGB === -1 ? t("pricing.unlimited") : plan.storageLimitGB }), included: true },
            { name: t("pricing.apiAccess"), included: plan.apiAccess },
            { name: t("pricing.priority"), included: ["professional", "enterprise"].includes(plan.slug) },
            { name: t("pricing.customModels"), included: ["enterprise"].includes(plan.slug) },
          ],
        }))
        setPlans(formattedPlans)
      } catch (error) {
        console.error("Failed to fetch pricing plans:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchPlans()
  }, [t])

  const handleUpgrade = async (planId: string) => {
    if (!user) {
      const params = new URLSearchParams();
      params.set("auth", "login");
      // Chuyển hướng đến trang checkout sau khi đăng nhập
      params.set("redirect", `/checkout?plan=${planId}&period=${billingPeriod}`);
      router.push(`/?${params.toString()}`);
      return
    }
    // Nếu đã đăng nhập, chuyển thẳng đến trang checkout
    router.push(`/checkout?plan=${planId}&period=${billingPeriod}`);
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
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 min-h-[500px]">
            {loading && <p>{t("common.loading")}</p>}
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={`flex flex-col p-6 transition-all ${
                  plan.isFeatured ? "ring-2 ring-primary lg:scale-105" : ""
                }`}
              >
                {plan.isFeatured && (
                  <Badge className="mb-4 w-fit">{t("pricing.featured") || "Most Popular"}</Badge>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="text-4xl font-bold">${billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly}</div>
                  <p className="text-sm text-muted-foreground">{billingPeriod === "monthly" ? "/month" : "/year"}</p>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleUpgrade(plan.slug)}
                  variant={plan.isFeatured ? "default" : "outline"}
                  className="mb-6 w-full"
                  disabled={user?.plan === plan.slug}
                >
                  {user?.plan === plan.slug ? t("pricing.currentPlan") : plan.slug === "free" ? t("pricing.getStarted") : t("pricing.upgrade")}
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
