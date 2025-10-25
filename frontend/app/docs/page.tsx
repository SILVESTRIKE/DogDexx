"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n-context"
import Footer from "@/components/footer"

export default function DocsPage() {
  const { t } = useI18n()
  const [expandedSection, setExpandedSection] = useState<string | null>("getting-started")

  const sections = [
    {
      id: "getting-started",
      title: t("docs.gettingStarted") || "Getting Started",
      content: [
        {
          heading: t("docs.createAccount") || "Create an Account",
          text: t("docs.createAccountText") || "Sign up for free to start detecting dog breeds instantly.",
        },
        {
          heading: t("docs.uploadImage") || "Upload an Image",
          text: t("docs.uploadImageText") || "Upload a photo of a dog and our AI will identify the breed.",
        },
        {
          heading: t("docs.viewResults") || "View Results",
          text: t("docs.viewResultsText") || "Get instant results with confidence scores and detailed information.",
        },
      ],
    },
    {
      id: "features",
      title: t("docs.features") || "Features",
      content: [
        {
          heading: t("docs.realTimeDetection") || "Real-time Detection",
          text: t("docs.realTimeDetectionText") || "Detect dog breeds from images and videos in real-time.",
        },
        {
          heading: t("docs.collection") || "Collection Management",
          text: t("docs.collectionText") || "Build your personal collection of detected dog breeds.",
        },
        {
          heading: t("docs.achievements") || "Achievements",
          text: t("docs.achievementsText") || "Unlock achievements as you discover new breeds.",
        },
      ],
    },
    {
      id: "faq",
      title: t("docs.faq") || "FAQ",
      content: [
        {
          heading: t("docs.faqQ1") || "How accurate is the detection?",
          text: t("docs.faqA1") || "Our AI model achieves 95%+ accuracy on standard dog breed datasets.",
        },
        {
          heading: t("docs.faqQ2") || "What formats are supported?",
          text: t("docs.faqA2") || "We support JPG, PNG, GIF for images and MP4, WebM for videos.",
        },
        {
          heading: t("docs.faqQ3") || "Is my data private?",
          text: t("docs.faqA3") || "Yes, all data is encrypted and never shared with third parties.",
        },
      ],
    },
  ]

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-8">{t("docs.title") || "Documentation"}</h1>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="md:col-span-1">
              <div className="sticky top-4 space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      expandedSection === section.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="md:col-span-2 space-y-6">
              {sections.map(
                (section) =>
                  expandedSection === section.id && (
                    <div key={section.id}>
                      <h2 className="text-2xl font-bold mb-4">{section.title}</h2>
                      <div className="space-y-4">
                        {section.content.map((item, idx) => (
                          <Card key={idx} className="p-6">
                            <h3 className="font-bold mb-2">{item.heading}</h3>
                            <p className="text-muted-foreground">{item.text}</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ),
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
