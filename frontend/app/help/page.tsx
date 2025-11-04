"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n-context"
import Footer from "@/components/footer"
import { Mail, MessageSquare, HelpCircle } from "lucide-react"

export default function HelpPage() {
  const { t } = useI18n()

  const faqs = [
    {
      question: t("help.faqQ1") || "How do I reset my password?",
      answer:
        t("help.faqA1") || "Click 'Forgot Password' on the login page and follow the instructions sent to your email.",
    },
    {
      question: t("help.faqQ2") || "How do I delete my account?",
      answer: t("help.faqA2") || "Go to Settings > Account and click 'Delete Account'. This action cannot be undone.",
    },
    {
      question: t("help.faqQ3") || "Can I export my collection?",
      answer: t("help.faqA3") || "Yes, go to your Profile and click 'Export Collection' to download your data as CSV.",
    },
    {
      question: t("help.faqQ4") || "What should I do if detection is incorrect?",
      answer: t("help.faqA4") || "Click 'Report Issue' on the results page to help us improve our AI model.",
    },
  ]

  return (
    <>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-8">{t("help.title") || "Help & Support"}</h1>

          {/* Contact Options */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Card className="p-6 text-center">
              <Mail className="h-8 w-8 mx-auto mb-4 text-primary" />
              <h3 className="font-bold mb-2">{t("help.email") || "Email Support"}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("help.emailText") || "Get help via email within 24 hours"}
              </p>
              <Button variant="outline" className="w-full bg-transparent">
                {t("help.contactUs") || "Contact Us"}
              </Button>
            </Card>

            <Card className="p-6 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-4 text-primary" />
              <h3 className="font-bold mb-2">{t("help.chat") || "Live Chat"}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("help.chatText") || "Chat with our support team in real-time"}
              </p>
              <Button variant="outline" className="w-full bg-transparent">
                {t("help.startChat") || "Start Chat"}
              </Button>
            </Card>

            <Card className="p-6 text-center">
              <HelpCircle className="h-8 w-8 mx-auto mb-4 text-primary" />
              <h3 className="font-bold mb-2">{t("help.faq") || "FAQ"}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("help.faqText") || "Find answers to common questions"}
              </p>
              <Button variant="outline" className="w-full bg-transparent">
                {t("help.viewFaq") || "View FAQ"}
              </Button>
            </Card>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">{t("help.frequentlyAsked") || "Frequently Asked Questions"}</h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <Card key={idx} className="p-6">
                  <h3 className="font-bold mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Status Page */}
          <Card className="p-8 bg-gradient-to-r from-green-50 to-green-50 border-green-200">
            <h2 className="text-2xl font-bold mb-4">{t("help.systemStatus") || "System Status"}</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>{t("help.apiStatus") || "API Status"}</span>
                <span className="px-3 py-1 bg-green-500 text-white rounded text-sm">Operational</span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t("help.detectionService") || "Detection Service"}</span>
                <span className="px-3 py-1 bg-green-500 text-white rounded text-sm">Operational</span>
              </div>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  )
}
