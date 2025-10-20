"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, Trash2, Eye, Loader2, Video, Camera, Webcam, PlusSquare } from "lucide-react";
import Link from "next/link"
import { PredictionHistoryItem } from "@/lib/types"
import { toast } from "sonner"

function HistoryContent() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [predictions, setPredictions] = useState<PredictionHistoryItem[]>([])
  const [filteredPredictions, setFilteredPredictions] = useState<PredictionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | "image" | "video">("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "confidence">("newest")

  useEffect(() => {
    if (!user) return

    const fetchHistory = async () => {
      try {
        setLoading(true)
        const data = await apiClient.getPredictionHistory()
        setPredictions(data.histories || []) // Sửa lại key cho đúng với API response
      } catch (error) {
        console.error("Failed to fetch history:", error)
        toast.error(t('history.fetchError'))
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [user])

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...predictions]

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((p) => p.media.type === filterType)
    }

    // Filter by search term
    if (searchTerm) {
      // Tìm kiếm trong tất cả các breed được dự đoán của một record
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter((p) =>
        p.detections.some((det) => 
          det.detectedBreed.toLowerCase().replace(/_/g, ' ').includes(lowerCaseSearchTerm))
      )
    }

    // Sort
    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } else if (sortBy === "confidence") {
      // Sắp xếp theo confidence cao nhất trong mỗi record
      filtered.sort((a, b) => {
        const maxConfidenceA = Math.max(...a.detections.map(p => p.confidence), 0);
        const maxConfidenceB = Math.max(...b.detections.map(p => p.confidence), 0);
        return maxConfidenceB - maxConfidenceA;
      })
    }

    setFilteredPredictions(filtered)
  }, [predictions, searchTerm, filterType, sortBy])

  const handleDelete = async (id: string) => {
    if (!confirm(t("history.confirmDelete"))) return

    try {
      const result = await apiClient.deletePredictionHistory(id);
      setPredictions(predictions.filter((p) => p.id !== id))
      toast.success(result.message || t('history.deleteSuccess'))
    } catch (error: any) {
      console.error("Failed to delete prediction:", error)
      toast.error(t('history.deleteError'), { description: error.message })
    }
  }

  const handleDownload = async (prediction: PredictionHistoryItem) => {
    const url = prediction.processedMediaUrl
    if (!url) {
      toast.error("Không tìm thấy đường dẫn file để tải xuống.");
      return;
    }

    const downloadToast = toast.loading("Đang chuẩn bị file tải xuống...");

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const primaryDetection = prediction.detections.reduce((prev, current) => 
        (prev.confidence > current.confidence) ? prev : current, 
        prediction.detections[0]
      );

      const breedName = primaryDetection?.breedName.replace(/\s+/g, '_') || 'prediction';
      const extension = url.split('.').pop() || (prediction.media.type === 'image' ? 'jpg' : 'mp4');
      const filename = `${breedName}_${prediction.id}.${extension}`;

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl); // Dọn dẹp URL tạm thời
      toast.success("Tải xuống thành công!", { id: downloadToast });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Tải xuống thất bại. Vui lòng thử lại.", { id: downloadToast });
    }
  }

  const getSourceText = (source: PredictionHistoryItem['source']) => {
    switch (source) {
      case 'image_upload': return t('history.sourceImage');
      case 'video_upload': return t('history.sourceVideo');
      case 'stream_capture': return t('history.sourceStream');
      case 'manual_add': return t('pokedex.sourceManual'); // Tận dụng key đã có
      default: return source;
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-foreground/70 mb-4">{t("history.loginRequired")}</p>
        <Link href="/">
          <Button>{t("nav.detect")}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("history.title")}</h1>
        <p className="text-foreground/70">{t("history.subtitle")}</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Input
          placeholder={t("history.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:col-span-2"
        />

        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
          <SelectTrigger>
            <SelectValue placeholder={t("history.filterType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.typeAll")}</SelectItem>
            <SelectItem value="image">{t("history.typeImage")}</SelectItem>
            <SelectItem value="video">{t("history.typeVideo")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger>
            <SelectValue placeholder={t("history.sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("history.sortNewest")}</SelectItem>
            <SelectItem value="oldest">{t("history.sortOldest")}</SelectItem>
            <SelectItem value="confidence">{t("history.sortConfidence")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredPredictions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-foreground/70 mb-4">{t("history.noPredictions")}</p>
          <Link href="/">
            <Button>{t("nav.detect")}</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPredictions.map((prediction) => (
            <Card key={prediction.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Thumbnail */}
              <div className="relative overflow-hidden bg-gradient-to-br from-muted to-muted/50 aspect-square flex items-center justify-center bg-black">
                {prediction.source === 'image_upload' || prediction.source === 'stream_capture' ? (
                  <img
                    src={prediction.processedMediaUrl || "/placeholder.svg"}
                    alt={prediction.detections[0]?.detectedBreed || 'Detection'}
                    className="object-cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                    <div className="text-center">
                      <Video className="h-10 w-10 text-primary mx-auto mb-2" />
                      <p className="text-sm text-foreground/70">{t("history.videoFile")}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="mb-3">
                  <h3 className="font-semibold text-lg mb-1 truncate">
                    {prediction.detections.map(d => d.breedName).join(', ') || 'Unknown'}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground/70">
                      {/* Hiển thị confidence của kết quả cao nhất */}
                      {t("history.confidence")}: {(Math.max(...prediction.detections.map(p => p.confidence)) * 100).toFixed(1)}%
                    </span>
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                      {prediction.source === 'image_upload' && (
                        <Camera className="h-3 w-3" />
                      )}
                      {prediction.source === 'video_upload' && (
                        <Video className="h-3 w-3" />
                      )}
                      {prediction.source === 'stream_capture' && (
                        <Webcam className="h-3 w-3" />
                      )}
                      {prediction.source === 'manual_add' && (
                        <PlusSquare className="h-3 w-3" />
                      )}
                      <span>{getSourceText(prediction.source)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-foreground/60 mb-4">
                  <Calendar className="h-3 w-3" />
                  {new Date(prediction.createdAt).toLocaleString()}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link href={`/results?id=${prediction.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                      <Eye className="h-4 w-4 mr-2" />
                      {t("history.view")}
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(prediction)}
                    title={t("history.download")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(prediction.id)}
                    title={t("history.delete")}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  )
}
