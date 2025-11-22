"use client";

import type React from "react"
import { useState, useEffect } from "react"
import { Upload, Camera, ImageIcon, Video, Sparkles, ScanSearch, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/lib/auth-context"
import { useAnalytics } from "@/lib/analytics-context"
import { useI18n } from "@/lib/i18n-context"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { useMounted } from '@/hooks/use-mounted'
import { ContactForm } from "@/components/contact-form"

export default function Home() {
  const mounted = useMounted()
  const { user, isAuthenticated, refetchUser } = useAuth()
  const { trackVisit } = useAnalytics()
  const { t } = useI18n()
  const router = useRouter()
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<"image" | "video" | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [detectionStatusMessage, setDetectionStatusMessage] = useState("")

  useEffect(() => {
    trackVisit("home")
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile()
          if (blob) {
            const file = new File([blob], "pasted-image.png", { type: blob.type })
            handleFileSelect(file)
            break 
          }
        }
      }
    }
    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [trackVisit])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    if (file.type.startsWith("image/")) setFileType("image")
    else if (file.type.startsWith("video/")) setFileType("video")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      handleFileSelect(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const runDetectionSimulation = () => {
    setUploadProgress(0)
    setTimeout(() => { setDetectionStatusMessage(t("home.simulation.uploading")); setUploadProgress(40) }, 100)
    setTimeout(() => { setDetectionStatusMessage(t("home.simulation.preparing")); setUploadProgress(65) }, 1500)
    setTimeout(() => { setDetectionStatusMessage(t("home.simulation.analyzing")); setUploadProgress(90) }, 3500)
    setTimeout(() => { setDetectionStatusMessage(t("home.simulation.finishing")) }, 6500)
  }

  const handleDetect = async () => {
    if (selectedFile && previewUrl) {
      setIsDetecting(true)
      setError(null)
      runDetectionSimulation()
      try {
        const onProgress = (progress: number) => console.log(`Upload: ${progress}%`)
        let response
        if (fileType === "image") response = await apiClient.predictImage(selectedFile, onProgress)
        else if (fileType === "video") response = await apiClient.predictVideo(selectedFile, onProgress)
        
        setUploadProgress(100)
        setDetectionStatusMessage(t("home.simulation.success"))
        if (isAuthenticated) await refetchUser()
        router.push(`/results?id=${response.predictionId}`)
      } catch (error: any) {
        console.error("Prediction failed:", error)
        setError(error.message || t("home.detectionFailed"))
        setIsDetecting(false)
        setUploadProgress(0)
        setDetectionStatusMessage("")
      }
    }
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setFileType(null)
    setError(null)
    setUploadProgress(0)
    setDetectionStatusMessage("")
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50 animate-pulse-slow" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-30" />
      </div>

      {/* Padding giảm trên mobile (py-8) tăng trên desktop (md:py-20) */}
      <div className="container mx-auto px-4 py-1 md:py-5">
        
        {/* HERO SECTION - Tối ưu kích thước chữ mobile */}
        <div className="text-center mb-5 md:mb-10 relative z-10">
         
          {/* Mobile: text-4xl, Desktop: text-7xl */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 md:mb-6 tracking-tight text-balance leading-tight">
            {t("home.heroTitle")} <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary  to-ring block md:inline mt-1">
               DOGDEX AI
            </span>
          </h1>
          
          <p className="text-base md:text-md text-muted-foreground text-balance max-w-2xl mx-auto leading-relaxed hidden sm:block">
            {t("home.heroDescription")}
          </p>
          {/* Mobile Description ngắn gọn hơn */}
          <p className="text-sm text-muted-foreground text-balance max-w-xs mx-auto leading-relaxed sm:hidden">
            {t("home.heroDescription")}
          </p>
        </div>

        {/* MAIN UPLOAD CARD */}
        <div className="max-w-3xl mx-auto relative z-20">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-ring rounded-[2rem] blur opacity-20 transition duration-500 group-hover:opacity-40"></div>
          
          <Card className="relative p-1 border-0 bg-background/40 backdrop-blur-xl shadow-2xl rounded-3xl md:rounded-[2rem] overflow-hidden">
            <div className="bg-background/60 backdrop-blur-sm p-4 md:p-10 rounded-[1.4rem] md:rounded-[1.8rem] h-full border border-white/10">
              
              {!selectedFile ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  className={`
                    relative group cursor-pointer
                    border-2 border-dashed rounded-2xl md:rounded-3xl p-6 md:p-12 text-center transition-all duration-300 ease-out
                    flex flex-col items-center justify-center gap-4 md:gap-6 min-h-[250px] md:min-h-[300px]
                    ${isDragging 
                      ? "border-primary bg-primary/10 scale-[1.02]" 
                      : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5"
                    }
                  `}
                >
                  <div className="p-4 md:p-6 bg-gradient-to-br from-primary to-secondary rounded-full shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="h-6 w-6 md:h-10 md:w-10 text-white" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg md:text-xl font-bold">{t("home.dragDropTitle")}</h3>
                    <p className="text-sm md:text-base text-muted-foreground max-w-sm mx-auto hidden md:block">
                      {t("home.dragDropDescription")}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto md:hidden">
                      Chạm để chọn ảnh hoặc video
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-2 w-full">
                    <label className="cursor-pointer flex-1 md:flex-none">
                      <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
                      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors font-medium text-sm w-full md:w-auto">
                        <ImageIcon className="h-4 w-4" />
                        {t("home.selectImage")}
                      </div>
                    </label>
                    <label className="cursor-pointer flex-1 md:flex-none">
                      <input type="file" accept="video/*" onChange={handleFileInput} className="hidden" />
                      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors font-medium text-sm w-full md:w-auto">
                        <Video className="h-4 w-4" />
                        {t("home.selectVideo")}
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                // PREVIEW STATE
                <div className="space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className="relative rounded-2xl overflow-hidden bg-black/90 border border-white/10 shadow-inner group">
                    {fileType === "image" && previewUrl && (
                      <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[400px] md:max-h-[500px] object-contain mx-auto" />
                    )}
                    {fileType === "video" && previewUrl && (
                      <video src={previewUrl} controls className="w-full h-auto max-h-[400px] md:max-h-[500px] object-contain mx-auto" />
                    )}
                    {!isDetecting && (
                      <Button variant="destructive" size="sm" onClick={resetUpload} className="absolute top-2 right-2 md:top-4 md:right-4 z-10 shadow-lg">
                        Change
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 md:gap-6">
                    <Button 
                      onClick={handleDetect} 
                      className="w-full h-12 md:h-14 text-base md:text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-violet-600 hover:from-violet-600 hover:to-primary shadow-lg shadow-primary/25" 
                      disabled={isDetecting}
                    >
                      {isDetecting ? (
                        <div className="flex items-center gap-2">
                           <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           {t("home.detecting")}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <ScanSearch className="h-5 w-5" />
                          {t("home.detectButton")}
                        </div>
                      )}
                    </Button>
                  </div>

                  {isDetecting && (
                    <div className="space-y-3 p-4 rounded-xl bg-secondary/50 border border-border/50">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-primary animate-pulse">{detectionStatusMessage}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-3 bg-secondary rounded-full overflow-hidden [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-blue-500" />
                    </div>
                  )}

                  {error && (
                    <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-center text-sm font-medium border border-destructive/20">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* FEATURES - Ẩn bớt trên mobile nếu cần gọn, hoặc giữ nguyên */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mt-12 md:mt-24 max-w-5xl mx-auto">
          {[
            { icon: Camera, title: t("home.feature1Title"), desc: t("home.feature1Description"), color: "text-blue-400", bg: "bg-blue-400/10" },
            { icon: Zap, title: t("home.feature2Title"), desc: t("home.feature2Description"), color: "text-purple-400", bg: "bg-purple-400/10" },
            { icon: ScanSearch, title: t("home.feature3Title"), desc: t("home.feature3Description"), color: "text-pink-400", bg: "bg-pink-400/10" },
          ].map((feature, idx) => (
            <div key={idx} className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/20 transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 md:mt-32 relative">
           <div className="max-w-xl mx-auto">
             <div className="text-center mb-8 md:mb-12">
               <h2 className="text-2xl md:text-4xl font-bold mb-4">{t("home.contactTitle")}</h2>
               <p className="text-muted-foreground">{t("home.contactDescription")}</p>
             </div>
             <ContactForm />
           </div>
        </div>
      </div>
    </main>
  )
}