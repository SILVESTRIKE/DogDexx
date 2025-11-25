"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n-context"
import Footer from "@/components/footer"
import Link from "next/link"
import { Users, Zap, Shield, Globe, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react"

export default function AboutPage() {
  const { t } = useI18n()

  const stats = [
    { value: "99%", label: "Accuracy Rate" },
    { value: "200+", label: "Breeds Supported" },
    { value: "0.5s", label: "Processing Time" },
    { value: "24/7", label: "Availability" },
  ]

  const features = [
    {
      icon: Zap,
      title: t("about.fastTitle") || "Lightning Fast",
      description: t("about.fastDesc") || "Real-time dog breed detection powered by advanced AI models.",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10"
    },
    {
      icon: Shield,
      title: t("about.secureTitle") || "Secure & Private",
      description: t("about.secureDesc") || "Your data is encrypted. Images are processed securely.",
      color: "text-green-400",
      bg: "bg-green-400/10"
    },
    {
      icon: Users,
      title: t("about.communityTitle") || "Community Driven",
      description: t("about.communityDesc") || "Join thousands of dog lovers improving AI together.",
      color: "text-blue-400",
      bg: "bg-blue-400/10"
    },
    {
      icon: Globe,
      title: t("about.globalTitle") || "Global Scale",
      description: t("about.globalDesc") || "Supports dog breeds from every corner of the world.",
      color: "text-purple-400",
      bg: "bg-purple-400/10"
    },
  ]

  return (
    <>
      <main className="min-h-screen relative overflow-hidden">
        {/* 1. BACKGROUND EFFECTS (Consistent with Home) */}
        <div className="fixed inset-0 -z-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] opacity-40" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-30" />
        </div>

        <div className="container mx-auto px-4 py-12 md:py-6">
          {/* 2. HERO SECTION */}
          <div className="text-center mb-6 md:mb-12">
            
            <h1 className="text-2xl md:text-5xl font-extrabold mb-6 text-balance tracking-tight">
              {t("about.title") || "Revolutionizing"} <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-600">
                Dog Identification
              </span>
            </h1>
            <p className="text-md md:text-lg text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
              {t("about.subtitle") || "Merging cutting-edge Artificial Intelligence with our love for dogs to create the ultimate breed encyclopedia."}
            </p>
          </div>

          {/* 3. MISSION SECTION (Glass Card) */}
          <div className="relative max-w-4xl mx-auto mb-12">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 rounded-[2rem] blur opacity-20"></div>
            <Card className="relative p-8 md:p-12 bg-background/60 backdrop-blur-xl border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                            <Sparkles className="text-primary h-6 w-6" />
                            {t("about.mission") || "Our Mission"}
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                            {t("about.missionText") ||
                            "We believe that technology should make the world more connected. DogDex uses cutting-edge AI to help dog lovers, veterinarians, and researchers identify dog breeds instantly."}
                        </p>
                        <ul className="space-y-3">
                            {['Instant Results', 'High Accuracy', 'Free to Use'].map((item) => (
                                <li key={item} className="flex items-center gap-2 text-sm font-medium">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {/* Stats Grid within Mission */}
                    <div className="grid grid-cols-2 gap-4">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="p-6 rounded-2xl bg-secondary/50 border border-border/50 text-center">
                                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
          </div>

          {/* 4. FEATURES GRID */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div key={idx} className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-lg">
                  <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>

          {/* 5. TEAM SECTION (Simplified) */}
          <div className="text-center mb-24">
            <h2 className="text-3xl font-bold mb-6">{t("about.team") || "Who We Are"}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              {t("about.teamText") ||
                "Built by a passionate team of AI researchers, dog lovers, and software engineers dedicated to creating the best dog breed identification experience on the web."}
            </p>
          </div>

          {/* 6. CTA SECTION */}
          <div className="relative rounded-3xl overflow-hidden bg-primary text-primary-foreground px-6 py-16 text-center max-w-4xl mx-auto">
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            
            <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-6">{t("about.ready") || "Ready to try DogDex?"}</h2>
                <p className="text-primary-foreground/80 max-w-lg mx-auto mb-8 text-lg">
                    Join thousands of users exploring the world of dog breeds today.
                </p>
                <Link href="/">
                <Button size="lg" variant="secondary" className="group h-14 px-8 text-lg rounded-full shadow-lg">
                    {t("common.getStarted") || "Start Identifying"}
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}