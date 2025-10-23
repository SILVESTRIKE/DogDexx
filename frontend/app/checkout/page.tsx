"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import Footer from "@/components/footer"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const planId = searchParams.get("plan")
  const billingPeriod = (searchParams.get("period") as "monthly" | "yearly") || "monthly"

  const plans: Record<string, any> = {
    free: { name: t("pricing.free"), priceMonthly: 0, priceYearly: 0 },
    starter: { name: t("pricing.starter"), priceMonthly: 9.99, priceYearly: 99.9 },
    professional: { name: t("pricing.professional"), priceMonthly: 29.99, priceYearly: 299.9 },
    enterprise: { name: t("pricing.enterprise"), priceMonthly: 99.99, priceYearly: 999.9 },
  }

  const selectedPlan = plans[planId || "starter"]

  useEffect(() => {
    if (!user) {
      router.push("/")
    }
  }, [user, router])

  const handleCheckout = async () => {
    if (!planId) return

    setLoading(true)
    setError("")

    try {
      const { payUrl } = await apiClient.createCheckoutSession(planId, billingPeriod)
      window.location.href = payUrl;
    } catch (err: any) {
      toast.error(t("checkout.failed"), { description: err.message });
      setError(err.message || "Checkout failed")
    } finally {
      setLoading(false)
    }
  }

  const price = billingPeriod === "monthly" ? selectedPlan.priceMonthly : selectedPlan.priceYearly;
  const formattedPrice = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(price);

  if (!user || !planId || !plans[planId]) {
    return null
  }

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <Link href="/pricing" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            {t("common.back") || "Back"}
          </Link>

          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-8">{t("checkout.title") || "Checkout"}</h1>

            {/* Order Summary */}
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold mb-6">{t("checkout.orderSummary") || "Order Summary"}</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span>{selectedPlan.name}</span>
                  <span className="font-semibold">{formattedPrice}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{billingPeriod === "monthly" ? t("pricing.monthly") : t("pricing.yearly")}</span>
                </div>
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("checkout.total") || "Total"}</span>
                  <span>${selectedPlan.price}</span>
                </div>
              </div>
            </Card>

            {/* Billing Information */}
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold mb-6">{t("checkout.billingInfo") || "Billing Information"}</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t("checkout.email") || "Email"}</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-muted"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("checkout.cardInfo") || "Card Information"}
                  </label>
                  <div className="p-4 border rounded-lg bg-muted text-sm text-muted-foreground">
                    {t("checkout.cardPlaceholder") || "Card payment form would be integrated here with Stripe"}
                  </div>
                </div>
              </div>
            </Card>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Link href="/pricing" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  {t("common.cancel") || "Cancel"}
                </Button>
              </Link>
              <Button onClick={handleCheckout} disabled={loading} className="flex-1">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("checkout.pay") || "Pay"} {formattedPrice}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
