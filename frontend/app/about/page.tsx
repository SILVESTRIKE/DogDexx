"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n-context"
import Footer from "@/components/footer"
import Link from "next/link"
import { Users, Zap, Shield, Globe } from "lucide-react"

export default function AboutPage() {
  const { t } = useI18n()

  const features = [
    {
      icon: Zap,
      title: t("about.fastTitle") || "Lightning Fast",
      description: t("about.fastDesc") || "Real-time dog breed detection powered by advanced AI",
    },
    {
      icon: Shield,
      title: t("about.secureTitle") || "Secure & Private",
      description: t("about.secureDesc") || "Your data is encrypted and never shared with third parties",
    },
    {
      icon: Users,
      title: t("about.communityTitle") || "Community Driven",
      description: t("about.communityDesc") || "Join thousands of dog lovers improving AI together",
    },
    {
      icon: Globe,
      title: t("about.globalTitle") || "Global Scale",
      description: t("about.globalDesc") || "Supports 200+ dog breeds from around the world",
    },
  ]

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4 text-balance">{t("about.title") || "About DogDogDex"}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              {t("about.subtitle") || "Revolutionizing dog breed identification with artificial intelligence"}
            </p>
          </div>

          {/* Mission Section */}
          <Card className="p-12 mb-16 bg-gradient-to-r from-primary/10 to-primary/5">
            <h2 className="text-3xl font-bold mb-4">{t("about.mission") || "Our Mission"}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("about.missionText") ||
                "We believe that technology should make the world more connected. DogDogDex uses cutting-edge AI to help dog lovers, veterinarians, and researchers identify dog breeds instantly. Our mission is to make dog breed identification accessible to everyone, everywhere."}
            </p>
          </Card>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <Card key={idx} className="p-6">
                  <Icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Card>
              )
            })}
          </div>

          {/* Team Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">{t("about.team") || "Our Team"}</h2>
            <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-8">
              {t("about.teamText") ||
                "Built by a passionate team of AI researchers, dog lovers, and software engineers dedicated to creating the best dog breed identification experience."}
            </p>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">{t("about.ready") || "Ready to get started?"}</h2>
            <Link href="/">
              <Button size="lg">{t("common.getStarted") || "Get Started"}</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
