"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ThumbsUp, ThumbsDown, Send } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { apiClient } from "@/lib/api-client"
import { useI18n } from "@/lib/i18n-context"

interface FeedbackFormProps {
  detectedBreed: string
  confidence: number
  imageUrl: string
  predictionId?: string | null
}

export function FeedbackForm({ detectedBreed, confidence, imageUrl, predictionId }: FeedbackFormProps) {
  const { t } = useI18n();
  const { user } = useAuth()
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [correctBreed, setCorrectBreed] = useState("")
  const [notes, setNotes] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      if (predictionId) {
        await apiClient.submitPredictionFeedback(predictionId, {
          isCorrect: isCorrect ?? false,
          submittedLabel: isCorrect ? undefined : correctBreed,
          notes: notes || undefined,
        })
      } else {
        // Fallback to localStorage if no prediction ID
        const feedback = {
          id: Date.now().toString(),
          predictionId: Date.now().toString(),
          detectedBreed,
          confidence,
          isCorrect: isCorrect ?? false,
          correctBreed: isCorrect ? detectedBreed : correctBreed,
          notes,
          timestamp: new Date().toISOString(),
          userId: user?.email || "anonymous",
          imageUrl,
        }

        const existingFeedback = localStorage.getItem("dogdex_feedback")
        const feedbackArray = existingFeedback ? JSON.parse(existingFeedback) : []
        feedbackArray.push(feedback)
        localStorage.setItem("dogdex_feedback", JSON.stringify(feedbackArray))
      }

      setSubmitted(true)
    } catch (error) {
      console.error("[v0] Failed to submit feedback:", error)
      alert(t('feedback.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className="border-2 border-primary">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Send className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('feedback.thankYou')}</h3>
            <p className="text-muted-foreground">
              {t('feedback.thankYouDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle>{t('feedback.title')}</CardTitle>
        <CardDescription>{t('feedback.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Correct/Incorrect Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t('feedback.wasCorrect')}</Label>
          <div className="flex gap-4">
            <Button
              variant={isCorrect === true ? "default" : "outline"}
              size="lg"
              className="flex-1 gap-2"
              onClick={() => setIsCorrect(true)}
            >
              <ThumbsUp className="h-5 w-5" />
              {t('feedback.yes')}
            </Button>
            <Button
              variant={isCorrect === false ? "default" : "outline"}
              size="lg"
              className="flex-1 gap-2"
              onClick={() => setIsCorrect(false)}
            >
              <ThumbsDown className="h-5 w-5" />
              {t('feedback.no')}
            </Button>
          </div>
        </div>

        {/* Correct Breed Input (shown if incorrect) */}
        {isCorrect === false && (
          <div className="space-y-2">
            <Label htmlFor="correct-breed" className="text-base font-semibold">
              {t('feedback.correctBreed')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="correct-breed"
              placeholder={t('feedback.selectBreed')}
              value={correctBreed}
              onChange={(e) => setCorrectBreed(e.target.value)}
              className="text-base"
            />
          </div>
        )}

        {/* Optional Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-base font-semibold">
            {t('feedback.additionalComments')}
          </Label>
          <Textarea
            id="notes"
            placeholder={t('feedback.commentsPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isCorrect === null || (isCorrect === false && !correctBreed.trim()) || isSubmitting}
          size="lg"
          className="w-full gap-2"
        >
          <Send className="h-5 w-5" />
          {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
        </Button>
      </CardContent>
    </Card>
  )
}
