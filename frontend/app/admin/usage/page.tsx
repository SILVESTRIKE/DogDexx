"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, TrendingUp, HardDrive } from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { useI18n } from "@/lib/i18n-context"
import { getAdminUsageStats, UserUsageData } from "@/lib/admin-api"
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

export default function UsagePage() {
  const { t } = useI18n()
  const [usageData, setUsageData] = useState<UserUsageData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("tokensUsed")
  const [isLoading, setIsLoading] = useState(true)
  const [tokensChartData, setTokensChartData] = useState<any[]>([])
  const [plansChartData, setPlansChartData] = useState<any[]>([])

  useEffect(() => {
    fetchUsageData()
  }, [])

  const fetchUsageData = async () => {
    try {
      setIsLoading(true)
      const response = await getAdminUsageStats();
      setUsageData(response.usageData || [])
      // Cập nhật state cho từng biểu đồ
      setTokensChartData(response.tokensChartData || [])
      setPlansChartData(response.plansChartData || [])
    } catch (error) {
      console.error("[v0] Error fetching usage data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAndSortedData = useMemo(() => {
    return usageData
      .filter((user) => {
        const searchLower = searchQuery.toLowerCase()
        const matchesSearch =
          user.userName.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        const matchesPlan = planFilter === "all" || user.plan.toLowerCase() === planFilter.toLowerCase()
        return matchesSearch && matchesPlan
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "tokensUsed":
            return b.tokensUsed - a.tokensUsed
          case "lastActive":
            return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
          default:
            return 0
        }
      })
  }, [usageData, searchQuery, planFilter, sortBy])

  const totalTokensUsed = usageData.reduce((sum, user) => sum + user.tokensUsed, 0)
  const totalUsers = usageData.length
  const avgTokensPerUser = totalUsers > 0 ? Math.round(totalTokensUsed / totalUsers) : 0

  const handleExportReport = () => {
    const csv = [
      ["User Name", "Email", "Plan", "Tokens Used", "Tokens Limit", "Last Active"],
      ...filteredAndSortedData.map((user) => [
        user.userName,
        user.email,
        user.plan,
        user.tokensUsed,
        user.tokensLimit,
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
          <h2 className="text-3xl font-bold tracking-tight">{t("admin.usageTracking")}</h2>
          <p className="text-muted-foreground">
            {t("admin.usageTrackingDescription")}
          </p>
        </div>
        <Button onClick={handleExportReport} variant="outline" className="gap-2 bg-transparent">
          <Download className="h-4 w-4" />
          {t("admin.exportReport")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("admin.usage.totalTokensUsed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTokensUsed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t("admin.allTime")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              {t("admin.totalUsers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t("admin.across")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("admin.usage.avgTokens")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgTokensPerUser}</div>
            <p className="text-xs text-muted-foreground">{t("admin.perUser")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.usage.tokensOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tokensChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                {/* <Legend /> */}
                <Line type="monotone" dataKey="tokens" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.usage.usersByPlan")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={plansChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                {/* <Legend /> */}
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.userUsageDetails")}</CardTitle>
          <CardDescription>
            {t("admin.detailedBreakdown")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.usage.searchPlaceholder")}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.filterByPlan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Professional</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.sort")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tokensUsed">{t("admin.usage.tokensUsed")}</SelectItem>
                <SelectItem value="lastActive">{t("admin.lastActive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.usage.headers.name")}</TableHead>
                  <TableHead>{t("admin.usage.headers.email")}</TableHead>
                  <TableHead>{t("admin.usage.headers.plan")}</TableHead>
                  <TableHead className="text-right">{t("admin.usage.headers.tokensUsed")}</TableHead>
                  <TableHead className="text-right">{t("admin.usage.headers.lastActive")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("admin.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.userName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{user.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{user.tokensUsed.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">
                            / {user.tokensLimit.toLocaleString()}
                          </span>
                        </div>
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
