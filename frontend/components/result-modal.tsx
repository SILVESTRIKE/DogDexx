"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, X, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultData: any; // Chứa rawBase64 và detectionData
  onCleanup?: () => void;
}

export function ResultModal({ isOpen, onClose, resultData, onCleanup }: ResultModalProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>("");

  useEffect(() => {
    if (isOpen && resultData) {
      setPreviewImage(resultData.processedMediaUrl); // Mặc định là ảnh crop nhỏ xem trước
    }
  }, [isOpen, resultData]);

  if (!resultData) return null;
  const detection = resultData.detections[0];
  const confidencePercent = Math.round(detection.confidence * 100);

  // --- LOGIC CLIENT-SIDE COMPOSITION ---
  const drawAndSave = async () => {
    if (!resultData.rawBase64) {
      toast.error("Thiếu dữ liệu ảnh gốc.");
      return;
    }
    setIsSaving(true);

    try {
      // 1. Load ảnh gốc Full HD từ Base64
      const img = new Image();
      img.src = `data:image/jpeg;base64,${resultData.rawBase64}`;

      await new Promise((resolve) => { img.onload = resolve; });

      // 2. Vẽ Box lên Canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(img, 0, 0);

        // Vẽ Box
        const [x1, y1, x2, y2] = detection.box;
        const w = x2 - x1, h = y2 - y1;

        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 6; // Nét to cho ảnh HD
        ctx.strokeRect(x1, y1, w, h);

        // Vẽ Label
        const label = `${detection.detectedBreed} ${confidencePercent}%`;
        ctx.font = "bold 40px sans-serif";
        const tm = ctx.measureText(label);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(x1, y1 - 60, tm.width + 40, 60);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, x1 + 20, y1 - 15);
      }

      // 3. Xuất ra Base64 đã vẽ (Processed)
      const finalBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

      // 4. Gửi lên API Save
      const res = await apiClient.saveStreamPrediction({
        processed_media_base64: finalBase64,
        detections: [{
          class: detection.detectedBreed,
          confidence: detection.confidence,
          box: detection.box,
          track_id: detection.track_id
        }],
        media_type: "image/jpeg"
      });

      toast.success("Lưu thành công!");
      if (onCleanup) onCleanup();

      // Chuyển hướng sang trang kết quả chi tiết
      router.push(`/results?id=${res.id}`);

    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi xử lý ảnh.");
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0 rounded-xl border-none shadow-2xl bg-black">
        <DialogHeader className="sr-only">
          <DialogTitle>Detection Result</DialogTitle>
          <DialogDescription>
            A new dog breed has been detected. You can save this result to view more details.
          </DialogDescription>
        </DialogHeader>

        {/* Preview Image */}
        <div className="relative w-full h-80 bg-zinc-900 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
          />

          <div className="absolute top-3 right-3 z-10">
            <Badge className={cn("text-white px-3 py-1 shadow-md", confidencePercent > 80 ? "bg-green-600" : "bg-yellow-600")}>
              {confidencePercent}% Tin cậy
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 left-3 text-white bg-black/40 hover:bg-black/60 rounded-full"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Info & Actions */}
        <div className="p-4 bg-white dark:bg-zinc-900 flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold">{detection.detectedBreed}</h2>
            <p className="text-sm text-muted-foreground">ID: {detection.track_id} • AI Confidence: {confidencePercent}%</p>
          </div>

          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
              Hủy bỏ
            </Button>

            <Button
              variant="secondary"
              className="flex-1 gap-2"
              onClick={() => {
                router.push(`/community?breed=${encodeURIComponent(detection.detectedBreed)}`);
                onClose();
              }}
              disabled={isSaving}
            >
              <Search className="w-4 h-4" />
              Search Lost
            </Button>

            <Button
              className="flex-1 gap-2 font-bold"
              onClick={drawAndSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu & Xem chi tiết
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}