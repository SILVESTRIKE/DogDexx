"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Lock, CheckCircle } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useEffect, useState, useMemo } from "react"
import { apiClient } from "@/lib/api-client"
import { format } from "date-fns"
import { useI18n } from "@/lib/i18n-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Định nghĩa kiểu dữ liệu cho response từ API
interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  requiredCount: number
  unlocked: boolean
  unlockedAt: string | null
}

interface AchievementsData {
  stats: {
    totalAchievements: number
    totalBreeds: number
    unlockedAchievements: number
    totalCollected: number
  }
  nextAchievement: {
    name: string
    requirement: number
    progress: number
  } | null
  achievements: Achievement[]
}

function AchievementsContent() {
  const [data, setData] = useState<AchievementsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t, locale } = useI18n()

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getAchievements(locale)
        setData(response)
      } catch (error) {
        console.error("Failed to fetch achievements:", error)
        setError("Could not load achievements. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchAchievements()
  }, [locale])

  // Sắp xếp thành tích: đã mở khóa lên trước, sau đó đến chưa mở khóa
  const sortedAchievements = useMemo(() => {
    if (!data?.achievements) return []
    return [...data.achievements].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1
      if (!a.unlocked && b.unlocked) return 1
      return a.requiredCount - b.requiredCount
    })
  }, [data?.achievements])

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">{t('common.loading')}</div>
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>
  }

  if (!data) {
    return null
  }

  const { stats, nextAchievement, achievements } = data

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-primary bg-card shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('achievements.backToHome')}
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Title */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold text-foreground">{t('achievements.title')}</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            {t('achievements.pageDescription')}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('achievements.dogsCollected')}</p>
                <p className="text-4xl font-bold text-primary">
                  {stats.totalCollected}/{stats.totalBreeds}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-chart-4 bg-chart-4/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('achievements.achievementsUnlocked')}</p>
                <p className="text-4xl font-bold text-chart-4">
                  {stats.unlockedAchievements}/{stats.totalAchievements}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-chart-1 bg-chart-1/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t('profile.stats.completion')}</p>
                <p className="text-4xl font-bold text-chart-1">
                  {stats.totalBreeds > 0 ? Math.round((stats.totalCollected / stats.totalBreeds) * 100) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Achievement Progress */}
        {nextAchievement && (
          <Card className="border-2 border-secondary mb-8 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {t('achievements.nextAchievement')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {/* <div className="text-5xl">{nextAchievement.icon}</div> */}
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{nextAchievement.name}</h3>
                  {/* <p className="text-muted-foreground mb-3">{nextAchievement.description}</p> */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{t('achievements.progress')}</span>
                      <span className="font-bold">
                        {nextAchievement.progress}/{nextAchievement.requirement}
                      </span>
                    </div>
                    <Progress value={(nextAchievement.progress / nextAchievement.requirement) * 100} className="h-3" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Achievements Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            {t('achievements.allAchievements')}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {sortedAchievements.map((achievement) => (
              <Card
                key={achievement.id}
                className={`border-2 transition-all ${
                  achievement.unlocked
                    ? "border-amber-500 bg-amber-500/10 shadow-lg"
                    : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className={`text-5xl ${achievement.unlocked ? "grayscale-0" : "grayscale opacity-40"}`}>
                        {achievement.icon}
                      </div>
                      {achievement.unlocked ? (
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-1">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 bg-muted text-muted-foreground rounded-full p-1">
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-lg">{achievement.title}</h3>
                        {achievement.unlocked && achievement.unlockedAt && (
                          <TooltipProvider>
                            <Tooltip><TooltipTrigger asChild><Badge variant="outline" className="ml-2 cursor-default bg-green-500/10 text-green-600 border-green-500/20">{t('achievements.unlocked')}</Badge></TooltipTrigger>
                              <TooltipContent><p>{format(new Date(achievement.unlockedAt), "MMM d, yyyy")}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                      <div>
                        <div className="flex items-center gap-2 text-sm">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          <span className="font-semibold ">
                            {achievement.unlocked ? t('achievements.completed') : t('achievements.collectCount').replace('{count}', String(achievement.requiredCount))}
                          </span>
                        </div>
                        {achievement.unlocked && achievement.unlockedAt && (
                          <p className="text-xs text-muted-foreground mt-1 pl-6">{format(new Date(achievement.unlockedAt), "MMM d, yyyy")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function AchievementsPage() {
  return (
    <ProtectedRoute>
      <AchievementsContent />
    </ProtectedRoute>
  )
}
