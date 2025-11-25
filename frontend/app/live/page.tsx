"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Camera,
  Loader2,
  Wifi,
  Clock,
  Trash2,
  Maximize2,
  Lightbulb,
  Video,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResultModal } from "@/components/result-modal";

// --- CẤU HÌNH ---
const SEND_WIDTH = 640;
const COMPRESSION_QUALITY = 0.6;
const STREAM_TOKEN_COST = 5; // Chi phí token cho mỗi phiên live stream

interface DetectionBox {
  track_id: number;
  class: string;
  confidence: number;
  box: number[]; // [x1, y1, x2, y2]
}

interface SnapshotItem {
  id: string;
  track_id: number;
  breedLabel: string;
  imageBase64: string;
  fullImageBase64: string;
  confidence: number;
  detectionData: any;
}

interface SnapshotRow {
  rowId: string;
  timestamp: number;
  items: SnapshotItem[];
}

export default function LiveDetectionPage() {
  const { t } = useI18n();
  const { user, setAuthModalOpen } = useAuth();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Logic Control Refs
  const isWaitingResponseRef = useRef(false);
  const isStreamingRef = useRef(false);
  const snapshotThresholdRef = useRef<number>(0.7);
  const capturedTrackIdsRef = useRef<Set<number>>(new Set());
  
  // FIX: Ref để theo dõi việc đóng kết nối chủ động (tránh lỗi 1005 khi chuyển trang)
  const isIntentionalCloseRef = useRef(false);

  // State
  const [isStreamingState, setIsStreamingState] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotRow[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  // State UI
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [isTipsOpen, setIsTipsOpen] = useState(false); // State cho Mobile Tips Accordion

  // ==========================================================
  // LOGIC
  // ==========================================================
  const sendNextFrame = useCallback(() => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !videoRef.current ||
      videoRef.current.paused ||
      !isStreamingRef.current ||
      isWaitingResponseRef.current
    )
      return;

    const video = videoRef.current;
    const off = document.createElement("canvas");
    const ratio = video.videoHeight / video.videoWidth;
    off.width = SEND_WIDTH;
    off.height = SEND_WIDTH * ratio;

    const ctx = off.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, off.width, off.height);

    off.toBlob(
      (blob) => {
        if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
          isWaitingResponseRef.current = true;
          wsRef.current.send(blob);
        }
      },
      "image/webp",
      COMPRESSION_QUALITY
    );
  }, []);

  const createSnapshotItem = (
    detection: DetectionBox,
    video: HTMLVideoElement
  ): SnapshotItem | null => {
    const scale = video.videoWidth / SEND_WIDTH;
    const [x1, y1, x2, y2] = detection.box;

    const realX = Math.floor(x1 * scale);
    const realY = Math.floor(y1 * scale);
    const realW = Math.floor((x2 - x1) * scale);
    const realH = Math.floor((y2 - y1) * scale);

    const cropCv = document.createElement("canvas");
    cropCv.width = realW;
    cropCv.height = realH;
    cropCv
      .getContext("2d")
      ?.drawImage(video, realX, realY, realW, realH, 0, 0, realW, realH);

    const fullCv = document.createElement("canvas");
    fullCv.width = video.videoWidth;
    fullCv.height = video.videoHeight;
    fullCv.getContext("2d")?.drawImage(video, 0, 0);

    return {
      id: crypto.randomUUID(),
      track_id: detection.track_id,
      breedLabel: detection.class,
      imageBase64: cropCv.toDataURL("image/jpeg", 0.7),
      fullImageBase64: fullCv.toDataURL("image/jpeg", 0.7),
      confidence: detection.confidence,
      detectionData: {
        ...detection,
        box: [realX, realY, realX + realW, realY + realH],
      },
    };
  };

  const processAutoSnapshot = (currentDetections: DetectionBox[]) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const validDetections = currentDetections.filter(
      (d) => d.confidence > snapshotThresholdRef.current && d.track_id !== null
    );

    const hasNewId = validDetections.some(
      (d) => !capturedTrackIdsRef.current.has(d.track_id)
    );

    if (hasNewId) {
      const rowItems: SnapshotItem[] = [];
      validDetections.forEach((d) => {
        if (!capturedTrackIdsRef.current.has(d.track_id)) {
          const item = createSnapshotItem(d, video);
          if (item) {
            rowItems.push(item);
            capturedTrackIdsRef.current.add(d.track_id);
          }
        }
      });

      if (rowItems.length > 0) {
        setSnapshotRows((prev) =>
          [
            {
              rowId: crypto.randomUUID(),
              timestamp: Date.now(),
              items: rowItems,
            },
            ...prev,
          ].slice(0, 10)
        );
      }
    }
  };

  const cleanupResources = useCallback(() => {
    isIntentionalCloseRef.current = true; // Đánh dấu là chủ động tắt để onclose không báo lỗi
    isStreamingRef.current = false;
    setIsStreamingState(false);
    setIsConnected(false);
    setIsConnecting(false);
    setDetections([]);

    if (streamRef.current)
      streamRef.current.getTracks().forEach((t) => t.stop());
    
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    } 
    
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = async () => {
    if (isStreamingRef.current) return;
    setIsConnecting(true);
    isIntentionalCloseRef.current = false; // Reset cờ khi bắt đầu kết nối mới

    // --- KIỂM TRA TOKEN PHÍA CLIENT ---
    if (user && user.remainingTokens < STREAM_TOKEN_COST) {
      toast.error(t("errors.insufficientTokensStream"), {
        description: t("errors.insufficientTokensStreamDesc", {
          required: STREAM_TOKEN_COST,
          remaining: user.remainingTokens,
        }),
        action: {
          label: t("common.upgrade"),
          onClick: () => setAuthModalOpen(true),
        },
      });
      setIsConnecting(false);
      return;
    }

    try {
      const ws = await apiClient.connectStreamPrediction();
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("WebSocket connection established. Now starting camera.");
        setIsConnected(true);
        setIsConnecting(false);

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              isStreamingRef.current = true;
              setIsStreamingState(true);
              setVideoSize({
                width: videoRef.current?.offsetWidth || 0,
                height: videoRef.current?.offsetHeight || 0,
              });
              requestAnimationFrame(sendNextFrame);
            };
          }
        } catch (camError) {
          toast.error("Không thể bật Camera", {
            description: "Vui lòng cấp quyền truy cập camera và thử lại.",
          });
          cleanupResources();
        }
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const dets = data.detections || (Array.isArray(data) ? data : []);
          setDetections(dets);
          processAutoSnapshot(dets);
        } catch (err) {
        } finally {
          isWaitingResponseRef.current = false;
          requestAnimationFrame(sendNextFrame);
        }
      };

      ws.onclose = (event) => {
        console.log(
          `WebSocket closed with code: ${event.code}, reason: ${event.reason}`
        );

        // 1. Nếu đóng chủ động (chuyển trang/stop) -> Không báo lỗi
        if (isIntentionalCloseRef.current) {
            return;
        }

        // 2. Nếu mã đóng là bình thường (1000, 1005) -> cleanup nhẹ nhàng
        if (event.code === 1000 || event.code === 1005) {
            cleanupResources();
            return;
        }

        // 3. Xử lý lỗi thực sự
        if (!isConnected || isStreamingRef.current) {
          if (event.code === 4001) {
            // Mã lỗi tùy chỉnh cho "Insufficient Tokens"
            toast.error(t("errors.insufficientTokensStream"), {
              description: t("errors.insufficientTokensStreamDesc", {
                required: STREAM_TOKEN_COST,
                remaining: user?.remainingTokens ?? 0,
              }),
              action: {
                label: t("common.upgrade"),
                onClick: () => setAuthModalOpen(true),
              },
            });
          } else {
            toast.error("Kết nối AI bị ngắt", {
              description: `Mã lỗi: ${event.code}`,
            });
          }
        }
        cleanupResources();
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    } catch (e) {
      toast.error("Không thể khởi tạo kết nối tới máy chủ AI.");
      cleanupResources();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current) {
        setVideoSize({
          width: videoRef.current.offsetWidth,
          height: videoRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
        isIntentionalCloseRef.current = true; // Đánh dấu chủ động đóng khi unmount
        cleanupResources();
    };
  }, [cleanupResources]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch(`${apiClient.getBaseUrl()}/config`);
        const data = await res.json();
        if (data.config?.stream_high_conf) {
          snapshotThresholdRef.current = Math.max(
            0.6,
            data.config.stream_high_conf - 0.1
          );
        }
      } catch {}
    };
    loadConfig();
  }, []);

  const renderBoxes = () => {
    if (!videoSize.width || !videoSize.height) return null;
    const scale = videoSize.width / SEND_WIDTH;

    return detections.map((det, idx) => {
      const [x1, y1, x2, y2] = det.box;
      const style: React.CSSProperties = {
        left: x1 * scale,
        top: y1 * scale,
        width: (x2 - x1) * scale,
        height: (y2 - y1) * scale,
        transition: "all 0.1s linear",
      };
      const isConfident = det.confidence > 0.8;

      return (
        <div
          key={det.track_id ?? idx}
          className="absolute border-2 rounded-lg cursor-pointer group z-20 hover:border-white hover:z-30"
          style={{ ...style, borderColor: isConfident ? "#22c55e" : "#eab308" }}
          onClick={() => {
            if (videoRef.current) {
              const snap = createSnapshotItem(det, videoRef.current);
              if (snap) handleOpenModal(snap);
            }
          }}
        >
          <div
            className={cn(
              "absolute -top-7 left-0 px-2 py-0.5 rounded-t-md text-xs font-bold text-black transition-colors whitespace-nowrap",
              isConfident ? "bg-green-500" : "bg-yellow-500"
            )}
          >
            {det.class} {Math.round(det.confidence * 100)}%
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
            <Maximize2 className="text-white w-8 h-8 drop-shadow-md" />
          </div>
        </div>
      );
    });
  };

  const handleOpenModal = (item: SnapshotItem) => {
    setSelectedSnapshot({
      predictionId: "temp",
      processedMediaUrl: item.imageBase64,
      rawBase64: item.fullImageBase64.split(",")[1],
      detections: [
        {
          ...item.detectionData,
          detectedBreed: item.breedLabel,
          breedInfo: { breed: item.breedLabel, slug: "loading" },
        },
      ],
    });
  };

  // --- REUSABLE TIPS CONTENT ---
  const TipsContent = () => (
    <div className="space-y-3">
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4 mt-1 text-primary shrink-0" />
        <span>{t("live.tips.tip1")}</span>
      </div>
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <Video className="w-4 h-4 mt-1 text-primary shrink-0" />
        <span>{t("live.tips.tip2")}</span>
      </div>
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <Target className="w-4 h-4 mt-1 text-primary shrink-0" />
        <span>{t("live.tips.tip3")}</span>
      </div>
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <Camera className="w-4 h-4 mt-1 text-primary shrink-0" />
        <span>{t("live.tips.tip4")}</span>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-2 md:p-4 min-h-[90vh] flex flex-col">
      <ResultModal
        isOpen={!!selectedSnapshot}
        onClose={() => setSelectedSnapshot(null)}
        resultData={selectedSnapshot}
        onCleanup={cleanupResources}
      />

      {/* --- MOBILE ONLY: TIPS COMBOBOX (TOP) --- */}
      <div className="lg:hidden mb-3">
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <button
            onClick={() => setIsTipsOpen(!isTipsOpen)}
            className="w-full flex items-center justify-between p-3 bg-muted/30 active:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-semibold text-sm">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              {t("live.tips.title")}
            </span>
            {isTipsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <div
            className={cn(
              "transition-all duration-200 ease-in-out overflow-hidden",
              isTipsOpen
                ? "max-h-[500px] opacity-100 border-t"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="p-4 bg-card">
              <TipsContent />
            </div>
          </div>
        </div>
      </div>

      {/* Header Controls */}
      <div className="flex justify-between items-center mb-4 p-4 bg-card rounded-xl shadow-sm border">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Realtime AI</h1>
          <span
            className={cn(
              "text-xs font-medium flex items-center gap-1",
              isConnected ? "text-green-600" : "text-yellow-500"
            )}
          >
            <Wifi size={12} /> {isConnected ? "Connected" : "Ready"}
          </span>
        </div>
        <Button
          onClick={isStreamingState ? cleanupResources : startCamera}
          variant={isStreamingState ? "destructive" : "default"}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <Loader2 className="animate-spin" />
          ) : isStreamingState ? (
            "Stop Stream"
          ) : (
            "Start Camera"
          )}
        </Button>
      </div>

      {/* MAIN LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* LEFT: TIPS SIDEBAR */}
        <div className="hidden lg:flex flex-col w-72 shrink-0 lg:h-[70vh]">
          <Card className="h-full border-dashed bg-muted/10 shadow-sm flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                {t("live.tips.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto scrollbar-thin">
              <TipsContent />
            </CardContent>
          </Card>
        </div>

        {/* CENTER: VIEWPORT CAMERA */}
        <div className="flex-1 bg-black rounded-xl relative overflow-hidden border-2 border-gray-800 shadow-xl group aspect-video lg:aspect-auto lg:h-[70vh]">
          <video 
            ref={videoRef} 
            muted playsInline 
            className="w-full h-full object-contain pointer-events-none" 
          />
          <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
             <div className="relative w-full h-full pointer-events-auto">
                {isStreamingState && renderBoxes()}
             </div>
          </div>
          {!isStreamingState && !isConnecting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900/90">
               <Camera className="w-16 h-16 opacity-30 mb-4" />
               <p>Tap "Start Camera" to detect</p>
            </div>
          )}
        </div>

        {/* RIGHT: SIDEBAR SNAPSHOTS */}
        <div className="w-full lg:w-72 bg-muted/20 rounded-xl border flex flex-col h-auto lg:h-[70vh] shadow-inner shrink-0">
          <div className="p-3 border-b flex justify-between items-center bg-card rounded-t-xl h-14">
            <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Captured (
              {snapshotRows.length})
            </h3>
            {snapshotRows.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSnapshotRows([]);
                  capturedTrackIdsRef.current.clear();
                }}
                className="h-6 w-6 text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={12} />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin min-h-[150px]">
            {snapshotRows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs text-center p-4">
                <Info className="w-8 h-8 mb-2 opacity-20" />
                <span>Waiting for detections...</span>
              </div>
            )}
            {snapshotRows.map((row) => (
              <div
                key={row.rowId}
                className="bg-card border rounded-lg p-2 shadow-sm animate-in slide-in-from-right-4"
              >
                <div className="text-[10px] text-muted-foreground mb-2 flex justify-between px-1">
                  <span>{new Date(row.timestamp).toLocaleTimeString()}</span>
                  <span className="font-mono text-primary">
                    {row.items.length} obj
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {row.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenModal(item)}
                      className="shrink-0 w-16 cursor-pointer group relative"
                    >
                      <img
                        src={item.imageBase64}
                        className="w-16 h-16 rounded-md object-cover border bg-black/10 group-hover:ring-2 ring-primary transition-all"
                        alt=""
                      />
                      <div className="text-[9px] font-bold text-center truncate mt-1 text-foreground/80">
                        {item.breedLabel}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}