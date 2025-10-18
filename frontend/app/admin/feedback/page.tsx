"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThumbsUp, ThumbsDown, AlertTriangle, Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Feedback {
  id: string
  predictionId: string
  detectedBreed: string
  confidence: number
  isCorrect: boolean
  correctBreed: string
  notes: string
  timestamp: string
  userId: string
  imageUrl: string
}

export default function FeedbackManagement() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect">("all")

  useEffect(() => {
    const data = localStorage.getItem("dogdex_feedback")
    if (data) {
      const parsed = JSON.parse(data)
      setFeedback(parsed.reverse()) // Show newest first
    }
  }, [])

  const filteredFeedback = feedback.filter((f) => {
    if (filter === "all") return true
    if (filter === "correct") return f.isCorrect
    if (filter === "incorrect") return !f.isCorrect
    return true
  })

  const stats = {
    total: feedback.length,
    correct: feedback.filter((f) => f.isCorrect).length,
    incorrect: feedback.filter((f) => !f.isCorrect).length,
    accuracy:
      feedback.length > 0 ? ((feedback.filter((f) => f.isCorrect).length / feedback.length) * 100).toFixed(1) : 0,
  }

  // Group incorrect feedback by correct breed to find new breeds
  const incorrectByBreed = feedback
    .filter((f) => !f.isCorrect)
    .reduce(
      (acc, f) => {
        const breed = f.correctBreed.toLowerCase().trim()
        if (!acc[breed]) {
          acc[breed] = []
        }
        acc[breed].push(f)
        return acc
      },
      {} as Record<string, Feedback[]>,
    )

  const newBreedAlerts = Object.entries(incorrectByBreed)
    .filter(([_, feedbacks]) => feedbacks.length >= 5) // Alert if 5+ reports
    .sort(([_, a], [__, b]) => b.length - a.length)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Quản lý phản hồi</h2>
        <p className="text-muted-foreground">Xem và phân tích phản hồi từ người dùng về kết quả nhận diện</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng phản hồi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dự đoán đúng</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dự đoán sai</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.incorrect}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Độ chính xác</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accuracy}%</div>
          </CardContent>
        </Card>
      </div>

      {/* New Breed Alerts */}
      {newBreedAlerts.length > 0 && (
        <Card className="border-2 border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Cảnh báo giống chó mới
            </CardTitle>
            <CardDescription>Các giống chó có nhiều báo cáo sai - có thể cần thêm vào model</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {newBreedAlerts.map(([breed, feedbacks]) => (
                <div key={breed} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-semibold capitalize">{breed}</p>
                    <p className="text-sm text-muted-foreground">{feedbacks.length} báo cáo</p>
                  </div>
                  {feedbacks.length >= 200 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Cần train model
                    </Badge>
                  )}
                  {feedbacks.length >= 5 && feedbacks.length < 200 && (
                    <Badge variant="secondary">{feedbacks.length} báo cáo</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Table */}
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
                <TabsTrigger value="correct">Đúng</TabsTrigger>
                <TabsTrigger value="incorrect">Sai</TabsTrigger>
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
                <TableHead>Độ chính xác</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead>Giống đúng</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedback.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Chưa có phản hồi nào
                  </TableCell>
                </TableRow>
              ) : (
                filteredFeedback.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="text-sm">
                      {new Date(f.timestamp).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">{f.userId}</TableCell>
                    <TableCell className="font-medium">{f.detectedBreed}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{f.confidence}%</Badge>
                    </TableCell>
                    <TableCell>
                      {f.isCorrect ? (
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
                    <TableCell className="font-medium">{f.isCorrect ? "-" : f.correctBreed}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                            <Eye className="h-4 w-4" />
                            Chi tiết
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Chi tiết phản hồi</DialogTitle>
                            <DialogDescription>Thông tin đầy đủ về phản hồi này</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm text-muted-foreground">Người dùng</p>
                                  <p className="font-semibold">{f.userId}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Thời gian</p>
                                  <p className="font-semibold">{new Date(f.timestamp).toLocaleString("vi-VN")}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Dự đoán của AI</p>
                                  <p className="font-semibold">{f.detectedBreed}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Độ chính xác</p>
                                  <p className="font-semibold">{f.confidence}%</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Kết quả</p>
                                  {f.isCorrect ? (
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
                                </div>
                                {!f.isCorrect && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Giống đúng</p>
                                    <p className="font-semibold">{f.correctBreed}</p>
                                  </div>
                                )}
                                {f.notes && (
                                  <div>
                                    <p className="text-sm text-muted-foreground">Ghi chú</p>
                                    <p className="text-sm">{f.notes}</p>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Ảnh đã nhận diện</p>
                                <img
                                  src={f.imageUrl || "/placeholder.svg"}
                                  alt="Detected"
                                  className="w-full rounded-lg border"
                                />
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
