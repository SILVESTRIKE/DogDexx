"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Loader2, Wifi, WifiOff } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { Detection, WebSocketError } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LiveDetectionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { isAuthenticated, refetchUser } = useAuth();

  // --- REFS (Logic Tối Ưu) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas hiển thị (vẽ box)
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null); // Canvas ảo (xử lý ảnh gửi đi)
  
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- STATE ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);

  const STREAM_FRAME_WIDTH = 640; // Resize ảnh để giảm băng thông mà AI vẫn nhận diện tốt

  // --- LOGIC 1: Stop Camera An Toàn ---
  const stopCamera = useCallback((reason: string = "Client stopped") => {
    // 1. Dừng interval gửi ảnh
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // 2. Dừng MediaStream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    // THÊM: Ngắt kết nối video element ngay lập tức
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }

    // 3. Đóng WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, reason);
      }
      wsRef.current = null;
    }

    // 4. Reset State & UI
    setIsStreaming(false);
    setIsConnected(false);
    setDetections([]);
    
    // Xóa canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (isAuthenticated) refetchUser();
  }, [isAuthenticated, refetchUser]);

  // --- LOGIC 2: Gửi Frame (Tối ưu Flow Control & Memory) ---
  const sendFrameToWebSocket = () => {
    const video = videoRef.current;
    const ws = wsRef.current;

    if (!video || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // TỐI ƯU: Flow Control - Nếu mạng lag (buffer đầy), bỏ qua frame này
    if (ws.bufferedAmount > 1024 * 1024) { 
       // console.warn("Skipping frame due to network lag");
       return;
    }

    // TỐI ƯU: Tái sử dụng Canvas ảo để tránh tạo mới liên tục (Memory Leak prevention)
    if (!processingCanvasRef.current) {
        processingCanvasRef.current = document.createElement("canvas");
    }
    const procCanvas = processingCanvasRef.current;
    
    const aspectRatio = video.videoHeight / video.videoWidth;
    const targetWidth = STREAM_FRAME_WIDTH;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    // Chỉ resize canvas khi cần thiết
    if (procCanvas.width !== targetWidth) procCanvas.width = targetWidth;
    if (procCanvas.height !== targetHeight) procCanvas.height = targetHeight;

    const ctx = procCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Nén ảnh JPEG 0.6
    const dataUrl = procCanvas.toDataURL("image/jpeg", 0.6);
    ws.send(dataUrl);
  };

  // --- LOGIC 3: Vẽ Bounding Box ---
  const drawBoundingBoxes = (results: Detection[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (videoWidth === 0 || videoHeight === 0) return;

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    results.forEach((result) => {
      if (!result.boundingBox) return;
      const { x, y, width, height } = result.boundingBox;

      // Style vẽ
      ctx.strokeStyle = "#3b82f6"; // Màu xanh UI cũ
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      const breedName = result.detectedBreed.replace(/-/g, " ");
      const confidenceText = (result.confidence * 100).toFixed(0);
      const labelText = `${breedName} (${confidenceText}%)`;

      ctx.font = "bold 20px sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const labelPadding = 8;
      const labelHeight = 30;
      let labelY = y - labelHeight;
      if (labelY < 0) labelY = y; // Tránh bị vẽ ra ngoài màn hình phía trên

      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x, labelY, textMetrics.width + labelPadding * 2, labelHeight);
      
      ctx.fillStyle = "#ffffff";
      ctx.fillText(labelText, x + labelPadding, labelY + labelHeight - 6);
    });
  };

  // --- LOGIC 4: Khởi tạo Socket ---
  const initializeWebSocket = async () => {
    return new Promise<WebSocket | null>(async (resolve) => {
      try {
        const ws = await apiClient.connectStreamPrediction();

        ws.onopen = () => {
          console.log("[Live] Connected");
          setIsConnected(true);
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // === XỬ LÝ LỖI ===
            if (data.type === 'error') {
              const errorData = data as WebSocketError;
              
              // Case 1: Hết tiền
              if (errorData.code === 'INSUFFICIENT_TOKENS') {
                toast.error(t('errors.insufficientTokensTitle') || "Hết lượt", {
                  description: t('errors.insufficientTokensForStream') || "Bạn không đủ token để tiếp tục.",
                });
                stopCamera("Insufficient tokens");
              } 
              // Case 2: Lỗi khác từ server (VD: Model chưa load, Server quá tải...)
              else {
                toast.error(t('live.serverError') || "Lỗi máy chủ", { 
                    description: errorData.message 
                });
              }
              
              // QUAN TRỌNG: Gọi stopCamera cho TẤT CẢ các trường hợp lỗi trên
              stopCamera("Server error: " + errorData.code); 
              resolve(null);
              return;
            }
            
            // === XỬ LÝ KẾT QUẢ ===
            if (data.type === "final_result") {
              stopCamera("Capture complete");
              if (data.predictionId) {
                  router.push(`/results?id=${data.predictionId}`);
              }
            } 
            else if (data.type === "endOfStream") {
              stopCamera("Server requested stop");
            } 
            else if (Array.isArray(data.detections)) {
              setDetections(data.detections);
              requestAnimationFrame(() => drawBoundingBoxes(data.detections));
            } 
          } catch (error) {
            console.error("WS parse error:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WS Error:", error);
          setIsConnected(false);
          toast.error(t("live.connectError") || "Mất kết nối máy chủ");
          // Đã có stopCamera ở đây -> OK
          stopCamera("Connection error");
          resolve(null);
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          // Nếu server đóng kết nối bất thường (không phải do client gọi close)
          if (event.code !== 1000 && event.code !== 1005) {
             // Có thể gọi stopCamera ở đây để clear UI nếu chưa clear
             if (isStreaming) stopCamera("Socket closed unexpectedly");
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("WS Init Failed:", error);
        toast.error(t("live.connectError") || "Không thể kết nối");
        stopCamera("Connection failed");
        resolve(null);
      }
    });
  };

  // --- LOGIC 5: Start Camera ---
  const startCamera = async () => {
    if (isStreaming || isConnecting) {
      stopCamera();
      return;
    }

    setIsConnecting(true);

    // BƯỚC 1: Kết nối WebSocket TRƯỚC KHI bật camera
    const ws = await initializeWebSocket();

    // BƯỚC 2: Nếu kết nối WebSocket thất bại, dừng lại
    if (!ws) {
      setIsConnecting(false);
      return;
    }

    // BƯỚC 3: Nếu kết nối thành công, TIẾP TỤC bật camera
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          streamRef.current = mediaStream;
          setIsStreaming(true);
          setDetections([]);
          setIsConnecting(false); // Hoàn tất kết nối
          // Bắt đầu gửi frame
          frameIntervalRef.current = setInterval(sendFrameToWebSocket, 200);
        };
      }
    } catch (err) {
      setIsConnecting(false);
      stopCamera("Camera access failed"); // Dọn dẹp WebSocket nếu không truy cập được camera
      console.error("Camera Access Error:", err);
      toast.error(t("live.cameraError") || "Không thể truy cập camera");
    }
  };

  useEffect(() => {
    return () => stopCamera("Component Unmount");
  }, [stopCamera]);

  // --- UI HELPER: Connection Badge ---
  const ConnectionStatus = () => {
    if (!isStreaming) return <Badge variant="secondary">Ready</Badge>;
    if (isConnecting) return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Connecting...</Badge>;
    if (isConnected) return <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700"><Wifi className="h-3 w-3" /> Connected</Badge>;
    return <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" /> Reconnecting</Badge>;
  };

  // --- MAIN RENDER (Giữ nguyên Layout UI Cũ của bạn) ---
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-0 lg:px-4 py-0 lg:py-8 max-w-6xl">
        
        {/* Header: Desktop Only */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-4xl font-bold mb-2">
            {t("live.title") || "Live Detection"}
          </h1>
          <p className="text-muted-foreground">
            {t("live.subtitle") || "Use camera for real-time dog breed detection"}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-0 lg:gap-6">
          {/* VIDEO COLUMN */}
          <div className="lg:col-span-2">
            <div
              className={cn(
                "relative overflow-hidden",
                // Mobile styles
                "h-[85vh] bg-black flex flex-col justify-center",
                // Desktop styles
                "lg:h-auto lg:bg-card lg:border-2 lg:rounded-lg lg:shadow-sm lg:p-6 lg:block"
              )}
            >
              {/* Desktop Card Header (Controls) */}
              <div className="hidden lg:flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 font-semibold text-lg">
                  {t("nav.live") || "Camera"}
                  <ConnectionStatus />
                </span>
                {isStreaming ? (
                  <Button
                    onClick={() => stopCamera()}
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                  >
                    <CameraOff className="h-4 w-4" /> {t("live.stopCamera")}
                  </Button>
                ) : (
                  <Button onClick={startCamera} size="sm" className="gap-2">
                    <Camera className="h-4 w-4" /> {t("live.startCamera")}
                  </Button>
                )}
              </div>

              {/* Video Container */}
              <div className="relative w-full h-full flex items-center justify-center bg-black lg:rounded-lg lg:overflow-hidden lg:aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain lg:object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-contain lg:object-cover pointer-events-none"
                />

                {/* Placeholder khi chưa bật cam */}
                {!isStreaming && !isConnecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-4 text-center z-10">
                    <Camera className="h-16 w-16 lg:h-20 lg:w-20 mb-4 opacity-50" />
                    <p className="text-white/70 lg:text-muted-foreground font-medium">
                      {t("live.clickToStart") || 'Click "Start Camera" to begin'}
                    </p>
                    {/* Nút start cho mobile nằm giữa màn hình nếu chưa chạy */}
                    <Button onClick={startCamera} size="lg" className="mt-4 lg:hidden rounded-full">
                        {t("live.startCamera")}
                    </Button>
                  </div>
                )}

                {/* MOBILE ONLY: Status Top Bar */}
                <div className="absolute top-4 left-4 z-20 lg:hidden">
                  <ConnectionStatus />
                </div>

                {/* MOBILE ONLY: Bottom Controls */}
                <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-20 px-4 lg:hidden">
                  {/* Popup kết quả trên Mobile */}
                  {isStreaming && detections.length > 0 && (
                    <div className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full border border-white/20 animate-in slide-in-from-bottom-2">
                      <span className="font-bold capitalize mr-2">
                        {detections[0].detectedBreed.replace(/-/g, " ")}
                      </span>
                      <span className="text-green-400">
                        {(detections[0].confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Nút Tắt/Bật Camera (Mobile) */}
                  {isStreaming && (
                    <Button
                      onClick={() => stopCamera()}
                      variant="destructive"
                      size="lg"
                      className="rounded-full h-16 w-16 p-0 shadow-lg border-4 border-white/20"
                    >
                      <CameraOff className="h-8 w-8" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SIDEBAR COLUMN (Desktop Only) */}
          <div className="lg:col-span-1 space-y-6 p-4 lg:p-0 hidden lg:block">
            <Card className="border-2 bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("live.instructions") || "Instructions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <p>• {t("live.instruction1") || "Ensure good lighting"}</p>
                <p>• {t("live.instruction2") || "Keep camera steady"}</p>
                <p>• {t("live.instruction3") || "Center the dog in frame"}</p>
                <p>• {t("live.instruction4") || "System will auto-detect"}</p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {t("live.detectionsTitle") || "Real-time Detections"} ({detections.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {detections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                     {isStreaming ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <span className="text-sm">{t("live.searching") || "Scanning..."}</span>
                        </div>
                     ) : (
                        <span className="text-sm italic">Camera is off</span>
                     )}
                  </div>
                ) : (
                  detections.map((det, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center text-sm border-b pb-2 last:border-b-0 last:pb-0"
                    >
                      <span className="font-medium capitalize">
                        {det.detectedBreed.replace(/-/g, " ")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {(det.confidence * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}