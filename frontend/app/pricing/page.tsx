"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/types";

export default function PricingPage() {
  const { t } = useI18n();
  const { user, setAuthModalOpen, setAuthModalMode } = useAuth();
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiClient.getPublicPlans();
        const plansWithFeatures = response.data.map((plan: Plan) => {
          return {
            ...plan,
            name: t(`pricing.${plan.slug}`) || plan.name,
            description:
              t(`pricing.${plan.slug}Description`) ||
              `Description for ${plan.name}`,
            features: [
              {
                name: t("pricing.featureTokenLimit", {
                  count: plan.tokenAllotment,
                }),
                included: true,
              },
              {
                name: t("pricing.featureStorage"),
                included: plan.slug !== "free",
              },
              { name: t("pricing.apiAccess"), included: plan.apiAccess },
              {
                name: t("pricing.priority"),
                included: ["professional", "enterprise"].includes(plan.slug),
              },
              {
                name: t("pricing.customModels"),
                included: ["enterprise"].includes(plan.slug),
              },
            ],
          };
        });
        setPlans(plansWithFeatures);
      } catch (error) {
        console.error("Failed to fetch pricing plans:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [t]);

  const handleUpgrade = async (planSlug: string) => {
    if (!user || !user.email) {
      setAuthModalMode("login");
      setAuthModalOpen(true);
      return;
    }

    const isCurrentPlan = user.plan === planSlug;

    if (isCurrentPlan) {
      router.push("/");
    } else {
      router.push(`/checkout?plan=${planSlug}&period=${billingPeriod}`);
    }
  };

  const getCurrentUserPlanPrice = () => {
    if (!user || !user.plan) return 0;
    const currentPlan = plans.find((p) => p.slug === user.plan);
    if (!currentPlan) return 0;
    return billingPeriod === "monthly"
      ? currentPlan.priceMonthly
      : currentPlan.priceYearly;
  };

  const currentUserPrice = getCurrentUserPlanPrice();

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 text-balance">
              {t("pricing.title")}
            </h1>
            <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto mb-8">
              {t("pricing.description")}
            </p>

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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 min-h-[500px]">
            {loading && (
              <div className="col-span-4 flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!loading &&
              plans.map((plan) => {
                const isCurrentPlan = user && user.plan === plan.slug;
                const isEffectiveCurrent =
                  isCurrentPlan ||
                  (!!user && !user.plan && plan.slug === "free");
                const thisPlanPrice =
                  billingPeriod === "monthly"
                    ? plan.priceMonthly
                    : plan.priceYearly;

                const isLowerTier = !!user && thisPlanPrice < currentUserPrice;
                const isDisabled = isLowerTier;

                return (
                  <Card
                    key={plan.slug}
                    className={`flex flex-col p-6 transition-all relative ${isEffectiveCurrent
                        ? "ring-2 ring-primary shadow-lg lg:scale-105 z-10"
                        : isLowerTier
                          ? "opacity-75 grayscale-[0.5] border-border/50"
                          : "hover:shadow-md"
                      }`}
                  >
                    {plan.slug === "professional" &&
                      !isEffectiveCurrent &&
                      !isLowerTier && (
                        <Badge className="absolute -top-3 right-4 bg-blue-600 hover:bg-blue-700">
                          {t("pricing.professional")}
                        </Badge>
                      )}

                    {isEffectiveCurrent && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1">
                        {t("pricing.currentPlan")}
                      </Badge>
                    )}

                    <h3 className="text-2xl font-bold mb-2 mt-2">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 min-h-10">
                      {plan.description}
                    </p>

                    <div className="mb-6">
                      <div className="text-4xl font-bold">
                        {new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                        }).format(thisPlanPrice)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {billingPeriod === "monthly"
                          ? t("pricing.perMonth")
                          : t("pricing.perYear")}
                      </p>
                    </div>

                    <Button
                      onClick={() => handleUpgrade(plan.slug)}
                      variant={
                        isEffectiveCurrent
                          ? "default"
                          : isLowerTier
                            ? "ghost"
                            : "default"
                      }
                      className={`mb-6 w-full ${isLowerTier
                          ? "bg-muted/50 text-muted-foreground hover:bg-muted/50 cursor-not-allowed"
                          : ""
                        }`}
                      disabled={isDisabled}
                    >
                      {(() => {
                        if (isEffectiveCurrent) return t("pricing.getStarted");

                        if (isLowerTier) return "Gói thấp hơn";

                        return t("pricing.upgrade");
                      })()}
                    </Button>

                    <div className="space-y-3 flex-1 pt-4 border-t">
                      {plan.features?.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          {feature.included ? (
                            <Check
                              className={`h-5 w-5 shrink-0 mt-0.5 ${isLowerTier
                                  ? "text-muted-foreground"
                                  : "text-green-500"
                                }`}
                            />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <span
                            className={`text-sm ${feature.included && !isLowerTier
                                ? ""
                                : "text-muted-foreground"
                              }`}
                          >
                            {feature.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
          </div>

          {/* ... Phần FAQ và Footer giữ nguyên ... */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              {t("pricing.faq")}
            </h2>
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
                <p className="text-sm text-muted-foreground">{t("faqA4")}</p>
              </Card>
            </div>
          </div>

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

        <div className="grid md:grid-cols-3 gap-6 pb-12 border-b container mx-auto px-4">
          <div className="bg-linear-to-br from-primary/10 to-primary/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">
              {t("footer.adSection1Title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection1Description")}
            </p>
            <Link
              href="/pricing"
              className="text-primary text-sm font-medium hover:underline"
            >
              {t("footer.learnMore")} →
            </Link>
          </div>
          <div className="bg-linear-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">
              {t("footer.adSection2Title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection2Description")}
            </p>
            <Link
              href="/pricing"
              className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
            >
              {t("footer.learnMore")} →
            </Link>
          </div>
          <div className="bg-linear-to-br from-green-500/10 to-green-500/5 rounded-lg p-6 text-center">
            <h3 className="font-semibold mb-2">
              {t("footer.adSection3Title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("footer.adSection3Description")}
            </p>
            <Link
              href="/pricing"
              className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline"
            >
              {t("footer.learnMore")} →
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
