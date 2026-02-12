"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  RefreshCcw, // Thay icon lật camera cho đúng nghĩa
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResultModal } from "@/components/result-modal";
import { Slider } from "@/components/ui/slider";

// --- CẤU HÌNH ---
const SEND_WIDTH = 640;
const COMPRESSION_QUALITY = 0.6;
const STREAM_TOKEN_COST = 5;

// --- TYPES ---
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

// --- SUB-COMPONENTS (Moved outside to prevent re-creation) ---
const TipsContent = () => {
  const { t } = useI18n();
  return (
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
};

export default function LiveDetectionPage() {
  const { t } = useI18n();
  const { user, setAuthModalOpen } = useAuth();

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Optimization: Reusable canvas for streaming to avoid GC thrashing
  const sendCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Logic Control Refs
  const isWaitingResponseRef = useRef(false);
  const isStreamingRef = useRef(false);
  const snapshotThresholdRef = useRef<number>(0.7);
  const capturedTrackIdsRef = useRef<Set<number>>(new Set());
  const isIntentionalCloseRef = useRef(false);
  const facingModeRef = useRef<"user" | "environment">("environment");

  // --- STATE ---
  const [isStreamingState, setIsStreamingState] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotRow[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  // facingMode state chỉ dùng để trigger UI update, logic chính dùng facingModeRef
  const [, setFacingModeState] = useState<"user" | "environment">("environment");

  // State UI
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [isTipsOpen, setIsTipsOpen] = useState(false);

  // --- ZOOM STATE ---
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);

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

    // Init canvas once
    if (!sendCanvasRef.current) {
      sendCanvasRef.current = document.createElement("canvas");
    }
    const off = sendCanvasRef.current;
    const ratio = video.videoHeight / video.videoWidth;

    // Update dimensions if needed (handling rotation/resize)
    const targetHeight = SEND_WIDTH * ratio;
    if (off.width !== SEND_WIDTH || off.height !== targetHeight) {
      off.width = SEND_WIDTH;
      off.height = targetHeight;
    }

    const ctx = off.getContext("2d", { willReadFrequently: true }); // Opt: willReadFrequently
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

  const createSnapshotItem = useCallback((
    detection: DetectionBox,
    video: HTMLVideoElement
  ): SnapshotItem | null => {
    const scale = video.videoWidth / SEND_WIDTH;
    const [x1, y1, x2, y2] = detection.box;

    const realX = Math.floor(x1 * scale);
    const realY = Math.floor(y1 * scale);
    const realW = Math.floor((x2 - x1) * scale);
    const realH = Math.floor((y2 - y1) * scale);

    // Canvas crop
    const cropCv = document.createElement("canvas");
    cropCv.width = realW;
    cropCv.height = realH;
    cropCv.getContext("2d")?.drawImage(video, realX, realY, realW, realH, 0, 0, realW, realH);

    // Canvas full
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
  }, []);

  const processAutoSnapshot = useCallback((currentDetections: DetectionBox[]) => {
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
  }, [createSnapshotItem]);

  const cleanupResources = useCallback(() => {
    isIntentionalCloseRef.current = true;
    isStreamingRef.current = false;
    setIsStreamingState(false);
    setIsConnected(false);
    setIsConnecting(false);
    setDetections([]); // Clear boxes UI
    isWaitingResponseRef.current = false;
    setZoomCapabilities(null); // Reset zoom capabilities

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = async () => {
    if (isStreamingRef.current) return;
    setIsConnecting(true);
    isIntentionalCloseRef.current = false;

    // Check token
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
        setIsConnected(true);
        setIsConnecting(false);

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingModeRef.current,
              width: { ideal: 1280 },
              height: { ideal: 720 },
              // @ts-ignore: zoom might not be in standard types yet
              zoom: true,
            },
          });
          streamRef.current = stream;

          // CHECK ZOOM CAPABILITIES
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities() as any;

          if (capabilities.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min,
              max: capabilities.zoom.max,
              step: capabilities.zoom.step,
            });
            setZoomLevel(capabilities.zoom.min);
          } else {
            setZoomCapabilities(null);
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Chờ video load metadata để có kích thước chuẩn
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(e => console.error("Play error:", e));
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
          console.error(camError);
          toast.error("Không thể bật Camera", {
            description: "Vui lòng kiểm tra quyền truy cập camera.",
          });
          cleanupResources();
        }
      };

      ws.onmessage = (e) => {
        if (!isStreamingRef.current) return;
        try {
          const data = JSON.parse(e.data);
          const dets = data.detections || (Array.isArray(data) ? data : []);
          setDetections(dets);
          processAutoSnapshot(dets);
        } catch (err) {
          console.error("Parse error", err);
        } finally {
          isWaitingResponseRef.current = false;
          // Sử dụng setTimeout 0 để đẩy xuống cuối event loop, tránh block UI
          requestAnimationFrame(sendNextFrame);
        }
      };

      ws.onclose = (event) => {
        if (isIntentionalCloseRef.current) return;

        if (event.code === 4001) {
          toast.error(t("errors.insufficientTokensStream"));
        } else if (event.code !== 1000 && event.code !== 1005) {
          // Chỉ báo lỗi nếu mất kết nối bất thường khi đang live
          if (isConnected) {
            toast.error("Mất kết nối máy chủ AI");
          }
        }
        cleanupResources();
      };

      ws.onerror = (err) => {
        console.error("WS Error:", err);
      };
    } catch (e) {
      toast.error("Lỗi kết nối máy chủ");
      cleanupResources();
    }
  };

  const handleFlipCameraClick = async () => {
    // 1. Dừng stream hiện tại
    cleanupResources();

    // 2. Đổi chế độ
    const newMode = facingModeRef.current === "user" ? "environment" : "user";
    facingModeRef.current = newMode;
    setFacingModeState(newMode);

    // 3. Khởi động lại (nhanh nhất có thể)
    // Dùng timeout nhỏ để đảm bảo resource cũ đã release xong
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  const handleZoom = async (value: number[]) => {
    const newZoom = value[0];
    setZoomLevel(newZoom);

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoom } as any],
        });
      } catch (err) {
        console.error("Zoom error:", err);
      }
    }
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

  // Resize handler
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

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch(`${apiClient.getBaseUrl()}/bff/predict/config`);
        const data = await res.json();
        if (data.config?.stream_high_conf) {
          snapshotThresholdRef.current = Math.max(0.6, data.config.stream_high_conf - 0.1);
        }
      } catch { }
    };
    loadConfig();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isIntentionalCloseRef.current = true;
      cleanupResources();
    };
  }, [cleanupResources]);

  // --- RENDER BOXES LOGIC ---
  // --- RENDER BOXES LOGIC ---
  const renderBoxes = useMemo(() => {
    if (!videoSize.width || !videoSize.height || !videoRef.current) return null;

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return null;

    // Calculate actual displayed video dimensions (handling object-fit: contain)
    const videoRatio = video.videoWidth / video.videoHeight;
    const elementRatio = videoSize.width / videoSize.height;

    let displayWidth = videoSize.width;
    let displayHeight = videoSize.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elementRatio > videoRatio) {
      // Element is wider -> Pillarbox (bars on sides)
      displayWidth = videoSize.height * videoRatio;
      offsetX = (videoSize.width - displayWidth) / 2;
    } else {
      // Element is taller -> Letterbox (bars on top/bottom)
      displayHeight = videoSize.width / videoRatio;
      offsetY = (videoSize.height - displayHeight) / 2;
    }

    // Scale from SEND_WIDTH (backend coords) to Display Size
    const scale = displayWidth / SEND_WIDTH;

    return detections.map((det, idx) => {
      const [x1, y1, x2, y2] = det.box;

      // Calculate style with offsets
      const style: React.CSSProperties = {
        left: x1 * scale + offsetX,
        top: y1 * scale + offsetY,
        width: (x2 - x1) * scale,
        height: (y2 - y1) * scale,
        transition: "all 0.1s linear",
      };

      const isConfident = det.confidence > 0.8;

      return (
        <div
          key={det.track_id ?? idx}
          className="absolute border-2 rounded-lg cursor-pointer group z-20 hover:border-white hover:z-30"
          style={{
            ...style,
            borderColor: isConfident ? "#22c55e" : "#eab308"
          }}
          onClick={() => {
            if (videoRef.current) {
              const snap = createSnapshotItem(det, videoRef.current);
              if (snap) handleOpenModal(snap);
            }
          }}
        >
          <div
            className={cn(
              "absolute -top-7 left-0 px-2 py-0.5 rounded-t-md text-xs font-bold text-black transition-colors whitespace-nowrap shadow-sm",
              isConfident ? "bg-green-500" : "bg-yellow-500"
            )}
          >
            {det.class} {Math.round(det.confidence * 100)}%
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity rounded-lg">
            <Maximize2 className="text-white w-8 h-8 drop-shadow-md" />
          </div>
        </div>
      );
    });
  }, [detections, videoSize, createSnapshotItem]);

  return (
    <div className="container mx-auto p-0 md:p-4 min-h-[90vh] flex flex-col">
      <ResultModal
        isOpen={!!selectedSnapshot}
        onClose={() => setSelectedSnapshot(null)}
        resultData={selectedSnapshot}
        onCleanup={cleanupResources}
      />

      {/* --- MOBILE: TIPS ACCORDION --- */}
      <div className="lg:hidden mb-3 mx-2 mt-2">
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
              isTipsOpen ? "max-h-[500px] opacity-100 border-t" : "max-h-0 opacity-0"
            )}
          >
            <div className="p-4 bg-card"><TipsContent /></div>
          </div>
        </div>
      </div>

      {/* --- DESKTOP HEADER --- */}
      <div className="hidden lg:flex justify-between items-center mb-4 p-4 bg-card rounded-xl shadow-sm border">
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleFlipCameraClick}
            disabled={!isStreamingState}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Flip Cam
          </Button>
          <Button
            onClick={isStreamingState ? cleanupResources : startCamera}
            variant={isStreamingState ? "destructive" : "default"}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : isStreamingState ? (
              "Stop Stream"
            ) : (
              "Start Camera"
            )}
          </Button>
        </div>
      </div>

      {/* --- MAIN LAYOUT --- */}
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* LEFT: TIPS SIDEBAR (DESKTOP) */}
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
        <div className="flex-1 bg-black lg:rounded-xl relative overflow-hidden border-y lg:border-2 border-gray-800 shadow-xl group min-h-[calc(100vh-140px)] lg:min-h-0 lg:h-[70vh]">
          {/* FIX: object-contain để bounding box khớp với hình ảnh */}
          <video
            ref={videoRef}
            muted playsInline
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* OVERLAY BOXES */}
          {isStreamingState && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
              <div
                className="relative pointer-events-auto"
                style={{ width: videoSize.width, height: videoSize.height }}
              >
                {renderBoxes}
              </div>
            </div>
          )}

          {/* ZOOM SLIDER (MOBILE & DESKTOP) */}
          {isStreamingState && zoomCapabilities && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 h-48 z-40 flex flex-col items-center gap-2 bg-black/20 backdrop-blur-sm p-2 rounded-full border border-white/10">
              <span className="text-[10px] font-bold text-white drop-shadow-md">{zoomCapabilities.max}x</span>
              <Slider
                orientation="vertical"
                min={zoomCapabilities.min}
                max={zoomCapabilities.max}
                step={zoomCapabilities.step}
                value={[zoomLevel]}
                onValueChange={handleZoom}
                className="h-full"
              />
              <span className="text-[10px] font-bold text-white drop-shadow-md">{zoomCapabilities.min}x</span>
            </div>
          )}
          {/* MOBILE SNAPSHOTS OVERLAY (RIGHT COLUMN) */}
          <div className="lg:hidden absolute right-2 top-20 bottom-32 w-14 flex flex-col gap-3 overflow-y-auto py-2 z-40 scrollbar-none pointer-events-auto items-center">
            {snapshotRows.flatMap(row => row.items).map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenModal(item)}
                className="shrink-0 w-10 h-10 relative cursor-pointer group animate-in slide-in-from-right-4 fade-in duration-300"
              >
                <img
                  src={item.imageBase64}
                  className="w-full h-full rounded-md object-cover border-2 border-white bg-black/20 shadow-lg"
                  alt=""
                />
              </div>
            ))}
          </div>
          {/* MOBILE CONTROLS OVERLAY */}
          <div className="lg:hidden absolute inset-0 z-50 pointer-events-none flex flex-col justify-between p-4">
            {/* Top Bar */}
            <div className="flex justify-between items-start pointer-events-auto mt-2">
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", isConnected ? "bg-green-500" : "bg-yellow-500")} />
                <span className="text-xs font-medium text-white">
                  {isConnecting ? "Connecting..." : isConnected ? "Live" : "Ready"}
                </span>
              </div>

              <button
                onClick={handleFlipCameraClick}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-95 transition-transform"
              >
                <RefreshCcw className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Bottom Bar - Shutter Button */}
            <div className="flex justify-center items-center mb-8 pointer-events-auto">
              <button
                onClick={isStreamingState ? cleanupResources : startCamera}
                disabled={isConnecting}
                className={cn(
                  "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-sm",
                  isStreamingState
                    ? "border-red-500 bg-red-500/20 hover:bg-red-500/30"
                    : "border-white bg-white/20 hover:bg-white/30"
                )}
              >
                {isConnecting ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <div className={cn(
                    "rounded-full transition-all duration-300",
                    isStreamingState ? "w-8 h-8 bg-red-500 rounded-md" : "w-16 h-16 bg-white"
                  )} />
                )}
              </button>
            </div>
          </div>

          {!isStreamingState && !isConnecting && (
            <div className="absolute inset-0 hidden lg:flex flex-col items-center justify-center text-gray-500 bg-gray-900/90 pointer-events-none">
              <Camera className="w-16 h-16 opacity-30 mb-4" />
              <p className="hidden lg:block">Tap "Start Camera" to detect</p>
            </div>
          )}
        </div>

        {/* RIGHT: SNAPSHOTS SIDEBAR */}
        <div className="hidden lg:flex w-full lg:w-72 bg-muted/20 rounded-xl border flex flex-col h-auto lg:h-[70vh] shadow-inner shrink-0 mb-4 lg:mb-0">
          <div className="p-3 border-b flex justify-between items-center bg-card rounded-t-xl h-14">
            <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
              <Clock size={14} className="text-primary" /> Captured ({snapshotRows.length})
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

          <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin min-h-[150px] max-h-[30vh] lg:max-h-none">
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