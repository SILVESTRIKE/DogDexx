"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, Brain, TrendingUp, AlertTriangle, BarChart, ThumbsUp } from "lucide-react"
import { useEffect, useState } from "react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getAdminDashboardData, getSystemAlerts, DashboardData, SystemAlert, backupDatabase, restoreDatabase } from "@/lib/admin-api"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/lib/i18n-context"
import { Database, Download, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"

const initialDashboardData: DashboardData = {
  stats: {
    totalUsers: 0,
    totalPredictions: 0,
    totalFeedback: 0,
    accuracy: 0,
    todayVisits: 0,
    todayPredictions: 0,
  },
  charts: {
    weeklyActivity: [],
    topBreeds: [],
    accuracyTrend: [],
  },
}

export default function AdminDashboard() {
  const { t } = useI18n()
  const [dashboardData, setDashboardData] = useState<DashboardData>(initialDashboardData)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [dashboardRes, alertsRes] = await Promise.all([getAdminDashboardData(), getSystemAlerts()])
        setDashboardData(dashboardRes)
        setAlerts(alertsRes.alerts)
      } catch (error) {
        console.error("Failed to fetch admin data:", error)
        // Optionally, show a toast notification
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const { stats, charts } = dashboardData
  const chartData = charts.weeklyActivity.map((item) => ({
    date: new Date(item.day).toLocaleDateString("en-US", { weekday: "short" }),
    predictions: item.predictions,
    visits: item.visits,
  }))

  const chartConfig = {
    predictions: {
      label: "Predictions",
      color: "hsl(var(--chart-1))",
    },
    visits: {
      label: "Visits",
      color: "hsl(var(--chart-2))",
    },
  }


  const handleBackup = async () => {
    try {
      setIsBackingUp(true)
      const blob = await backupDatabase()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toISOString()}.archive`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Backup created successfully")
    } catch (error) {
      console.error("Backup failed:", error)
      toast.error("Failed to create backup")
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm("Are you sure you want to restore the database? This will overwrite current data.")) {
      e.target.value = ""
      return
    }

    try {
      setIsRestoring(true)
      await restoreDatabase(file)
      toast.success("Database restored successfully")
      // Refresh data after restore
      window.location.reload()
    } catch (error) {
      console.error("Restore failed:", error)
      toast.error("Failed to restore database")
    } finally {
      setIsRestoring(false)
      e.target.value = ""
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("admin.dashboardTitle")}</h2>
        <p className="text-muted-foreground">{t("admin.dashboardDescription")}</p>
      </div>

      {alerts.length > 0 && (
        <Card className="border-2 border-orange-500 bg-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-600">{t("admin.newBreedAlertTitle")}</CardTitle>
              </div>
              <Badge variant="destructive" className="text-sm">
                {alerts.length} giống
              </Badge>
            </div>
            <CardDescription>
              {t("admin.newBreedAlertDescription", { count: alerts.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <p className="font-semibold capitalize">{alert.id}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              ))}
              <Link href="/admin/feedback">
                <Button variant="outline" className="w-full bg-transparent">
                  {t("admin.viewAllFeedback")}
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
            <CardTitle className="text-sm font-medium">{t("admin.trialRunsToday")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.todayVisits.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">{t("admin.trialRunsDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.predictionsToday")}</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.todayPredictions.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">{t("admin.predictionsDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.totalUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{stats.totalUsers}</div>}
            <p className="text-xs text-muted-foreground">{t("admin.totalUsersDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.feedbackAccuracy")}</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.accuracy}%</div>
            )}
            <p className="text-xs text-muted-foreground">{t("admin.feedback.errors.approvalRateDescription")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.weeklyActivity")}</CardTitle>
            <CardDescription>{t("admin.weeklyActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="predictions"
                  stroke="var(--color-predictions)"
                  fill="var(--color-predictions)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.topPredictedBreeds")}</CardTitle>
            <CardDescription>{t("admin.topPredictedBreedsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
              : charts.topBreeds.map((breed) => (
                  <div key={breed.breed} className="flex items-center">
                    <p className="flex-1 capitalize text-sm font-medium">{breed.breed.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-2">
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t("admin.predictionsCount", { count: breed.count })}</span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>

      {/* Database Management Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Database Management</CardTitle>
          </div>
          <CardDescription>Backup and restore system data</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Button onClick={handleBackup} disabled={isBackingUp}>
            {isBackingUp ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Backup Database
              </>
            )}
          </Button>
          
          <div className="relative">
            <input
              type="file"
              id="restore-file"
              className="hidden"
              accept=".archive"
              onChange={handleRestore}
              disabled={isRestoring}
            />
            <Button variant="outline" disabled={isRestoring} asChild>
              <label htmlFor="restore-file" className="cursor-pointer">
                {isRestoring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Restore Database
                  </>
                )}
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
