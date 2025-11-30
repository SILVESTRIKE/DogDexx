"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { BffPredictionResponse, Detection } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, BookOpen, Heart, Activity, Brain, Wind, MapPin, Ruler, Calendar, AlertTriangle, Loader2 } from "lucide-react"
import Link from "next/link"
import { FeedbackForm } from "@/components/feedback-form"
import { useI18n } from "@/lib/i18n-context"
import { apiClient } from "@/lib/api-client"
import { useAuth } from '@/lib/auth-context';
import { BreedChatBox } from "@/components/breed-chat-box";
import { HealthRecommendations } from "@/components/health_rec";
import { RecommendedProducts } from "@/components/product_rec";

function ResultsContent() {
  const { t, locale } = useI18n()
  const { user } = useAuth();
  const searchParams = useSearchParams()
  const router = useRouter()
  const historyId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [predictionId, setPredictionId] = useState<string>("")
  const [processedMediaUrl, setProcessedMediaUrl] = useState<string | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [allDetections, setAllDetections] = useState<Detection[]>([])
  const [noDetectionsFound, setNoDetectionsFound] = useState(false)
  const [specialMessage, setSpecialMessage] = useState<string | null>(null)
  const [hasFeedback, setHasFeedback] = useState(false);

  // --- POLLING LOGIC ---
  const pollForStatus = async (id: string) => {
    let attempts = 0;
    const maxAttempts = 20; // 20 * 1s = 20s timeout

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError("Timeout waiting for prediction result.");
        setLoading(false);
        return;
      }

      try {
        const status = await apiClient.getPredictionStatus(id);
        console.log("Polling status:", status);

        if (status.status === 'completed') {
          // Nếu đã hoàn thành và có kết quả -> Dừng polling và lấy dữ liệu
          if (status.result) {
            console.log("Polling completed, fetching final history...");
            fetchHistoryById();
            return;
          }
        } else if (status.status === 'failed') {
          setError(status.message || "Prediction failed.");
          setLoading(false);
          return;
        } else {
          // Still processing or queued
          attempts++;
          setTimeout(poll, 1000);
        }
      } catch (e) {
        console.error("Polling error:", e);
        attempts++;
        setTimeout(poll, 1000);
      }
    };

    poll();
  };

  const processResultData = (result: BffPredictionResponse) => {
    setPredictionId(result.predictionId);
    setProcessedMediaUrl(result.processedMediaUrl || null);
    setHasFeedback(result.hasFeedback || false);

    if ((!result.detections || result.detections.length === 0) && !result.message) {
      setNoDetectionsFound(true);
      return;
    }
    setSpecialMessage(null); // Reset message nếu có detections

    if (result.message) {
      setSpecialMessage(result.message);
      // Nếu có message nhưng vẫn có detections (trường hợp warning), vẫn hiển thị detections
      if (!result.detections || result.detections.length === 0) {
        setLoading(false);
        return;
      }
    }

    const primary = result.detections.reduce((prev, current) =>
      prev.confidence > current.confidence ? prev : current
    );

    setAllDetections(result.detections);
    setSelectedDetection(primary);
  };

  const fetchHistoryById = async () => {
    if (!historyId) return;
    setLoading(true);

    try {
      const result: BffPredictionResponse = await apiClient.getPredictionHistoryById(historyId, locale);

      // Check if result is still processing (placeholder)
      if (result.processedMediaUrl === 'processing' || (result.processedMediaUrl && result.processedMediaUrl.includes('processing'))) {
        console.log("Result is still processing, starting poll...");
        pollForStatus(historyId);
      } else {
        processResultData(result);
        setLoading(false);
      }
    } catch (err) {
      console.error("[ResultsPage] Failed to fetch prediction history:", err);
      console.log("Trying to poll status as fallback...");
      pollForStatus(historyId);
    }
  };

  useEffect(() => {
    if (!historyId) {
      setError(t("results.invalidId") || "Invalid Prediction ID");
      setLoading(false);
      return;
    }

    fetchHistoryById();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyId, locale]); // Chạy lại khi locale thay đổi


  const handleSelectionChange = (selectionKey: string) => {
    const index = parseInt(selectionKey.split('-').pop() || '0', 10);
    if (allDetections[index]) {
      setSelectedDetection(allDetections[index]);
    }
  };

  // ----- GIAO DIỆN CHO CÁC TRẠNG THÁI MỚI -----
  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">{t('common.error')}</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/"><Button>{t('common.back')}</Button></Link>
        </Card>
      </main>
    )
  }

  // ----- GIAO DIỆN MỚI: HIỂN THỊ KHI CÓ THÔNG BÁO ĐẶC BIỆT (VD: KHÔNG PHẢI CHÓ) -----
  if (specialMessage) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
          <Card className="mb-8">
            <CardContent className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-square flex items-center justify-center max-w-xl mx-auto">
                {processedMediaUrl && (processedMediaUrl.endsWith('.mp4') ?
                  (
                    <video src={processedMediaUrl} className="w-full h-full object-contain" controls autoPlay loop muted />
                  ) : (
                    <img src={processedMediaUrl} alt="Processed media" className="w-full h-full object-contain" />
                  )
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="p-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-yellow-500/10 rounded-full">
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">{t("results.specialMessageTitle")}</h2>
            <p className="text-muted-foreground mb-6 text-lg">{specialMessage}</p>
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

  // ----- GIAO DIỆN GỐC CỦA BẠN -----
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

  if (!selectedDetection || !selectedDetection.breedInfo) {
    // Trường hợp này có thể coi là một lỗi nếu dữ liệu không nhất quán
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Data Error</h2>
          <p className="text-muted-foreground mb-6">Could not display details. The result data might be incomplete.</p>
          <Link href="/"><Button>Go to Homepage</Button></Link>
        </Card>
      </main>
    )
  }

  const selectedBreedInfo = selectedDetection.breedInfo;
  const selectedDisplayName = selectedBreedInfo.breed;
  const selectedConfidence = Math.round(selectedDetection.confidence * 100);
  const isDog = selectedBreedInfo.group !== "Object / Other";
  const uniqueDetections = allDetections.reduce((acc, current, index) => {
    const existingIndex = acc.findIndex(item => item.detection.detectedBreed === current.detectedBreed);
    if (existingIndex === -1) {
      acc.push({ detection: current, index });
    } else {
      if (current.confidence > acc[existingIndex].detection.confidence) {
        acc[existingIndex] = { detection: current, index };
      }
    }
    return acc;
  }, [] as { detection: Detection, index: number }[]);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold">
            <ArrowLeft className="h-5 w-5" />
            {t("results.detectAnother")}
          </Link>
        </div>

        <Card className="mb-8 border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl">{t("results.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* --- CỘT TRÁI: ẢNH/VIDEO --- */}
              <div className="relative rounded-lg overflow-hidden bg-linear-to-br from-muted to-muted/50 aspect-square flex items-center justify-center max-w-xl mx-auto">
                {processedMediaUrl && (processedMediaUrl.endsWith('.mp4') ?
                  (
                    <video
                      src={processedMediaUrl}
                      className="w-full h-full object-contain z-10"
                      controls
                      autoPlay
                      loop
                      muted
                    />
                  ) : (
                    <>
                      <img
                        src={processedMediaUrl}
                        alt="Background"
                        className="absolute inset-0 w-full h-full object-cover scale-125 blur-xl opacity-50"
                      />
                      <img
                        src={processedMediaUrl}
                        alt="Detection result"
                        className="relative w-full h-full object-contain z-10" />
                    </>
                  )
                )}
              </div>

              {/* --- CỘT PHẢI: THÔNG TIN CƠ BẢN --- */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{selectedDisplayName}</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {isDog ? (
                      <Link href={`/dogdex?filter=${encodeURIComponent(selectedBreedInfo.group || '')}`}>
                        <Badge variant="default" className="text-sm px-3 py-1 hover:bg-primary/80 hover:text-primary-foreground transition-colors cursor-pointer">
                          <MapPin className="h-3 w-3 mr-1" />
                          {selectedBreedInfo.group || t("results.unknownOrigin")}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {selectedBreedInfo.group}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{t("results.confidence")}</span>
                    <span className="font-bold text-primary">{selectedConfidence}%</span>
                  </div>
                  <Progress value={selectedConfidence} className="h-3" />
                </div>

                {/* --- CHỈ HIỆN CÁC NÚT ĐIỀU HƯỚNG NẾU LÀ CHÓ --- */}
                {isDog && (
                  <>
                    <Button
                      onClick={() => router.push(`/dogdex?highlight=${selectedBreedInfo.pokedexNumber}`)}
                      size="lg"
                      className="w-full gap-2"
                    >
                      <BookOpen className="h-5 w-5" />
                      {t("results.viewInDogDex")}
                    </Button>
                    <Link href={`/breed/${selectedBreedInfo.slug}`}>
                      <Button variant="outline" size="lg" className="w-full bg-transparent">
                        {t("results.viewDetails")}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* --- THANH CHỌN ĐỐI TƯỢNG (DROPDOWN) --- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold">{t("results.detailsTitle")}</h2>
            {uniqueDetections.length > 1 && (
              <Select
                onValueChange={handleSelectionChange}
                value={`${selectedDetection?.detectedBreed}-${allDetections.indexOf(selectedDetection!)}`}
              >
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder={t("results.selectBreedPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {uniqueDetections.map(({ detection: det, index }) => (
                    <SelectItem
                      key={`${det.detectedBreed}-${index}`}
                      value={`${det.detectedBreed}-${index}`}
                    >
                      {`${det.breedInfo?.breed || det.detectedBreed.replace(/-/g, ' ')} (${Math.round(det.confidence * 100)}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedBreedInfo ? (
            <>
              {/* --- ĐIỀU KIỆN ẨN/HIỆN CHI TIẾT --- */}
              {isDog ? (
                <>
                  {/* --- NẾU LÀ CHÓ: HIỆN ĐẦY ĐỦ --- */}
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

                  <div className="space-y-8">
                    <HealthRecommendations breedSlug={selectedBreedInfo.slug} breedName={selectedBreedInfo.breed} />
                    <RecommendedProducts breedSlug={selectedBreedInfo.slug} breedName={selectedBreedInfo.breed} />
                  </div>
                </>
              ) : (
                // --- NẾU KHÔNG PHẢI LÀ CHÓ: HIỆN CARD THÔNG BÁO ĐƠN GIẢN ---
                <Card className="bg-muted/30 border-dashed border-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-5 w-5" />
                      Non-Dog Object Detected
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-lg text-center py-8 text-muted-foreground">
                    <p>{selectedBreedInfo.description}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t("results.noDetails")}</p>
          )}
        </div>

        <div className="h-4" />

        {/* Feedback form luôn hiện để user report nếu AI nhận diện sai */}
        <FeedbackForm
          detectedBreed={selectedDisplayName}
          confidence={selectedConfidence}
          imageUrl={""}
          predictionId={predictionId}
          initialSubmitted={hasFeedback}
        />

        {/* --- CHAT BOX: CHỈ HIỆN NẾU LÀ CHÓ --- */}
        {isDog && (
          <div className="mt-12">
            <BreedChatBox
              breedSlug={selectedBreedInfo.slug}
              breedName={selectedBreedInfo.breed}
            />
          </div>
        )}
      </div>
    </main>
  )
}


export default function ResultsPage() {
  return <ResultsContent />;
}