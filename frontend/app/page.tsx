"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Camera,
  ImageIcon,
  Video,
  Sparkles,
  ScanSearch,
  Zap,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-context";
import { useAnalytics } from "@/lib/analytics-context";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useMounted } from "@/hooks/use-mounted";
import { ContactForm } from "@/components/contact-form";
import { motion } from "framer-motion";

export default function Home() {
  const mounted = useMounted();
  const { user, isAuthenticated, refetchUser } = useAuth();
  const { trackVisit } = useAnalytics();
  const { t } = useI18n();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detectionStatusMessage, setDetectionStatusMessage] = useState("");

  // Ref để quản lý timeouts, tránh lỗi khi component unmount
  const timeoutRefs = useRef<(NodeJS.Timeout | number)[]>([]);
  const cleanupPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);
  useEffect(() => {
    trackVisit("home");
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const file = new File([blob], "pasted-image.png", {
              type: blob.type,
            });
            handleFileSelect(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);

    // Cleanup function: Xóa URL và Timeouts khi thoát trang
    return () => {
      window.removeEventListener("paste", handlePaste);
      clearTimeouts();
      cleanupPreview();

      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [trackVisit, cleanupPreview, previewUrl]);

  // Thêm listener cho phím Enter
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Nếu nhấn Enter, có file được chọn và chưa bắt đầu dự đoán
      if (event.key === "Enter" && selectedFile && !isDetecting) {
        event.preventDefault(); // Ngăn hành vi mặc định (nếu có)
        handleDetect();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [selectedFile, isDetecting]); // Dependencies để hook chạy lại khi state thay đổi

  const clearTimeouts = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  };

  const handleFileSelect = (file: File) => {
    // Validate kích thước file nếu cần (ví dụ: max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError(t("home.fileTooLarge") || "File too large (Max 50MB)")
      return
    }

    cleanupPreview() // Xóa URL cũ trước khi tạo mới
    setSelectedFile(file)
    setError(null)
    
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    
    if (file.type.startsWith("image/")) setFileType("image")
    else if (file.type.startsWith("video/")) setFileType("video")
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.type.startsWith("image/") || file.type.startsWith("video/"))
    ) {
      handleFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const runDetectionSimulation = () => {
    setUploadProgress(0);
    clearTimeouts(); // Reset các timer cũ

    const t1 = setTimeout(() => {
      setDetectionStatusMessage(t("home.simulation.uploading"));
      setUploadProgress(40);
    }, 100);
    const t2 = setTimeout(() => {
      setDetectionStatusMessage(t("home.simulation.preparing"));
      setUploadProgress(65);
    }, 1500);
    const t3 = setTimeout(() => {
      setDetectionStatusMessage(t("home.simulation.analyzing"));
      setUploadProgress(90);
    }, 3500);
    const t4 = setTimeout(() => {
      setDetectionStatusMessage(t("home.simulation.finishing"));
    }, 6500);

    timeoutRefs.current.push(t1, t2, t3, t4);
  };

  const handleDetect = async () => {
    if ((selectedFile && previewUrl) || (activeTab === "url" && urlInput)) {
      setIsDetecting(true);
      setError(null);
      runDetectionSimulation();
      try {
        const onProgress = (progress: number) =>
          console.log(`Upload: ${progress}%`);
        let response;
        
        if (activeTab === "url") {
             if (!urlInput.trim()) throw new Error(t("home.errors.emptyUrl") || "Please enter a URL");
             response = await apiClient.predictUrl(urlInput);
        } else {
            if (fileType === "image")
            response = await apiClient.predictImage(selectedFile!, onProgress);
            else if (fileType === "video")
            response = await apiClient.predictVideo(selectedFile!, onProgress);
        }

        clearTimeouts(); // Dừng giả lập ngay khi có kết quả thật
        setUploadProgress(100);
        setDetectionStatusMessage(t("home.simulation.success"));

        if (isAuthenticated) await refetchUser();
        
        if (!response.predictionId) {
          throw new Error("Invalid response from server: Missing prediction ID");
        }

        router.push(`/results?id=${response.predictionId}`);
      } catch (error: any) {
        console.error("Prediction failed:", error);
        setError(error.message || t("home.detectionFailed"));
        setIsDetecting(false);
        setUploadProgress(0);
        setDetectionStatusMessage("");
        clearTimeouts();
      }
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setFileType(null);
    setUrlInput("");
    setError(null);
    setUploadProgress(0);
    setDetectionStatusMessage("");
    clearTimeouts();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Đã xóa phần Background Effects ở đây */}

      {/* Padding container */}
      <div className="container mx-auto px-4 py-1 md:py-5">
        {/* HERO SECTION */}
        <div className="text-center mb-5 md:mb-10 relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 md:mb-6 tracking-tight text-balance leading-tight">
            {t("home.heroTitle")} <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary  to-ring block md:inline mt-1">
              DOGDEX AI
            </span>
          </h1>

          <p className="text-base md:text-md text-muted-foreground text-balance max-w-2xl mx-auto leading-relaxed hidden sm:block">
            {t("home.heroDescription")}
          </p>
          <p className="text-sm text-muted-foreground text-balance max-w-xs mx-auto leading-relaxed sm:hidden">
            {t("home.heroDescription")}
          </p>
        </div>

        {/* MAIN UPLOAD CARD */}
        <div className="max-w-3xl mx-auto relative z-20">
          {/* Glow effect sau lưng card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-ring rounded-[2rem] blur opacity-20 transition duration-500 group-hover:opacity-40"></div>

          <Card className="relative p-1 border-0 bg-background/40 backdrop-blur-xl shadow-2xl rounded-3xl md:rounded-[2rem] overflow-hidden">
            <div className="bg-background/60 backdrop-blur-sm p-4 md:p-10 rounded-[1.4rem] md:rounded-[1.8rem] h-full border border-white/10">
              
              <Tabs defaultValue="upload" value={activeTab} onValueChange={(val) => { setActiveTab(val); resetUpload(); }} className="w-full mb-6">
                                <TabsList className="grid w-full grid-cols-2 mb-4 p-1 bg-muted/50 rounded-xl relative">
                  <TabsTrigger 
                    value="upload" 
                    disabled={isDetecting}
                    className="relative z-10 rounded-lg bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors duration-200"
                  >
                    {activeTab === "upload" && (
                      <motion.div
                        layoutId="active-tab-bg"
                        className="absolute inset-0 bg-gradient-to-r from-primary to-ring/80 rounded-lg -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="flex items-center justify-center relative z-20">
                      <Upload className="w-4 h-4 mr-2" />
                      {t("home.tabs.upload") || "Upload File"}
                    </span>
                  </TabsTrigger>
                  
                  <TabsTrigger 
                    value="url" 
                    disabled={isDetecting}
                    className="relative z-10 rounded-lg bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-primary-foreground data-[state=active]:shadow-none transition-colors duration-200"
                  >
                    {activeTab === "url" && (
                      <motion.div
                        layoutId="active-tab-bg"
                        className="absolute inset-0 bg-gradient-to-r from-primary to-ring/80 rounded-lg -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="flex items-center justify-center relative z-20">
                      <LinkIcon className="w-4 h-4 mr-2" />
                      {t("home.tabs.url") || "Paste URL"}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-0">
                  {!selectedFile ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      className={`
                        relative group cursor-pointer
                        border-2 border-dashed rounded-2xl md:rounded-3xl p-6 md:p-12 text-center transition-all duration-300 ease-out
                        flex flex-col items-center justify-center gap-4 md:gap-6 min-h-[250px] md:min-h-[300px]
                        ${
                          isDragging
                            ? "border-primary bg-primary/10 scale-[1.02]"
                            : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5"
                        }
                      `}
                    >
                      <div className="p-4 md:p-6 bg-gradient-to-br from-primary to-secondary rounded-full shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <Upload className="h-6 w-6 md:h-10 md:w-10 text-white" />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-lg md:text-xl font-bold">
                          {t("home.dragDropTitle")}
                        </h3>
                        <p className="text-sm md:text-base text-muted-foreground max-w-sm mx-auto hidden md:block">
                          {t("home.dragDropDescription")}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto md:hidden">
                          {t("home.dragDropDescriptionMobile")}
                        </p>
                      </div>

                      <div className="flex flex-wrap justify-center gap-3 md:gap-4 mt-2 w-full">
                        <label className="cursor-pointer flex-1 md:flex-none">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileInput}
                            className="hidden"
                          />
                          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors font-medium text-sm w-full md:w-auto">
                            <ImageIcon className="h-4 w-4" />
                            {t("home.selectImage")}
                          </div>
                        </label>
                        <label className="cursor-pointer flex-1 md:flex-none">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileInput}
                            className="hidden"
                          />
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
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-full h-auto max-h-[400px] md:max-h-[500px] object-contain mx-auto"
                          />
                        )}
                        {fileType === "video" && previewUrl && (
                          <video
                            src={previewUrl}
                            controls
                            className="w-full h-auto max-h-[400px] md:max-h-[500px] object-contain mx-auto"
                          />
                        )}
                        {!isDetecting && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={resetUpload}
                            className="absolute top-2 right-2 md:top-4 md:right-4 z-10 shadow-lg"
                          >
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
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="url" className="mt-0 space-y-6">
                    <div className="flex flex-col gap-4 min-h-[250px] md:min-h-[300px] justify-center">
                        <div className="space-y-2 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <LinkIcon className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold">{t("home.urlInputTitle") || "Enter Image URL"}</h3>
                            <p className="text-muted-foreground text-sm max-w-md mx-auto">
                                {t("home.urlInputDesc") || "Paste a link to an image (JPG, PNG, WebP) to identify the dog breed."}
                            </p>
                        </div>

                        <div className="max-w-md mx-auto w-full space-y-4">
                            <Input 
                                placeholder="https://example.com/dog.jpg" 
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                className="h-12 text-lg bg-background/50"
                                disabled={isDetecting}
                            />
                            
                            <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t("home.securityWarning")}</AlertTitle>
                                <AlertDescription className="text-xs">
                                    {t("home.securityWarningDesc")}
                                </AlertDescription>
                            </Alert>

                            <Button
                                onClick={handleDetect}
                                className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-primary to-violet-600 hover:from-violet-600 hover:to-primary shadow-lg shadow-primary/25"
                                disabled={isDetecting || !urlInput.trim()}
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
                    </div>
                </TabsContent>
              </Tabs>

              {/* Progress & Error Display (Shared) */}
              {isDetecting && (
                <div className="space-y-3 p-4 rounded-xl bg-secondary/50 border border-border/50 mt-4">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-primary animate-pulse">
                      {detectionStatusMessage}
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress
                    value={uploadProgress}
                    className="h-3 bg-secondary rounded-full overflow-hidden [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-blue-500"
                  />
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-center text-sm font-medium border border-destructive/20 mt-4">
                  {error}
                </div>
              )}

            </div>
          </Card>
        </div>

        {/* FEATURES */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 mt-12 md:mt-24 max-w-5xl mx-auto">
          {[
            {
              icon: Camera,
              title: t("home.feature1Title"),
              desc: t("home.feature1Description"),
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              icon: Zap,
              title: t("home.feature2Title"),
              desc: t("home.feature2Description"),
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
            {
              icon: ScanSearch,
              title: t("home.feature3Title"),
              desc: t("home.feature3Description"),
              color: "text-pink-400",
              bg: "bg-pink-400/10",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/20 transition-all duration-300"
            >
              <div
                className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* CONTACT */}
        <Card className="mt-20 md:mt-32 relative bg-gradient-to-b from-background/0 to-background/80 w-[100%] md:w-[50%] mx-auto px-10 border-0 shadow-2xl rounded-3xl md:rounded-[2rem] overflow-hidden">
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-4">
                {t("home.contactTitle")}
              </h2>
              <p className="text-muted-foreground">
                {t("home.contactDescription")}
              </p>
            </div>
            <ContactForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
