"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Download,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  Users,
  Eye,
  Target,
  Database,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  exportAdminReport,
  getAdminReportPreview,
  ReportPreviewData,
} from "@/lib/admin-api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const { t } = useI18n();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [exporting, setExporting] = useState(false);

  // State cho Preview
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(
    null
  );

  // Hàm lấy dữ liệu xem trước
  const handlePreview = async () => {
    if (!date?.from || !date?.to) {
      toast.error("Vui lòng chọn khoảng thời gian hợp lệ.");
      return;
    }

    setLoadingPreview(true);
    try {
      const data = await getAdminReportPreview({
        startDate: date.from.toISOString(),
        endDate: date.to.toISOString(),
      });
      setPreviewData(data);
      toast.success("Dữ liệu báo cáo đã được cập nhật.");
    } catch (error) {
      toast.error("Không thể tải dữ liệu xem trước.", {
        description: (error as Error).message,
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Hàm xuất file (giữ nguyên)
  const handleExport = async (formatType: "excel" | "word") => {
    if (!date?.from || !date?.to) {
      toast.error("Please select a valid date range.");
      return;
    }

    setExporting(true);
    toast.info(`Đang chuẩn bị báo cáo ${formatType.toUpperCase()}...`);

    try {
      const fileBlob = await exportAdminReport({
        startDate: date.from.toISOString(),
        endDate: date.to.toISOString(),
        format: formatType,
      });

      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${format(new Date(), "yyyy-MM-dd")}.${
        formatType === "excel" ? "xlsx" : "docx"
      }`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Báo cáo đã bắt đầu được tải xuống.");
    } catch (error) {
      toast.error(t("admin.reports.errorExport"), {
        description: (error as Error).message,
      });
    } finally {
      setExporting(false);
    }
  };

  // Helper format tiền tệ
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {t("admin.reports.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("admin.reports.description")}
        </p>
      </div>

      {/* Controls Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.reports.reportControls")}</CardTitle>
          <CardDescription>
            Chọn khoảng thời gian để xem trước hoặc xuất báo cáo
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd/MM/yyyy")} -{" "}
                      {format(date.to, "dd/MM/yyyy")}
                    </>
                  ) : (
                    format(date.from, "dd/MM/yyyy")
                  )
                ) : (
                  <span>{t("admin.reports.selectDateRange")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button
            onClick={handlePreview}
            disabled={loadingPreview || !date?.from || !date?.to}
            className="w-full sm:w-auto"
          >
            {loadingPreview ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Xem trước số liệu
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                disabled={exporting || !previewData}
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting
                  ? t("admin.reports.exporting")
                  : t("admin.reports.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t("admin.reports.exportExcel")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("word")}>
                <FileText className="mr-2 h-4 w-4" />
                {t("admin.reports.exportWord")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {/* PREVIEW SECTION */}
      {previewData && (
        <div className="space-y-6 animate-in fade-in-50 duration-500">
          {/* 1. Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tổng doanh thu
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(previewData.overview.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ARPU: {formatCurrency(previewData.overview.arpu)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Người dùng mới
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  +{previewData.overview.newUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tổng: {previewData.overview.totalUsers} users
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Lượt dự đoán
                </CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {previewData.overview.totalPredictions}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active Users: {previewData.overview.activeUsers}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Độ chính xác AI
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {previewData.overview.accuracy}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Dựa trên feedback đã duyệt
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* 2. Activity Chart */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Hoạt động dự đoán theo ngày</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={previewData.charts.dailyActivity}>
                      <defs>
                        <linearGradient
                          id="colorCount"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="_id"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          format(new Date(value), "dd/MM")
                        }
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        className="stroke-muted"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))",
                        }}
                        labelFormatter={(value) =>
                          format(new Date(value), "dd/MM/yyyy")
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorCount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 3. Top Breeds Chart */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Top giống chó phổ biến</CardTitle>
                <CardDescription>
                  5 giống chó được nhận diện nhiều nhất
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={previewData.charts.topBreeds.slice(0, 5)}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                        className="stroke-muted"
                      />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="breed"
                        type="category"
                        width={100}
                        tick={{ fontSize: 12 }}
                        interval={0}
                      />
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))",
                        }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
                        {previewData.charts.topBreeds.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index % 2 === 0 ? "#10b981" : "#34d399"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Infrastructure Stats (Cloudinary) */}
          {previewData.infra && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-orange-200 bg-orange-50/20 dark:bg-orange-900/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    Cloudinary Credits ({previewData.infra.plan})
                  </CardTitle>
                  <Database className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {previewData.infra.credits.used.toFixed(2)} /{" "}
                    {previewData.infra.credits.limit}
                  </div>
                  <div className="w-full bg-orange-100 dark:bg-orange-900 rounded-full h-2 mt-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          previewData.infra.credits.percent,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    {previewData.infra.credits.percent.toFixed(2)}% Used
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Storage & Bandwidth
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Storage:</span>
                    <span className="font-bold">
                      {previewData.infra.storage.used}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Bandwidth (30d):
                    </span>
                    <span className="font-bold">
                      {previewData.infra.bandwidth.used}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Assets Breakdown
                  </CardTitle>
                  <Badge variant="outline">
                    Total: {previewData.infra.objects}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Tổng số file ảnh và video đang được lưu trữ trên hệ thống.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
