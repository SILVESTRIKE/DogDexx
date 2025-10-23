"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Upload, Camera, ImageIcon, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/lib/auth-context"
import { useAnalytics } from "@/lib/analytics-context"
import { useI18n } from "@/lib/i18n-context"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { useMounted } from '@/hooks/use-mounted'
import { toast } from "sonner"

export default function Home() {
  const mounted = useMounted()
  const { user } = useAuth()
  const { trackVisit } = useAnalytics()
  const { t } = useI18n()
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<"image" | "video" | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

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
            toast.info("Ảnh đã được dán từ clipboard.")
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

    if (file.type.startsWith("image/")) {
      setFileType("image")
    } else if (file.type.startsWith("video/")) {
      setFileType("video")
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDetect = async () => {
    if (selectedFile && previewUrl) {
      setIsDetecting(true)
      setIsProcessing(false)
      setUploadProgress(0)
      const detectionToast = toast.loading(t("home.uploadingFile"))

      try {
        const onProgress = (progress: number) => {
          setUploadProgress(progress)
          if (progress === 100) {
            // Khi tải lên xong, chuyển sang trạng thái xử lý
            setIsProcessing(true)
            toast.loading(t("home.processingFile"), { id: detectionToast })
          }
        };

        let response
        if (fileType === "image") {
          response = await apiClient.predictImage(selectedFile, onProgress)
        } else if (fileType === "video") {
          response = await apiClient.predictVideo(selectedFile, onProgress)
        }

        // SỬA LỖI: Điều hướng trực tiếp đến trang kết quả với ID, không dùng sessionStorage
        router.push(`/results?id=${response.predictionId}`)

        toast.success(t("results.title"), { id: detectionToast })
        // Không cần reset ở đây nữa vì sẽ chuyển trang

      } catch (error: any) {
        console.error("Prediction failed:", error)
        // Hiển thị popup lỗi chi tiết cho người dùng
        toast.error(t("home.detectionFailed"), {
          id: detectionToast,
          description: error.message || "An unknown error occurred. Please try again.",
        })
      } finally {
        // Nếu có lỗi, reset lại trạng thái để người dùng có thể thử lại
        if (!sessionStorage.getItem("detection-result")) {
            setIsDetecting(false)
            setUploadProgress(0)
            setIsProcessing(false)
        }
      }
    }
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setFileType(null)
    setUploadProgress(0)
    setIsProcessing(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
  }

  // Prevent hydration mismatch by not rendering the main content on the server
  if (!mounted) {
    return null; // or a loading spinner
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold mb-4 text-balance">{t("home.heroTitle")}</h1>
          <p className="text-lg text-muted-foreground text-balance max-w-2xl mx-auto">{t("home.heroDescription")}</p>
        </div>

        {/* Upload Section */}
        <div className="max-w-3xl mx-auto">
          <Card className="p-8">
            {!selectedFile ? ( // Giao diện khi chưa chọn file
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Upload className="h-12 w-12 text-primary" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-2">{t("home.dragDropTitle")}</h3>
                <p className="text-muted-foreground mb-6">{t("home.dragDropDescription")}</p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <label>
                    <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
                    <Button variant="outline" className="gap-2 cursor-pointer bg-transparent" asChild>
                      <span>
                        <ImageIcon className="h-4 w-4" />
                        {t("home.selectImage")}
                      </span>
                    </Button>
                  </label>

                  <label>
                    <input type="file" accept="video/*" onChange={handleFileInput} className="hidden" />
                    <Button variant="outline" className="gap-2 cursor-pointer bg-transparent" asChild>
                      <span>
                        <Video className="h-4 w-4" />
                        {t("home.selectVideo")}
                      </span>
                    </Button>
                  </label>
                </div>

                <p className="text-sm text-muted-foreground mt-6">{t("home.supportedFormats")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Preview */}
                <div className="relative rounded-lg overflow-hidden bg-black">
                  {fileType === "image" && previewUrl && (
                    <img
                      src={previewUrl || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full h-auto max-h-[500px] object-contain mx-auto"
                    />
                  )}
                  {fileType === "video" && previewUrl && (
                    <video src={previewUrl} controls className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {fileType === "image" ? (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Video className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={resetUpload} disabled={isDetecting}>
                    {t("home.selectAnother")}
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button onClick={handleDetect} className="flex-1 gap-2" size="lg" disabled={isDetecting}>
                    <Camera className="h-5 w-5" />
                    {isDetecting ? t("home.detecting") : t("home.detectButton")}
                  </Button>
                </div>

                {isDetecting && (
                  <div className="space-y-2 pt-4">
                    <Progress 
                      value={isProcessing ? undefined : uploadProgress} 
                      className="w-full" 
                    />
                    <p className="text-sm text-center text-muted-foreground">
                      {isProcessing ? t("home.processingFile") 
                        : `${t("home.uploading")} ${uploadProgress}%`}
                    </p>
                  </div>
                )}

                {!user && <p className="text-sm text-muted-foreground text-center">{t("home.loginToSave")}</p>}
              </div>
            )}
          </Card>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">{t("home.feature1Title")}</h3>
              <p className="text-sm text-muted-foreground">{t("home.feature1Description")}</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">{t("home.feature2Title")}</h3>
              <p className="text-sm text-muted-foreground">{t("home.feature2Description")}</p>
            </Card>

            <Card className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Video className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">{t("home.feature3Title")}</h3>
              <p className="text-sm text-muted-foreground">{t("home.feature3Description")}</p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}