"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, Brain, TrendingUp, AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

interface Feedback {
  id: string
  isCorrect: boolean
  correctBreed: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalVisits: 0,
    totalPredictions: 0,
    totalUsers: 0,
    activeModel: "YOLOv8-Dog-Detector",
  })
  const [newBreedAlerts, setNewBreedAlerts] = useState<Array<{ breed: string; count: number }>>([])

  useEffect(() => {
    // Load stats from localStorage
    const visits = localStorage.getItem("dogdex_visits") || "0"
    const predictions = localStorage.getItem("dogdex_predictions") || "0"
    const users = localStorage.getItem("dogdex_users")
    const userCount = users ? JSON.parse(users).length : 0

    setStats({
      totalVisits: Number.parseInt(visits),
      totalPredictions: Number.parseInt(predictions),
      totalUsers: userCount,
      activeModel: "YOLOv8-Dog-Detector",
    })

    const feedbackData = localStorage.getItem("dogdex_feedback")
    if (feedbackData) {
      const feedback: Feedback[] = JSON.parse(feedbackData)
      const incorrectByBreed = feedback
        .filter((f) => !f.isCorrect)
        .reduce(
          (acc, f) => {
            const breed = f.correctBreed.toLowerCase().trim()
            if (!acc[breed]) {
              acc[breed] = 0
            }
            acc[breed]++
            return acc
          },
          {} as Record<string, number>,
        )

      const alerts = Object.entries(incorrectByBreed)
        .filter(([_, count]) => count >= 5)
        .map(([breed, count]) => ({ breed, count }))
        .sort((a, b) => b.count - a.count)

      setNewBreedAlerts(alerts)
    }
  }, [])

  // Mock chart data
  const chartData = [
    { date: "Mon", predictions: 12, visits: 45 },
    { date: "Tue", predictions: 19, visits: 62 },
    { date: "Wed", predictions: 15, visits: 58 },
    { date: "Thu", predictions: 25, visits: 71 },
    { date: "Fri", predictions: 22, visits: 68 },
    { date: "Sat", predictions: 30, visits: 89 },
    { date: "Sun", predictions: 28, visits: 82 },
  ]

  const chartConfig = {
    predictions: {
      label: "Predictions",
      color: "hsl(220 90% 56%)",
    },
    visits: {
      label: "Visits",
      color: "hsl(220 70% 70%)",
    },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">Monitor your app's performance and usage statistics</p>
      </div>

      {newBreedAlerts.length > 0 && (
        <Card className="border-2 border-orange-500 bg-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-600">Cảnh báo giống chó mới</CardTitle>
              </div>
              <Badge variant="destructive" className="text-sm">
                {newBreedAlerts.length} giống
              </Badge>
            </div>
            <CardDescription>
              Phát hiện {newBreedAlerts.length} giống chó có nhiều báo cáo sai - có thể cần thêm vào model
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {newBreedAlerts.slice(0, 3).map((alert) => (
                <div key={alert.breed} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-semibold capitalize">{alert.breed}</p>
                    <p className="text-sm text-muted-foreground">{alert.count} báo cáo sai</p>
                  </div>
                  {alert.count >= 200 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Cần train ngay
                    </Badge>
                  )}
                </div>
              ))}
              <Link href="/admin/feedback">
                <Button variant="outline" className="w-full bg-transparent">
                  Xem tất cả phản hồi
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+12% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPredictions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+8% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">+3 new this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Model</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sm">{stats.activeModel}</div>
            <p className="text-xs text-muted-foreground">Running smoothly</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>Predictions and visits over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData} width={500} height={300}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="predictions"
                  stroke="hsl(220 90% 56%)"
                  fill="hsl(220 90% 56%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="hsl(220 70% 70%)"
                  fill="hsl(220 70% 70%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system health and performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Response Time</span>
                <span className="text-sm text-muted-foreground">125ms</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[85%]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Model Accuracy</span>
                <span className="text-sm text-muted-foreground">94.2%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-secondary w-[94%]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Server Uptime</span>
                <span className="text-sm text-muted-foreground">99.9%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent w-[99%]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
