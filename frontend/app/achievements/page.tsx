"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Trophy, Lock, CheckCircle, Dog, Medal, Star, ArrowUpCircle } from "lucide-react"
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
    return (
      <div className="flex justify-center items-center min-h-screen">
         <div className="flex items-center gap-2">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">{t('common.loading')}</span>
         </div>
      </div>
    )
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-destructive">{error}</div>
  }

  if (!data) {
    return null
  }

  const { stats, nextAchievement, achievements } = data

  return (
    <main className="min-h-screen relative overflow-hidden bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl relative z-10">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-full bg-primary/10 text-amber-500 animate-in zoom-in duration-500">
             <Trophy className="h-10 w-10" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight text-balance">
            {t('achievements.title')}
          </h1>
          <p className="text-lg text-muted-foreground text-balance max-w-2xl mx-auto">
            {t('achievements.pageDescription')}
          </p>
        </div>

        {/* STATS OVERVIEW - Màu sắc sống động như bản gốc */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Primary Color (Dogs Collected) */}
          <Card className="border-2 border-primary bg-primary/10 hover:bg-primary/15 transition-colors duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 p-3 rounded-full bg-primary/20 text-primary">
                  <Dog className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('achievements.dogsCollected')}</p>
                <p className="text-4xl font-bold text-primary">
                  {stats.totalCollected}<span className="text-xl opacity-70">/{stats.totalBreeds}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Orange/Chart-4 Color (Achievements) */}
          <Card className="border-2 border-orange-500 bg-orange-500/10 hover:bg-orange-500/15 transition-colors duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 p-3 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400">
                  <Medal className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('achievements.achievementsUnlocked')}</p>
                <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.unlockedAchievements}<span className="text-xl opacity-70">/{stats.totalAchievements}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Red/Chart-1 Color (Completion) */}
          <Card className="border-2 border-rose-500 bg-rose-500/10 hover:bg-rose-500/15 transition-colors duration-300">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 p-3 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400">
                  <Star className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{t('profile.stats.completion')}</p>
                <p className="text-4xl font-bold text-rose-600 dark:text-rose-400">
                  {stats.totalBreeds > 0 ? Math.round((stats.totalCollected / stats.totalBreeds) * 100) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* NEXT ACHIEVEMENT */}
        {nextAchievement && (
          <div className="mb-12 relative group">
             {/* Glow effect */}
             <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-violet-500 rounded-[1.2rem] blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
             
             <Card className="relative border-2 border-primary/50 bg-gradient-to-br from-background via-background to-secondary/20 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-chart-2">
                    <ArrowUpCircle className="h-5 w-5" />
                    {t('achievements.nextAchievement')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full">
                      <h3 className="text-2xl font-bold mb-2">{nextAchievement.name}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm font-medium">
                          <span>{t('achievements.progress')}</span>
                          <span className="font-bold text-primary">{nextAchievement.progress} / {nextAchievement.requirement}</span>
                        </div>
                        <Progress value={(nextAchievement.progress / nextAchievement.requirement) * 100} className="h-4 border border-primary/20 bg-secondary [&>div]:bg-primary" />
                      </div>
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>
        )}

        {/* ALL ACHIEVEMENTS GRID */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">{t('achievements.allAchievements')}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {sortedAchievements.map((achievement) => (
              <Card
                key={achievement.id}
                className={`border-2 transition-all duration-300 relative overflow-hidden group ${
                  achievement.unlocked
                    ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5 hover:bg-amber-500/20"
                    : "border-border bg-muted/40 opacity-70 hover:opacity-100 hover:border-primary/50"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-5">
                    {/* Icon Container */}
                    <div className="relative flex-shrink-0">
                      <div className={`
                        w-16 h-16 text-4xl flex items-center justify-center rounded-2xl transition-all duration-300
                        ${achievement.unlocked 
                          ? "grayscale-0 scale-110 drop-shadow-md" 
                          : "grayscale opacity-50 bg-background/50"}
                      `}>
                        {achievement.icon}
                      </div>
                      
                      {/* Status Icon */}
                      <div className={`absolute -top-2 -right-2 p-1 rounded-full shadow-sm border-2 border-background ${
                        achievement.unlocked ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {achievement.unlocked ? <CheckCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <h3 className="text-lg font-bold truncate pr-2">
                          {achievement.title}
                        </h3>
                        {achievement.unlocked && achievement.unlockedAt && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-default bg-background/50 text-amber-600 border-amber-500/30">
                                  {t('achievements.unlocked')}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{format(new Date(achievement.unlockedAt), "MMM d, yyyy")}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {achievement.description}
                      </p>
                      
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Trophy className={`h-4 w-4 ${achievement.unlocked ? "text-amber-500" : "text-muted-foreground"}`} />
                        <span className={achievement.unlocked ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                          {achievement.unlocked 
                            ? t('achievements.completed')
                            : t('achievements.collectCount').replace('{count}', String(achievement.requiredCount))
                          }
                        </span>
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