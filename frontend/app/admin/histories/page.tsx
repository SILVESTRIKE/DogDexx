"use client"

import { useEffect, useState } from "react"
import { DateRange } from "react-day-picker"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Folder, Video as VideoIcon, Home, Camera, MessageSquareQuote, Calendar as CalendarIcon } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import Image from "next/image"
import { browseAdminHistories, AdminHistoryItem, DirectoryItem } from "@/lib/admin-api"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/use-debounce"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

const HistoryTable = ({ histories }: { histories: AdminHistoryItem[]}) => {
  const { t } = useI18n()
  const router = useRouter()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.histories.table.title")}</CardTitle> 
        <CardDescription>{t("admin.histories.table.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.histories.table.headers.media")}</TableHead>
              <TableHead>{t("admin.histories.table.headers.processedMedia")}</TableHead>
              <TableHead>{t("admin.histories.table.headers.prediction")}</TableHead>
              <TableHead>{t("admin.histories.table.headers.source")}</TableHead>
              <TableHead>{t("admin.histories.table.headers.time")}</TableHead>
              <TableHead>{t("admin.histories.table.headers.feedback")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {histories.length > 0 ? (
              histories.map((history) => (
                <TableRow key={history.id}>
                  <TableCell className="w-[200px]">
                    <a href={history.media.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                      {history.source === 'stream_capture' ? (
                        <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-md">
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        </div>
                      ) : history.media.type.startsWith("image") ? (
                        <Image src={history.media.url} alt={history.media.name} width={80} height={80} className="object-cover rounded-md aspect-square" />
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-md">
                          <VideoIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </a> 
                  </TableCell>
                  <TableCell className="w-[200px]">
                    {history.processedMediaUrl && (
                      <a href={history.processedMediaUrl} target="_blank" rel="noopener noreferrer">
                        {history.media.type.startsWith("image") ? (
                          <Image src={history.processedMediaUrl} alt={`Processed ${history.media.name}`} width={80} height={80} className="object-cover rounded-md aspect-square" />
                        ) : (
                          <div className="w-20 h-20 flex items-center justify-center bg-muted rounded-md"><VideoIcon className="h-8 w-8 text-muted-foreground" /></div>
                        )}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[200px]">
                    {history.predictions.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {history.predictions.slice(0, 2).map((p, i) => (
                          <Badge key={i} variant="secondary" className="font-normal">
                            <span className="truncate">{p.class}</span>: {(p.confidence * 100).toFixed(1)}%
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t("admin.histories.noPrediction")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`admin.histories.sources.${history.source}` as any)}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(history.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>
                    {history.feedback ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => router.push(`/admin/feedback?search=${history.feedback?.id}`)}
                      >
                        <MessageSquareQuote className="mr-2 h-4 w-4" /> {t("admin.histories.viewFeedback")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {t("admin.histories.table.noHistory")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

interface BreadcrumbItem {
  name: string | number;
  path: string;
}
const Breadcrumb = ({ trail, onNavigate }: { trail: BreadcrumbItem[]; onNavigate: (newPath: string) => void }) => {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      {trail.map((crumb, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <span>/</span>}
          <button
            onClick={() => onNavigate(crumb.path)}
            className={`hover:text-primary disabled:text-muted-foreground disabled:no-underline ${index === trail.length - 1 ? 'font-semibold text-foreground' : ''}`}
          >
            {crumb.name === 'Home' ? <Home className="h-4 w-4" /> : crumb.name}
          </button>
        </div>
      ))}
    </div>
  )
}

export default function AdminHistoriesBrowserPage() {
  const { t } = useI18n()
  const [currentPath, setCurrentPath] = useState("")
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<BreadcrumbItem[]>([{ name: 'Home', path: '' }])
  const [directories, setDirectories] = useState<DirectoryItem[]>([])
  const [histories, setHistories] = useState<AdminHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const debouncedDateRange = useDebounce(dateRange, 500)

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: { startDate?: string, endDate?: string } = {};
        if (debouncedDateRange?.from) {
          params.startDate = debouncedDateRange.from.toISOString();
        }
        if (debouncedDateRange?.to) {
          params.endDate = debouncedDateRange.to.toISOString();
        }
        const response = await browseAdminHistories(currentPath, params)
        setDirectories(response.directories)
        setHistories(response.histories)
      } catch (err) {
        setError(t("admin.histories.errors.fetchFailed"))
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchContent() 
  }, [currentPath, debouncedDateRange, t])

  const handleFolderClick = (item: DirectoryItem) => {
    const newPath = currentPath ? `${currentPath}/${item.id || item.name}` : `${item.id || item.name}`
    setBreadcrumbTrail(prev => [...prev, { name: item.name, path: newPath }])
    setCurrentPath(newPath)
  }

  const handleNavigate = (newPath: string) => {
    const newTrailIndex = breadcrumbTrail.findIndex(b => b.path === newPath)
    if (newTrailIndex !== -1) {
      setBreadcrumbTrail(breadcrumbTrail.slice(0, newTrailIndex + 1))
    } else {
      // Fallback if path not found (should not happen in normal flow)
      setBreadcrumbTrail([{ name: 'Home', path: '' }])
    }
    setCurrentPath(newPath)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )
    }

    if (error) {
      return <p className="text-center text-destructive">{error}</p>
    }

    if (histories.length > 0) {
      return <HistoryTable histories={histories} />
    }

    if (directories.length > 0) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {directories.map((dir) => (
            <Card
              key={dir.id || dir.name}
              className="flex flex-col items-center justify-center p-4 hover:bg-accent hover:border-primary cursor-pointer transition-colors"
              onClick={() => handleFolderClick(dir)}
            >
              <Folder className="h-12 w-12 text-primary mb-2" />
              <span className="font-medium text-center truncate w-full">{dir.name}</span>
            </Card>
          ))}
        </div>
      )
    }

    return <p className="text-center text-muted-foreground">Thư mục này trống.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("admin.histories.title")}</h2>
        <p className="text-muted-foreground">{t("admin.histories.description")}</p>
      </div>
      <div className="flex justify-between items-center">
        <Breadcrumb trail={breadcrumbTrail} onNavigate={handleNavigate} />
        {histories.length > 0 && !loading && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>{t('admin.histories.filters.datePlaceholder')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
      {renderContent()}
    </div>
  )
}