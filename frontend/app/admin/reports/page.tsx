"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateRange } from "react-day-picker"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon, Download, FileText, FileSpreadsheet } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n-context"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner";
import { exportAdminReport } from "@/lib/admin-api";

export default function ReportsPage() {
  const { t } = useI18n()
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  })
  const [exporting, setExporting] = useState(false)

  const handleExport = async (formatType: "excel" | "word") => {
    if (!date?.from || !date?.to) {
      toast.error("Please select a valid date range.")
      return
    }

    setExporting(true)
    toast.info(`Đang chuẩn bị báo cáo ${formatType.toUpperCase()}...`);

    try {
      const fileBlob = await exportAdminReport({
        startDate: date.from.toISOString(),
        endDate: date.to.toISOString(),
        format: formatType,
      });

      // Logic để tải file về máy người dùng
      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${format(new Date(), "yyyy-MM-dd")}.${formatType === 'excel' ? 'xlsx' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Báo cáo đã bắt đầu được tải xuống.");

    } catch (error) {
      toast.error(t("admin.reports.errorExport"), { description: (error as Error).message })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("admin.reports.title")}</h2>
        <p className="text-muted-foreground">{t("admin.reports.description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.reports.reportControls")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>{t("admin.reports.selectDateRange")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} />
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" disabled={exporting} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                {exporting ? t("admin.reports.exporting") : t("admin.reports.export")}
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

      {/* Khu vực xem trước báo cáo có thể được thêm ở đây */}
    </div>
  )
}
