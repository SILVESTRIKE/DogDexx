// result/page.tsx
"use client"
import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type {BffPredictionResponse, Detection } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CheckCircle, Heart, Activity, Brain, Wind, MapPin, Ruler, Calendar, AlertTriangle, User } from "lucide-react"
import Link from "next/link"
import { FeedbackForm } from "@/components/feedback-form"
import { useI18n } from "@/lib/i18n-context"
import { useMounted } from "@/hooks/use-mounted"
import { apiClient } from "@/lib/api-client"
import { useAuth } from '@/lib/auth-context';

export default function ResultsPage() {
  const router = useRouter()
  const mounted = useMounted()
  
  const [allDetections, setAllDetections] = useState<Detection[]>([])
  const [primaryDetection, setPrimaryDetection] = useState<Detection | null>(null)
  const [predictionId, setPredictionId] = useState<string | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [processedMediaUrl, setProcessedMediaUrl] = useState<string | null>(null);
  const [noDetectionsFound, setNoDetectionsFound] = useState(false);
  const { t } = useI18n()
  const { user } = useAuth();

  useEffect(() => {
    const resultData = sessionStorage.getItem("detection-result")

    if (!resultData) {
      router.push("/")
      return
    }

    try {
      const result: BffPredictionResponse = JSON.parse(resultData)
      console.log("Processed Image URL:", result.processedMediaUrl);
      setProcessedMediaUrl(result.processedMediaUrl);
      
      // Only track trial usage for guest users
      if (!user && result.predictionId) {
        apiClient.trackEvent('SUCCESSFUL_PREDICTION', { predictionId: result.predictionId })
          .catch(analyticsError => {
            console.warn("Guest prediction tracking failed:", analyticsError);
          });
      }

      if (!result.detections || result.detections.length === 0) {
        setNoDetectionsFound(true);
        return;
      }

      const primary = result.detections.reduce((prev, current) => 
        prev.confidence > current.confidence ? prev : current
      )
      
      setAllDetections(result.detections)
      setPredictionId(result.predictionId)
      setPrimaryDetection(primary)
      setSelectedDetection(primary) // Mặc định chọn con chó chính

    } catch (error) {
      console.error("[v0] Failed to parse prediction result:", error)
      router.push("/")
    }
  }, [router, user])
  
  const handleSelectionChange = (selectionKey: string) => {
    const index = parseInt(selectionKey.split('-').pop() || '0', 10);
    if (allDetections[index]) {
      setSelectedDetection(allDetections[index]);
    }
  };

  if (!mounted) {
    return null;
  }

  if (noDetectionsFound) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-4">
            <Card className="max-w-md mx-auto p-8">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-destructive/10 rounded-full">
                        <AlertTriangle className="h-10 w-10 text-destructive" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-3">{t("results.noDetectionsTitle")}</h2>
                <p className="text-muted-foreground mb-6">{t("results.noDetectionsDescription")}</p>
                <Link href="/">
                    <Button className="gap-2">
                        <ArrowLeft className="h-5 w-5" />
                        {t("results.tryAgain")}
                    </Button>
                </Link>
            </Card>
        </div>
      </main>
    )
  }

  if (!primaryDetection || !primaryDetection.breedInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }
  
  const primaryBreedInfo = primaryDetection.breedInfo;
  // FIX: primaryBreedInfo có thể không có display_name nếu không tìm thấy trong wiki, dùng slug thay thế
  const primaryDisplayName = (primaryBreedInfo as any).display_name || primaryBreedInfo.slug.replace(/-/g, ' ');

  const primaryConfidence = Math.round(primaryDetection.confidence * 100);
  
  const selectedBreedInfo = selectedDetection?.breedInfo;
  const selectedDisplayName = (selectedBreedInfo as any)?.display_name || selectedBreedInfo?.slug.replace(/-/g, ' ');

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold">
            <ArrowLeft className="h-5 w-5" />
            {t("results.detectAnother")}
          </Link>
        </div>

        {/* === SECTION 1: THẺ KẾT QUẢ CHÍNH === */}
        <Card className="mb-8 border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl">{t("results.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Ảnh đã xử lý với tất cả bounding box */}
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                {processedMediaUrl && (processedMediaUrl.endsWith('.mp4') ? 
                  (
                    <video
                      src={processedMediaUrl}
                      className="w-full h-full object-contain"
                      controls
                      autoPlay
                      loop
                      muted
                    />
                  ) : (
                    <img 
                      src={processedMediaUrl} 
                      alt="Detection result" 
                      className="w-full h-auto object-contain" />
                  )
                )}
              </div>

              {/* Thông tin của con chó có độ tin cậy cao nhất */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{primaryDisplayName}</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="default" className="text-sm px-3 py-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      {primaryBreedInfo.group || t("results.unknownOrigin")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{t("results.confidence")}</span>
                    <span className="font-bold text-primary">{primaryConfidence}%</span>
                  </div>
                  <Progress value={primaryConfidence} className="h-3" />
                </div>
                <Button
                  onClick={() => router.push(`/dog/${primaryBreedInfo.slug}`)}
                  size="lg"
                  className="w-full gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  {t("results.addToCollection")}
                </Button>
                <Link href={`/dog/${primaryBreedInfo.slug}`}>
                  <Button variant="outline" size="lg" className="w-full bg-transparent">
                    {t("results.viewDetails")}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === SECTION 2: KHÁM PHÓ CHI TIẾT (TƯƠNG TÁC) === */}
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold">{t("results.detailsTitle")}</h2>
            {allDetections.length > 1 && (
              <Select
                onValueChange={handleSelectionChange}
                value={`${selectedDetection?.detectedBreed}-${allDetections.indexOf(selectedDetection!)}`}
              >
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder={t("results.selectBreedPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {allDetections.map((det, index) => (
                    <SelectItem 
                      key={`${det.detectedBreed}-${index}`}
                      value={`${det.detectedBreed}-${index}`}
                    >
                      {`${(det.breedInfo as any)?.display_name || det.detectedBreed.replace(/-/g, ' ')} (${Math.round(det.confidence * 100)}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedBreedInfo ? (
            <>
              {/* Các thẻ thông tin chi tiết, dữ liệu lấy từ `selectedBreedInfo` */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-2">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />{t("results.characteristics")}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2"><span className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />{t("results.energy")}</span><span className="text-sm font-bold">{selectedBreedInfo.energy_level ?? '?'}/5</span></div>
                      <Progress value={(selectedBreedInfo.energy_level ?? 0) * 20} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2"><span className="text-sm font-medium flex items-center gap-2"><Brain className="h-4 w-4 text-secondary" />{t("results.trainability")}</span><span className="text-sm font-bold">{selectedBreedInfo.trainability ?? '?'}/5</span></div>
                      <Progress value={(selectedBreedInfo.trainability ?? 0) * 20} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2"><span className="text-sm font-medium flex items-center gap-2"><Wind className="h-4 w-4 text-accent" />{t("results.shedding")}</span><span className="text-sm font-bold">{selectedBreedInfo.shedding_level ?? '?'}/5</span></div>
                      <Progress value={(selectedBreedInfo.shedding_level ?? 0) * 20} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" />{t("results.physicalInfo")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><p className="text-sm text-muted-foreground">{t("results.height")}</p><p className="font-semibold">{selectedBreedInfo.height}</p></div>
                    <div><p className="text-sm text-muted-foreground">{t("results.weight")}</p><p className="font-semibold">{selectedBreedInfo.weight}</p></div>
                    <div><p className="text-sm text-muted-foreground">{t("results.lifespan")}</p><p className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />{selectedBreedInfo.life_expectancy}</p></div>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader><CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-primary" />{t("results.temperament")}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedBreedInfo.temperament?.slice(0, 6).map((trait) => (<Badge key={trait} variant="secondary">{trait}</Badge>))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-2">
                <CardHeader><CardTitle>{t("results.description")}</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground leading-relaxed">{selectedBreedInfo.description}</p></CardContent>
              </Card>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t("results.noDetails")}</p>
          )}
        </div>
        <div className="h-4" />
        {/* === SECTION 3: FORM PHẢN HỒI === */}
        <FeedbackForm
          detectedBreed={primaryDisplayName}
          confidence={primaryConfidence}
          imageUrl={""} 
          predictionId={predictionId}
        />
      </div>
    </main>
  )
}