"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, TrendingUp, HardDrive } from "lucide-react"
import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

interface UserUsage {
  userId: string
  userName: string
  email: string
  detections: number
  storageUsed: number
  storageLimit: number
  lastActive: string
  plan: "free" | "starter" | "professional" | "enterprise"
  trend: number
}

export default function UsagePage() {
  const { t } = useI18n()
  const [usageData, setUsageData] = useState<UserUsage[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("detections")
  const [isLoading, setIsLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    fetchUsageData()
  }, [])

  const fetchUsageData = async () => {
    try {
      setIsLoading(true)
      // SỬA LỖI: Gọi API thật để lấy dữ liệu
      const response = await apiClient.getAdminUsageStats();
      setUsageData(response.usageData || [])
      // Lấy dữ liệu biểu đồ từ API
      setChartData(response.chartData || [])
    } catch (error) {
      console.error("[v0] Error fetching usage data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredData = usageData
    .filter((user) => {
      const matchesSearch =
        user.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPlan = planFilter === "all" || user.plan === planFilter
      return matchesSearch && matchesPlan
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "detections":
          return b.detections - a.detections
        case "storage":
          return b.storageUsed - a.storageUsed
        case "lastActive":
          return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
        default:
          return 0
      }
    })

  const totalDetections = usageData.reduce((sum, user) => sum + user.detections, 0)
  const totalStorage = usageData.reduce((sum, user) => sum + user.storageUsed, 0)
  const avgDetectionsPerUser = usageData.length > 0 ? Math.round(totalDetections / usageData.length) : 0

  const handleExportReport = () => {
    const csv = [
      ["User Name", "Email", "Plan", "Detections", "Storage Used (GB)", "Storage Limit (GB)", "Last Active"],
      ...filteredData.map((user) => [
        user.userName,
        user.email,
        user.plan,
        user.detections,
        user.storageUsed,
        user.storageLimit,
        user.lastActive,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `usage-report-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("admin.usageTracking") || "Usage Tracking"}</h2>
          <p className="text-muted-foreground">
            {t("admin.usageTrackingDescription") || "Monitor user activity and resource consumption"}
          </p>
        </div>
        <Button onClick={handleExportReport} variant="outline" className="gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          {t("admin.exportReport") || "Export Report"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("admin.totalDetections") || "Total Detections"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalDetections.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t("admin.allTime") || "All time"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              {t("admin.totalStorage") || "Total Storage Used"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStorage.toFixed(1)} GB</div>
            <p className="text-xs text-muted-foreground">{t("admin.across") || "Across all users"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("admin.avgDetections") || "Avg Detections/User"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgDetectionsPerUser}</div>
            <p className="text-xs text-muted-foreground">{t("admin.perUser") || "Per user"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.detectionsOverTime") || "Detections Over Time"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                {/* <Legend /> */}
                <Line type="monotone" dataKey="detections" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.storageUsage") || "Storage Usage Over Time"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                {/* <Legend /> */}
                <Bar dataKey="detections" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.userUsageDetails") || "User Usage Details"}</CardTitle>
          <CardDescription>
            {t("admin.detailedBreakdown") || "Detailed breakdown of each user's resource consumption"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search") || "Search users..."}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.filterByPlan") || "Filter by plan"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all") || "All"}</SelectItem>
                <SelectItem value="free">{t("pricing.free") || "Free"}</SelectItem>
                <SelectItem value="starter">{t("pricing.starter") || "Starter"}</SelectItem>
                <SelectItem value="professional">{t("pricing.professional") || "Professional"}</SelectItem>
                <SelectItem value="enterprise">{t("pricing.enterprise") || "Enterprise"}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.sort") || "Sort by"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="detections">{t("admin.detections") || "Detections"}</SelectItem>
                <SelectItem value="storage">{t("admin.storage") || "Storage"}</SelectItem>
                <SelectItem value="lastActive">{t("admin.lastActive") || "Last Active"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name") || "Name"}</TableHead>
                  <TableHead>{t("common.email") || "Email"}</TableHead>
                  <TableHead>{t("admin.plan") || "Plan"}</TableHead>
                  <TableHead className="text-right">{t("admin.detections") || "Detections"}</TableHead>
                  <TableHead className="text-right">{t("admin.storage") || "Storage"}</TableHead>
                  <TableHead className="text-right">{t("admin.trend") || "Trend"}</TableHead>
                  <TableHead>{t("admin.lastActive") || "Last Active"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {t("common.loading") || "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("admin.noData") || "No data found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.userName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{user.detections.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{user.storageUsed.toFixed(1)} GB</span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round((user.storageUsed / user.storageLimit) * 100)}% of {user.storageLimit} GB
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={user.trend > 0 ? "default" : "secondary"}>
                          {user.trend > 0 ? "+" : ""}
                          {user.trend}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.lastActive}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
