"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThumbsUp, ThumbsDown, AlertTriangle, Eye, Check, X, Hourglass, UserCheck, Search, Calendar as CalendarIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { getAdminFeedback, approveAdminFeedback, rejectAdminFeedback, AdminFeedbackResponse, Feedback } from "@/lib/admin-api"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/lib/i18n-context"
import { PaginationComponent } from "@/components/ui/pagination"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"

const initialData: AdminFeedbackResponse = {
  stats: { pending_review: 0, approved_for_training: 0, rejected: 0 },
  userStats: [],
  feedbacks: { data: [], total: 0, page: 1, limit: 10, totalPages: 1 },
}

export default function FeedbackManagement() {
  const { t } = useI18n();
  const [data, setData] = useState<AdminFeedbackResponse>(initialData)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchFeedback = useCallback(async (params: { page: number; status: string; search: string; startDate?: string; endDate?: string }) => {
    setLoading(true)
    try {
      const statusParam = params.status === "all" ? undefined : params.status
      const result = await getAdminFeedback({ 
        page: params.page, 
        limit: 10, 
        status: statusParam,
        search: params.search || undefined,
        startDate: params.startDate,
        endDate: params.endDate,
      })
      setData(result)
    } catch (error) {
      toast.error(t('admin.feedback.errors.fetchFailed'), { description: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    setPage(1); // Reset page when filters change
  }, [statusFilter, debouncedSearchQuery, dateRange]);

  useEffect(() => {
    fetchFeedback({
      page,
      status: statusFilter,
      search: debouncedSearchQuery,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
    })
  }, [page, statusFilter, debouncedSearchQuery, dateRange, fetchFeedback])

  const { stats, userStats, feedbacks } = data
  const totalFeedback = stats.pending_review + stats.approved_for_training + stats.rejected
  const accuracy =
    totalFeedback > 0 ? ((stats.approved_for_training / totalFeedback) * 100).toFixed(1) : "0.0"

  const handleApprove = async (feedbackId: string) => {
    const toastId = toast.loading(t('admin.feedback.actions.approving'));
    try {
      const result = await approveAdminFeedback(feedbackId);
      toast.success(result.message, { id: toastId });
      // Cập nhật lại UI, bao gồm cả stats và danh sách
      setData(prevData => {
        const newStats = { ...prevData.stats };
        newStats.pending_review = Math.max(0, newStats.pending_review - 1);
        newStats.approved_for_training += 1;

        return {
          ...prevData,
          stats: newStats,
          feedbacks: {
            ...prevData.feedbacks,
            data: prevData.feedbacks.data.map(f => 
              f.id === feedbackId ? { ...f, status: 'approved_for_training' } : f
            )
          }
        };
      });
    } catch (error) {
      toast.error(t('admin.feedback.errors.approveFailed'), { id: toastId, description: (error as Error).message });
    }
  }

  const handleReject = async (feedbackId: string) => {
    const toastId = toast.loading(t('admin.feedback.actions.rejecting'));
    try {
      const result = await rejectAdminFeedback(feedbackId);
      toast.success(result.message, { id: toastId });
      // Cập nhật lại UI, bao gồm cả stats và danh sách
      setData(prevData => {
        const newStats = { ...prevData.stats };
        newStats.pending_review = Math.max(0, newStats.pending_review - 1);
        newStats.rejected += 1;

        return {
          ...prevData,
          stats: newStats,
          feedbacks: {
            ...prevData.feedbacks,
            data: prevData.feedbacks.data.map(f => 
              f.id === feedbackId ? { ...f, status: 'rejected' } : f
            )
          }
        };
      });
    } catch (error) {
      toast.error(t('admin.feedback.errors.rejectFailed'), { id: toastId, description: (error as Error).message });
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('admin.feedback.title')}</h2>
        <p className="text-muted-foreground">{t('admin.feedback.description')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.feedback.stats.pending')}</CardTitle>
            <Hourglass className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.pending_review}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.feedback.stats.approved')}</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-green-600">{stats.approved_for_training}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.feedback.stats.rejected')}</CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.feedback.stats.approvalRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{accuracy}%</div>}
            <p className="text-xs text-muted-foreground">{t('admin.feedback.errors.approvalRateDescription', { count: totalFeedback })}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="feedbacks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedbacks">{t('admin.feedback.tabs.list')}</TabsTrigger>
          <TabsTrigger value="user-stats">{t('admin.feedback.tabs.userStats')}</TabsTrigger>
        </TabsList>
        <TabsContent value="feedbacks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('admin.feedback.table.title')}</CardTitle>
                  <CardDescription>{t('admin.feedback.table.description')}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('admin.feedback.filters.searchPlaceholder')}
                      className="pl-10 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className="w-[300px] justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>{t('admin.feedback.filters.pickDate')}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" onClick={() => { setSearchQuery(''); setDateRange(undefined); }} className={!searchQuery && !dateRange ? 'hidden' : ''}>{t('admin.feedback.filters.clear')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.feedback.table.headers.time')}</TableHead>
                    <TableHead>{t('admin.feedback.table.headers.user')}</TableHead>
                    <TableHead>{t('admin.feedback.table.headers.prediction')}</TableHead>
                    <TableHead>{t('admin.feedback.table.headers.result')}</TableHead>
                    <TableHead>{t('admin.feedback.table.headers.status')}</TableHead>
                    <TableHead>{t('admin.feedback.table.headers.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : feedbacks.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {t('admin.feedback.table.noFeedback')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    feedbacks.data.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm">
                          {new Date(f.feedbackTimestamp).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-sm">{f.user?.name || t('common.guest')}</TableCell>
                        <TableCell className="font-medium">{f.aiPrediction?.class || 'N/A'}</TableCell>
                        <TableCell>
                          {f.feedbackContent.isCorrect ? (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <ThumbsUp className="h-3 w-3" />
                              {t('feedback.yes')}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <ThumbsDown className="h-3 w-3" />
                              {t('feedback.no')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {f.status === 'pending_review' && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              <Hourglass className="h-3 w-3 mr-1" />
                              {t('admin.feedback.filters.pending')}
                            </Badge>
                          )}
                          {f.status === 'approved_for_training' && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              <Check className="h-3 w-3 mr-1" />
                              {t('admin.feedback.filters.approved')}
                            </Badge>
                          )}
                          {f.status === 'rejected' && (
                            <Badge variant="destructive">{t('admin.feedback.filters.rejected')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px]">
                              <DialogHeader>
                                <DialogTitle>{t('admin.feedback.dialog.title')}</DialogTitle>
                                <DialogDescription>
                                  {t('admin.feedback.dialog.description')}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-start gap-4">
                                  <p className="text-right font-semibold">{t('admin.feedback.dialog.originalImage')}:</p>
                                  <div className="col-span-3 flex gap-4">
                                    <a href={f.originalMediaUrl} target="_blank" rel="noopener noreferrer">
                                      <img src={f.originalMediaUrl} alt="Original" className="max-h-32 w-auto rounded-md border hover:opacity-80 transition-opacity" />
                                    </a>
                                    <a href={f.processedMediaUrl} target="_blank" rel="noopener noreferrer">
                                      <img src={f.processedMediaUrl} alt="Processed" className="max-h-32 w-auto rounded-md border hover:opacity-80 transition-opacity" />
                                    </a>
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <p className="text-right font-semibold">{t('admin.feedback.dialog.aiPrediction')}:</p>
                                  <p className="col-span-3">{f.aiPrediction?.class || 'N/A'} ({Math.round((f.aiPrediction?.confidence || 0) * 100)}%)</p>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <p className="text-right font-semibold">{t('admin.feedback.dialog.userSays')}:</p>
                                  <p className="col-span-3 font-bold">{f.feedbackContent.isCorrect ? t('feedback.yes') : `${t('feedback.no')}, ${t('admin.feedback.dialog.mustBe')}: ${f.feedbackContent.userSubmittedLabel}`}</p>
                                </div>
                                {f.feedbackContent.notes && (
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <p className="text-right font-semibold">{t('admin.feedback.dialog.notes')}:</p>
                                    <p className="col-span-3 text-sm text-muted-foreground italic">"{f.feedbackContent.notes}"</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end gap-2 pt-4 border-t">
                                {f.status === 'pending_review' && (
                                  <>
                                    <Button variant="destructive" size="sm" onClick={() => handleReject(f.id)}>
                                      <X className="h-4 w-4 mr-2" />{t('admin.feedback.actions.reject')}
                                    </Button>
                                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(f.id)} >
                                      <Check className="h-4 w-4 mr-2" />{t('admin.feedback.actions.approve')}
                                    </Button>
                                  </>
                                )}
                                {f.status === 'approved_for_training' && (
                                    <Badge variant="default" className="bg-green-600 gap-1"><Check className="h-3 w-3" />{t('admin.feedback.status.approved')}</Badge>
                                )}
                                {f.status === 'rejected' && (
                                    <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />{t('admin.feedback.status.rejected')}</Badge>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {!loading && feedbacks.totalPages > 1 && (
                <PaginationComponent
                  currentPage={feedbacks.page}
                  totalPages={feedbacks.totalPages}
                  onPageChange={setPage}
                  className="mt-6"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="user-stats">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.feedback.userStats.title')}</CardTitle>
              <CardDescription>{t('admin.feedback.userStats.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.feedback.userStats.headers.user')}</TableHead>
                    <TableHead>{t('admin.feedback.userStats.headers.total')}</TableHead>
                    <TableHead>{t('admin.feedback.userStats.headers.approved')}</TableHead>
                    <TableHead>{t('admin.feedback.userStats.headers.rejected')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    userStats.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell>{u.totalSubmissions}</TableCell>
                        <TableCell className="text-green-600">{u.approvedCount}</TableCell>
                        <TableCell className="text-red-600">{u.rejectedCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
