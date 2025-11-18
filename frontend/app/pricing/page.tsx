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

import type { Plan } from "@/lib/types"

export default function PricingPage() {
  const { t } = useI18n();
  const { user, setAuthModalOpen, setAuthModalMode } = useAuth();
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiClient.getPublicPlans()
        const plansWithFeatures = response.data.map((plan: Plan) => {
          // Thêm các trường description và features vào mỗi plan
          return {
            ...plan,
            name: t(`pricing.${plan.slug}`) || plan.name,
            description: t(`pricing.${plan.slug}Description`) || `Description for ${plan.name}`,
            isFeatured: plan.slug === "professional",
            features: [
              { name: t("pricing.featureTokenLimit", { count: plan.tokenAllotment }), included: true },
              { name: t("pricing.featureStorage"), included: plan.slug !== 'free' },
              { name: t("pricing.apiAccess"), included: plan.apiAccess },
              { name: t("pricing.priority"), included: ["professional", "enterprise"].includes(plan.slug) },
              { name: t("pricing.customModels"), included: ["enterprise"].includes(plan.slug) },
            ],
          }
        })
        setPlans(plansWithFeatures)
      } catch (error) {
        console.error("Failed to fetch pricing plans:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchPlans()
  }, [t])

  const handleUpgrade = async (planId: string) => {
    if (!user || !user.email) { // Kiểm tra user là khách hay chưa đăng nhập
      // Yêu cầu mở modal login
      setAuthModalMode("login");
      setAuthModalOpen(true);
      // Chuyển hướng người dùng về trang chủ, nơi modal sẽ xuất hiện.
      router.push("/");
      return;
    }
    // Nếu đã đăng nhập, chuyển thẳng đến trang checkout
    router.push(`/checkout?plan=${planId}&period=${billingPeriod}`);
  };

  return (
    <>
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
                  <Badge className="mb-4 w-fit">{t("pricing.professional")}</Badge>
                )}

                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="text-4xl font-bold">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {billingPeriod === "monthly" ? t("pricing.perMonth") : t("pricing.perYear")}
                  </p>
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
                  {plan.features?.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
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
            <h2 className="text-3xl font-bold mb-8 text-center">{t("pricing.faq")}</h2>

            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ1")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA1")}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ2")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA2")}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("pricing.faqQ3")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pricing.faqA3")}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-2">{t("faqQ4")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("faqA4")}
                </p>
              </Card>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <h2 className="text-3xl font-bold mb-4">{t("ready")}</h2>
            <p className="text-muted-foreground mb-6">
              {t("readyDescription")}
            </p>
            <Link href="/">
              <Button size="lg">{t("startFree")}</Button>
            </Link>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-12 pb-12 border-b">
          <div className="bg-linear-to-br from-primary/10 to-primary/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">{t("footer.adSection1Title")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection1Description")}
            </p>
            <Link href="/pricing" className="text-primary text-sm font-medium hover:underline">
              {t("footer.learnMore")} →
            </Link>
          </div>

          <div className="bg-linear-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">{t("footer.adSection2Title")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection2Description")}
            </p>
            <Link href="/pricing" className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
              {t("footer.learnMore")} →
            </Link>
          </div>

          <div className="bg-linear-to-br from-green-500/10 to-green-500/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">{t("footer.adSection3Title")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection3Description")}
            </p>
            <Link href="/pricing" className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">
              {t("footer.learnMore")} →
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
