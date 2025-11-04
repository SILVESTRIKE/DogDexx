"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
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

/**
 * Component con chứa logic chính để có thể sử dụng hook `useSearchParams`
 * một cách an toàn trong Next.js App Router.
 */
function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale } = useI18n()
  const { user } = useAuth();
  
  // State mới cho loading và error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State cũ của bạn
  const [allDetections, setAllDetections] = useState<Detection[]>([]) 
  const [predictionId, setPredictionId] = useState<string | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  const [processedMediaUrl, setProcessedMediaUrl] = useState<string | null>(null);
  const [noDetectionsFound, setNoDetectionsFound] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false); // State mới để lưu trạng thái feedback

  useEffect(() => {
    const historyId = searchParams.get('id');

    // Hàm helper để xử lý dữ liệu kết quả và cập nhật state
    const processResultData = (result: BffPredictionResponse) => {
      setHasFeedback(result.hasFeedback ?? false); // Cập nhật state từ response
      setProcessedMediaUrl(result.processedMediaUrl);
      
      if (!result.detections || result.detections.length === 0) {
        setNoDetectionsFound(true);
        return;
      }

      const primary = result.detections.reduce((prev, current) => 
        prev.confidence > current.confidence ? prev : current
      );
      
      setAllDetections(result.detections);
      setPredictionId(result.predictionId);
      setSelectedDetection(primary);
    };
    
    // Luồng logic mới: Luôn lấy dữ liệu từ historyId trên URL.
    if (!historyId) {
      setError("No prediction ID provided. Please go back and try again.");
      setLoading(false);
      return;
    }
    
    const fetchHistoryById = async () => {
      setLoading(true);
      try {
        const result: BffPredictionResponse = await apiClient.getPredictionHistoryById(historyId, locale);
        processResultData(result);
      } catch (err) {
        console.error("[ResultsPage] Failed to fetch prediction history:", err);
        setError("Failed to load prediction history. It may have been deleted or the link is invalid.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryById();

    // Không cần dọn dẹp sessionStorage nữa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]); // Chạy lại khi locale thay đổi

    // eslint-disable-next-line react-hooks/exhaustive-deps


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
              <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-muted to-muted/50 aspect-square flex items-center justify-center max-w-xl mx-auto">
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
              <div className="space-y-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{selectedDisplayName}</h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Link href={`/pokedex?filter=${encodeURIComponent(selectedBreedInfo.group || '')}`}>
                      <Badge variant="default" className="text-sm px-3 py-1 hover:bg-primary/80 hover:text-primary-foreground transition-colors cursor-pointer">
                        <MapPin className="h-3 w-3 mr-1" />
                        {selectedBreedInfo.group || t("results.unknownOrigin")}
                      </Badge>
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{t("results.confidence")}</span>
                    <span className="font-bold text-primary">{selectedConfidence}%</span>
                  </div>
                  <Progress value={selectedConfidence} className="h-3" />
                </div>
                <Button
                  onClick={() => router.push(`/pokedex?highlight=${selectedBreedInfo.slug}`)}
                  size="lg"
                  className="w-full gap-2"
                >
                  <BookOpen className="h-5 w-5" />
                  {t("results.viewInPokedex")}
                </Button>
                <Link href={`/dog/${selectedBreedInfo.slug}`}>
                  <Button variant="outline" size="lg" className="w-full bg-transparent">
                    {t("results.viewDetails")}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      {`${det.breedInfo?.breed || det.detectedBreed.replace(/-/g, ' ')} (${Math.round(det.confidence * 100)}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedBreedInfo ? (
            <>
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
        <FeedbackForm
          detectedBreed={selectedDisplayName}
          confidence={selectedConfidence}
          imageUrl={""} 
          predictionId={predictionId}
          initialSubmitted={hasFeedback} // Truyền trạng thái ban đầu xuống form
        />

        <div className="mt-12">
          <BreedChatBox
            breedSlug={selectedBreedInfo.slug}
            breedName={selectedBreedInfo.breed}
          />
        </div>
      </div>
    </main>
  )
}


export default function ResultsPage() {
  // Bọc ResultsContent để đảm bảo hook `useSearchParams` hoạt động đúng
  return <ResultsContent />;
}