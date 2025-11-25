"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { PredictionHistoryItem } from "@/lib/types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HistoryCard } from "@/components/history-card" // Import component mới

function HistoryContent() {
  const { user, deletePredictionHistory } = useAuth()
  const { t } = useI18n()
  const [predictions, setPredictions] = useState<PredictionHistoryItem[]>([])
  const [filteredPredictions, setFilteredPredictions] = useState<PredictionHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<"all" | "image" | "video" | "stream">("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "confidence">("newest")

  const fetchHistory = useCallback(async (currentPage: number, isLoadMore = false) => {
    if (!user) return;
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await apiClient.getPredictionHistory({ page: currentPage, limit: 20 });
      setPredictions(prev => isLoadMore ? [...prev, ...(data.histories || [])] : (data.histories || []));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Failed to fetch history:", error);
      toast.error(t('history.fetchError'));
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, t]);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleLoadMore = () => {
    if (page < totalPages) fetchHistory(page + 1, true);
  };

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...predictions]

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((p) => 
        (filterType === 'stream' && p.source === 'stream_capture') ||
        (filterType !== 'stream' && p.media.type === filterType));
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
      await deletePredictionHistory(id);
      setPredictions(predictions.filter((p) => p.id !== id))
    } catch (error: any) { // The toast is now handled by the context
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
            <SelectItem value="stream">{t("history.sourceStream")}</SelectItem>
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
      {isLoading ? (
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
        <>
          {/* Áp dụng grid layout tương tự DogDex */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredPredictions.map((prediction) => (
              <HistoryCard
                key={prediction.id}
                prediction={prediction}
                onDelete={handleDelete}
                onDownload={handleDownload}
              />
            ))}
          </div>
          {page < totalPages && (
            <div className="flex justify-center mt-8">
              <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("history.loadMore")}
              </Button>
            </div>
          )}
        </>
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
