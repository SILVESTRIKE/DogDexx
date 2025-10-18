// live/page.tsx - Đã sửa lỗi Bounding Box và đảm bảo logic tắt camera
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Wifi, WifiOff } from "lucide-react";
import { useCollection } from "@/lib/collection-context";
import { apiClient } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n-context";
import { Detection } from "@/lib/types";

export default function LiveDetectionPage() {
  const router = useRouter();
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { refreshCollection, isCollected } = useCollection();
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = () => {
    try {
      const ws = apiClient.connectStreamPrediction();

      ws.onopen = () => {
        console.log("[BFF-WS] WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // QUAN TRỌNG: Xử lý luồng mới
          if (data.status === "redirect" && data.payload) {
            console.log(
              "[BFF-WS] Captured final result, redirecting...",
              data.payload
            );

            // 1. Dừng camera và websocket
            stopCamera("Redirecting");

            // 2. Lưu kết quả vào sessionStorage (CHỈ LƯU payload)
            sessionStorage.setItem(
              "detection-result",
              JSON.stringify(data.payload)
            );

            // 3. Chuyển hướng đến trang kết quả
            router.push("/results");

            // Sửa đổi nhẹ ở đây để tương thích với cấu trúc mới của BFF
          } else if (
            data &&
            data.payload &&
            Array.isArray(data.payload.detections)
          ) {
            // Nếu BFF trả về payload cho các dự đoán thông thường
            setDetections(data.payload.detections);
            drawBoundingBoxes(data.payload.detections);
          } else if (data && Array.isArray(data.detections)) {
            // Giữ lại logic cũ phòng trường hợp BFF vẫn gửi cấu trúc phẳng
            setDetections(data.detections);
            drawBoundingBoxes(data.detections);
          } else if (data.error) {
            const errorMessage = data.error || "An unknown error occurred.";
            console.error("[BFF-WS] Error from server:", errorMessage);
            alert(
              `${t("live.serverError") || "Server error"}: ${errorMessage}`
            );
            stopCamera("Error");
          }
        } catch (error) {
          console.error("[v0] Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = () => {
        console.error(
          "[BFF-WS] A WebSocket error occurred. See the 'onclose' event for details."
        );
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(
          `[BFF-WS] WebSocket disconnected: Code=${event.code}, Reason=${event.reason}`
        );
        setIsConnected(false);
        // Chỉ hiện thông báo và đóng nếu không phải do chuyển hướng (code 1000)
        if (
          isStreaming &&
          !event.reason.includes("Redirecting") &&
          !event.reason.includes("Error")
        ) {
          alert(
            t("live.disconnectedError") || "Connection lost. Please try again."
          );
          stopCamera("Unexpected Close");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[v0] Error connecting WebSocket:", error);
      alert(
        t("live.connectError") || "Failed to connect to the detection service."
      );
    }
  };

  const sendFrameToWebSocket = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");

    if (
      !video ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    // Prevent sending empty frames
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("[v0] Video frame has zero dimensions, skipping send.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Giảm chất lượng (0.6) để tăng tốc độ truyền tải
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(dataUrl);
    }
  };

  const startCamera = async () => {
    if (isStreaming) stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsStreaming(true);
        setDetections([]);

        connectWebSocket();

        // Gửi khung hình mỗi 200ms (5 FPS)
        frameIntervalRef.current = setInterval(() => {
          sendFrameToWebSocket();
        }, 200);
      }
    } catch (err) {
      console.error("[v0] Error accessing camera:", err);
      alert(
        t("live.cameraError") ||
          "Cannot access camera. Please check permissions."
      );
    }
  };

  // FIX: Đảm bảo stopCamera dừng tất cả các track
  const stopCamera = (reason: string = "Client initiated close") => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop()); // ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT
      setStream(null);
      setIsStreaming(false);
      setDetections([]);

      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }

      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, reason);
        }
        wsRef.current = null;
      }

      clearCanvas();
    }
  };

  // FIX: Hàm vẽ Bounding Box
  const drawBoundingBoxes = (results: Detection[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const canvasWidth = video.videoWidth || canvas.width;
    const canvasHeight = video.videoHeight || canvas.height;

    if (canvasWidth === 0 || canvasHeight === 0) return;

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    results.forEach((result) => {
      if (!result.boundingBox) return;

      const boxX = result.boundingBox.x;
      const boxY = result.boundingBox.y;
      const boxWidth = result.boundingBox.width;
      const boxHeight = result.boundingBox.height;

      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      const breedName = result.detectedBreed.replace(/-/g, " ");
      const confidenceText = (result.confidence * 100).toFixed(0);
      const labelText = `${breedName} (${confidenceText}%)`;
      ctx.font = "bold 16px sans-serif";

      const textMetrics = ctx.measureText(labelText);
      const labelPadding = 8;
      const labelHeight = 24;

      const labelY = Math.max(boxY - labelHeight, 0);

      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(
        boxX,
        labelY,
        textMetrics.width + labelPadding * 2,
        labelHeight
      );

      ctx.fillStyle = "#ffffff";
      ctx.fillText(labelText, boxX + labelPadding, labelY + labelHeight - 6);
    });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    return () => {
      stopCamera("Component Unmount");
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            {t("live.title") || "Live Detection"}
          </h1>
          <p className="text-muted-foreground">
            {t("live.subtitle") ||
              "Use camera for real-time dog breed detection"}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {t("nav.live") || "Camera"}
                    {isStreaming &&
                      (isConnected ? (
                        <Badge variant="default" className="gap-1">
                          <Wifi className="h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <WifiOff className="h-3 w-3" />
                          Connecting...
                        </Badge>
                      ))}
                  </span>
                  {isStreaming ? (
                    <Button
                      onClick={() => stopCamera()}
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                    >
                      <CameraOff className="h-4 w-4" />
                      {t("live.stopCamera") || "Stop Camera"}
                    </Button>
                  ) : (
                    <Button onClick={startCamera} size="sm" className="gap-2">
                      <Camera className="h-4 w-4" />
                      {t("live.startCamera") || "Start Camera"}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    width={1280}
                    height={720}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                  />
                  {!isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          {t("live.clickToStart") ||
                            'Click "Start Camera" to begin'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-2 bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("live.instructions") || "Instructions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>• {t("live.instruction1") || "Ensure good lighting"}</p>
                <p>• {t("live.instruction2") || "Keep camera steady"}</p>
                <p>• {t("live.instruction3") || "Center the dog in frame"}</p>
                <p>• {t("live.instruction4") || "System will auto-detect"}</p>
              </CardContent>
            </Card>

            <Card className="border-2 mt-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  Real-time Detections ({detections.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {detections.length === 0 && isStreaming ? (
                  <p className="text-muted-foreground">Looking for a dog...</p>
                ) : (
                  detections.map((det, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center text-sm border-b pb-1 last:border-b-0"
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
