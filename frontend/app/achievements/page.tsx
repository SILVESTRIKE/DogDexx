"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useCollection } from "@/lib/collection-context"
import { getNextAchievement } from "@/lib/achievements"
import { ArrowLeft, Trophy, Lock, CheckCircle } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"

function AchievementsContent() {
  const { collectionCount, unlockedAchievements } = useCollection()
  const [totalBreeds, setTotalBreeds] = useState(0)
  const nextAchievement = getNextAchievement(collectionCount)
  const unlockedCount = unlockedAchievements.filter((a) => a.unlocked).length

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const response = await apiClient.getPokedex({ limit: 1 })
        setTotalBreeds(response.total || 0)
      } catch (error) {
        console.error("[v0] Failed to fetch total count:", error)
      }
    }

    fetchTotalCount()
  }, [])

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
            Back to DogDex
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Title */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-12 w-12 text-primary" />
            <h1 className="text-5xl font-bold text-foreground">Achievements</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Track your progress and unlock rewards as you collect dog breeds
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Dogs Collected</p>
                <p className="text-4xl font-bold text-primary">
                  {collectionCount}/{totalBreeds}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-secondary bg-secondary/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Achievements Unlocked</p>
                <p className="text-4xl font-bold text-secondary">
                  {unlockedCount}/{unlockedAchievements.length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-accent bg-accent/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Completion</p>
                <p className="text-4xl font-bold text-accent">
                  {totalBreeds > 0 ? Math.round((collectionCount / totalBreeds) * 100) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Next Achievement Progress */}
        {nextAchievement && (
          <Card className="border-2 border-primary mb-8 bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Next Achievement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{nextAchievement.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{nextAchievement.title}</h3>
                  <p className="text-muted-foreground mb-3">{nextAchievement.description}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Progress</span>
                      <span className="font-bold">
                        {collectionCount}/{nextAchievement.requiredCount}
                      </span>
                    </div>
                    <Progress value={(collectionCount / nextAchievement.requiredCount) * 100} className="h-3" />
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
            All Achievements
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unlockedAchievements.map((achievement) => (
              <Card
                key={achievement.id}
                className={`border-2 transition-all ${
                  achievement.unlocked
                    ? "border-secondary bg-secondary/5 shadow-lg"
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
                        <div className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground rounded-full p-1">
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
                        {achievement.unlocked && (
                          <Badge variant="secondary" className="ml-2">
                            Unlocked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-semibold">
                          {achievement.unlocked ? "Completed" : `Collect ${achievement.requiredCount} dogs`}
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
