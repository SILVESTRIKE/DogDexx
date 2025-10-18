"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThumbsUp, ThumbsDown, AlertTriangle, Eye, Check, X, Hourglass, UserCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getAdminFeedback, AdminFeedbackResponse } from "@/lib/admin-api"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

const initialData: AdminFeedbackResponse = {
  stats: { pending_review: 0, approved_for_training: 0, rejected: 0 },
  userStats: [],
  feedbacks: { data: [], total: 0, page: 1, limit: 10, totalPages: 1 },
}

export default function FeedbackManagement() {
  const [data, setData] = useState<AdminFeedbackResponse>(initialData)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<string>("all")

  const fetchFeedback = useCallback(async (currentPage: number, status: string) => {
    setLoading(true)
    try {
      const statusParam = status === "all" ? undefined : status
      const result = await getAdminFeedback({ page: currentPage, limit: 10, status: statusParam })
      setData(result)
    } catch (error) {
      toast.error("Failed to fetch feedback.", { description: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1) // Reset page when filter changes
    fetchFeedback(1, filter)
  }, [filter, fetchFeedback])

  useEffect(() => {
    fetchFeedback(page, filter)
  }, [page, fetchFeedback])

  const { stats, userStats, feedbacks } = data
  const totalFeedback = stats.pending_review + stats.approved_for_training + stats.rejected
  const accuracy =
    totalFeedback > 0 ? ((stats.approved_for_training / totalFeedback) * 100).toFixed(1) : "0.0"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Quản lý phản hồi</h2>
        <p className="text-muted-foreground">Xem, phân tích và duyệt các phản hồi từ người dùng.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chờ duyệt</CardTitle>
            <Hourglass className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.pending_review}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã duyệt (Approved)</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-green-600">{stats.approved_for_training}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã từ chối</CardTitle>
            <X className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ duyệt</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{accuracy}%</div>}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="feedbacks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedbacks">Danh sách phản hồi</TabsTrigger>
          <TabsTrigger value="user-stats">Thống kê người dùng</TabsTrigger>
        </TabsList>
        <TabsContent value="feedbacks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Danh sách phản hồi</CardTitle>
                  <CardDescription>Tất cả phản hồi từ người dùng</CardDescription>
                </div>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <TabsList>
                    <TabsTrigger value="all">Tất cả</TabsTrigger>
                    <TabsTrigger value="pending_review">Chờ duyệt</TabsTrigger>
                    <TabsTrigger value="approved_for_training">Đã duyệt</TabsTrigger>
                    <TabsTrigger value="rejected">Đã từ chối</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Dự đoán</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Hành động</TableHead>
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
                        Chưa có phản hồi nào
                      </TableCell>
                    </TableRow>
                  ) : (
                    feedbacks.data.map((f) => (
                      <TableRow key={f._id}>
                        <TableCell className="text-sm">
                          {new Date(f.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-sm">{f.user_id?.username || "Guest"}</TableCell>
                        <TableCell className="font-medium">{f.original_prediction.class}</TableCell>
                        <TableCell>
                          {f.is_correct ? (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <ThumbsUp className="h-3 w-3" />
                              Đúng
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <ThumbsDown className="h-3 w-3" />
                              Sai
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{f.status.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          {/* Dialog and other actions here */}
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setPage((p) => Math.max(1, p - 1))
                      }}
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 py-2 text-sm">
                      Trang {feedbacks.page} / {feedbacks.totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setPage((p) => Math.min(feedbacks.totalPages, p + 1))
                      }}
                      className={page >= feedbacks.totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="user-stats">
          <Card>
            <CardHeader>
              <CardTitle>Thống kê người dùng</CardTitle>
              <CardDescription>Top 10 người dùng gửi phản hồi nhiều nhất.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Tổng gửi</TableHead>
                    <TableHead>Đã duyệt</TableHead>
                    <TableHead>Đã từ chối</TableHead>
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
