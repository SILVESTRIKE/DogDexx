"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PredictionHistoryItem } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";
import { Calendar, Download, Trash2, Eye, Video, Camera, Webcam, Link as LinkIcon } from "lucide-react";

interface HistoryCardProps {
  prediction: PredictionHistoryItem;
  onDelete: (id: string) => void;
  onDownload: (prediction: PredictionHistoryItem) => void;
}

export function HistoryCard({ prediction, onDelete, onDownload }: HistoryCardProps) {
  const { t } = useI18n();

  const getSourceInfo = (source: PredictionHistoryItem['source']) => {
    switch (source) {
      case 'image_upload':
        return { icon: <Camera className="h-3 w-3" />, text: t('history.sourceImage') };
      case 'video_upload':
        return { icon: <Video className="h-3 w-3" />, text: t('history.sourceVideo') };
      case 'stream_capture':
        return { icon: <Webcam className="h-3 w-3" />, text: t('history.sourceStream') };
      case 'url_input':
        return { icon: <LinkIcon className="h-3 w-3" />, text: t('history.sourceUrl') };
      default:
        return { icon: null, text: source };
    }
  };

  const sourceInfo = getSourceInfo(prediction.source);
  const primaryDetection = prediction.detections[0];
  const maxConfidence = Math.max(...prediction.detections.map(p => p.confidence), 0);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col group">
      <Link href={`/results?id=${prediction.id}`} className="block">
        <div className="relative overflow-hidden bg-gradient-to-br from-muted to-muted/50 aspect-square flex items-center justify-center bg-black">
          {/* FIX: Kiểm tra media.type thay vì source để hiển thị đúng ảnh cho Link (url_input) */}
          {prediction.media.type === 'image' ? (
            <img
              src={prediction.processedMediaUrl || "/placeholder.svg"}
              alt={primaryDetection?.detectedBreed || 'Detection'}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
              <div className="text-center">
                <Video className="h-10 w-10 text-primary mx-auto mb-2" />
                <p className="text-sm text-foreground/70">{t("history.videoFile")}</p>
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 flex flex-col flex-grow">
        <div className="mb-2 flex-grow">
          <h3 className="font-semibold text-base mb-1 truncate" title={prediction.detections.map(d => d.breedName).join(', ')}>
            {prediction.detections.map(d => d.breedName).join(', ') || 'Unknown'}
          </h3>
          <div className="flex items-center justify-between text-xs text-foreground/70">
            <span>
              {t("history.confidence")}: {(maxConfidence * 100).toFixed(1)}%
            </span>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded">
              {sourceInfo.icon}
              <span>{sourceInfo.text}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-foreground/60 mb-3">
          <Calendar className="h-3 w-3" />
          {new Date(prediction.createdAt).toLocaleString()}
        </div>

        <div className="flex gap-1.5 mt-auto">
          <Link href={`/results?id=${prediction.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full bg-transparent">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => onDownload(prediction)} title={t("history.download")}>
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(prediction.id)}
            title={t("history.delete")}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}