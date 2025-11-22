"use client"

import { useEffect, useState, useMemo } from "react"
import { 
  Search, 
  Download, 
  TrendingUp, 
  HardDrive, 
  CreditCard, 
  Layers,
  Database, 
  Activity 
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar 
} from "recharts"

// Import UI Components (đảm bảo đường dẫn đúng với dự án của bạn)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Import Utils & API
import { useI18n } from "@/lib/i18n-context"
import { getAdminUsageStats, UserUsageData, CloudinaryStats } from "@/lib/admin-api"

// --- Helper Function: Format Bytes ---
const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes || bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export default function UsagePage() {
  const { t } = useI18n()
  
  // --- State Management ---
  const [usageData, setUsageData] = useState<UserUsageData[]>([])
  const [tokensChartData, setTokensChartData] = useState<any[]>([])
  const [plansChartData, setPlansChartData] = useState<any[]>([])
  const [storageStats, setStorageStats] = useState<CloudinaryStats | null>(null)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [planFilter, setPlanFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("tokensUsed")
  const [isLoading, setIsLoading] = useState(true)

  // --- Fetch Data ---
  useEffect(() => {
    fetchUsageData()
  }, [])

  const fetchUsageData = async () => {
    try {
      setIsLoading(true)
      const response = await getAdminUsageStats()
      
      setUsageData(response.usageData || [])
      setTokensChartData(response.tokensChartData || [])
      setPlansChartData(response.plansChartData || [])
      
      if (response.storageStats) {
        setStorageStats(response.storageStats)
      }
    } catch (error) {
      console.error("[UsagePage] Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Filter & Sort Logic ---
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

  // --- Aggregate Stats ---
  const totalTokensUsed = usageData.reduce((sum, user) => sum + user.tokensUsed, 0)
  const totalUsers = usageData.length
  const avgTokensPerUser = totalUsers > 0 ? Math.round(totalTokensUsed / totalUsers) : 0

  // --- Export Report Logic ---
  const handleExportReport = () => {
    const csvHeader = [t("admin.usage.csv.userName"), t("admin.usage.csv.email"), t("admin.usage.csv.plan"), t("admin.usage.csv.tokensUsed"), t("admin.usage.csv.tokensLimit"), t("admin.usage.csv.lastActive")]
    const csvRows = filteredAndSortedData.map((user) => [
      `"${user.userName}"`,
      `"${user.email}"`,
      user.plan,
      user.tokensUsed,
      user.tokensLimit,
      user.lastActive,
    ])

    const csvContent = [
      csvHeader.join(","),
      ...csvRows.map((row) => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `usage-report-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("admin.usageTracking")}</h2>
          <p className="text-muted-foreground">
            {t("admin.usageTrackingDescription")}
          </p>
        </div>
        <Button onClick={handleExportReport} variant="outline" className="gap-2 bg-background">
          <Download className="h-4 w-4" />
          {t("admin.exportReport")}
        </Button>
      </div>

      {/* --- SECTION 1: CLOUDINARY STATS (NEW) --- */}
      {storageStats && (
        <>
          {/* Hàng 1: Thẻ Credits (Quan trọng nhất) */}
          <div className="grid md:grid-cols-4 gap-4 mb-4">
             <Card className="md:col-span-4 border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <CreditCard className="h-5 w-5" />
                    {t("admin.usage.cloudinaryCredits", { plan: storageStats.plan })}
                    {/* Tooltip giải thích */}
                    <span className="ml-auto text-xs font-normal text-muted-foreground hidden md:inline-block">
                      {t("admin.usage.creditInfo")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end mb-2">
                     <div className="text-3xl font-bold">
                        {storageStats.credits.usage.toFixed(2)} 
                        <span className="text-lg text-muted-foreground font-medium"> / {storageStats.credits.limit || "∞"}</span>
                     </div>
                     <div className="text-sm font-medium text-orange-600">
                        {storageStats.credits.usage_percent.toFixed(2)}% {t("admin.usage.used")}
                     </div>
                  </div>
                  <div className="w-full bg-orange-100 dark:bg-orange-900 rounded-full h-4 border border-orange-200 dark:border-orange-800">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
                            storageStats.credits.usage_percent > 90 ? 'bg-red-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(storageStats.credits.usage_percent, 100)}%` }}
                    >
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>

          {/* Hàng 2: Chi tiết Storage, Bandwidth, Transformations */}
          <div className="grid md:grid-cols-3 gap-4">
            
            {/* Transformations Card (MỚI) */}
            <Card className="border-pink-200 dark:border-pink-900 bg-pink-50/30 dark:bg-pink-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-pink-700 dark:text-pink-400">
                  <Layers className="h-4 w-4" />
                  {t("admin.usage.transformations")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{storageStats.transformations.usage.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                   {t("admin.usage.transformationsDesc")}
                </p>
                {/* Chỉ hiện thanh progress nếu có limit riêng (thường là 0 ở gói Free vì nó tính vào Credit) */}
                {storageStats.transformations.limit > 0 && (
                    <div className="w-full bg-pink-100 dark:bg-pink-900 rounded-full h-1.5">
                        <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: `${storageStats.transformations.usage_percent}%` }}></div>
                    </div>
                )}
              </CardContent>
            </Card>

            {/* Storage Card (Sửa lại hiển thị Limit) */}
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Database className="h-4 w-4" />
                  {t("admin.usage.netStorage")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(storageStats.storage.used_bytes)}</div>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  {storageStats.storage.limit_bytes > 0 
                    ? `${t("admin.usage.limit")}: ${formatBytes(storageStats.storage.limit_bytes)}` 
                    : t("admin.usage.sharedCreditLimit")}
                </p>
              </CardContent>
            </Card>

            {/* Bandwidth Card (Sửa lại hiển thị Limit) */}
            <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Activity className="h-4 w-4" />
                  {t("admin.usage.bandwidth")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(storageStats.bandwidth.used_bytes)}</div>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  {storageStats.bandwidth.limit_bytes > 0 
                    ? `${t("admin.usage.limit")}: ${formatBytes(storageStats.bandwidth.limit_bytes)}` 
                    : t("admin.usage.sharedCreditLimit")}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* --- SECTION 2: TOKEN STATS --- */}
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

      {/* --- SECTION 3: CHARTS --- */}
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
                <Line type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
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
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* --- SECTION 4: USAGE TABLE --- */}
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
                <SelectItem value="starter">{t("pricing.starter")}</SelectItem>
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
          <div className="overflow-x-auto rounded-md border">
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
                    <TableCell colSpan={5} className="text-center py-8">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(user.lastActive).toLocaleDateString()}
                      </TableCell>
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