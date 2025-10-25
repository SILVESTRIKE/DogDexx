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
import type { Plan } from "@/lib/types"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { t, locale } = useI18n()
  
  // Tách state loading cho từng mục đích
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  const planId = searchParams.get("plan")
  const billingPeriod = (searchParams.get("period") as "monthly" | "yearly") || "monthly"

  useEffect(() => {
    if (!user) {
      router.push("/")
      return;
    }

    if (!planId) {
      toast.error(t("checkout.failed"), { description: "Plan ID is missing." });
      router.push("/pricing");
      return;
    }

    const fetchPlanDetails = async () => {
      try {
        const response = await apiClient.getPublicPlanBySlug(planId);
        setSelectedPlan(response.data);
      } catch (err: any) {
        toast.error(t("checkout.failed"), { description: `Could not load plan details: ${err.message}` });
        setError(`Could not load plan details for "${planId}"`);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchPlanDetails();

  }, [user, router, planId, t])

  const handleCheckout = async () => {
    if (!planId) return

    setIsCheckingOut(true)
    setError("")

    try {
      const { payUrl } = await apiClient.createCheckoutSession(planId, billingPeriod)
      window.location.href = payUrl;
    } catch (err: any) {
      toast.error(t("checkout.failed"), { description: err.message });
      setError(err.message || "Checkout failed")
    } finally {
      setIsCheckingOut(false)
    }
  }

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || !planId || !selectedPlan) {
    return null
  }

  const price = billingPeriod === "monthly" ? selectedPlan.priceMonthly : selectedPlan.priceYearly;
  // Cập nhật định dạng tiền tệ sang VND
  const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

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
                  <span>{t(`pricing.${selectedPlan.slug}`) || selectedPlan.name}</span>
                  <span className="font-semibold">{formattedPrice}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{billingPeriod === "monthly" ? t("pricing.monthly") : t("pricing.yearly")}</span>
                </div>
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("checkout.total") || "Total"}</span>
                  <span>{formattedPrice}</span>
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
                    {t("checkout.cardPlaceholder") || "Bạn sẽ được chuyển hướng đến cổng thanh toán MoMo để hoàn tất giao dịch."}
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
              <Button onClick={handleCheckout} disabled={isCheckingOut} className="flex-1">
                {isCheckingOut && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
