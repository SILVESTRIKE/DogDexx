import type React from "react"
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from "react-native"
import type { PredictionHistoryItem } from "../lib/types"
import { useI18n } from "../lib/i18n-context"
import { Calendar, Download, Trash2, Eye } from "lucide-react-native"

interface PredictionCardProps {
  prediction: PredictionHistoryItem
  onDelete: (id: string) => void
  onDownload: (prediction: PredictionHistoryItem) => void
  onView:(id: string) => void
}

export default function PredictionCard({ prediction, onDelete, onDownload , onView}: PredictionCardProps): React.JSX.Element {
  const { t } = useI18n()

  const getSourceText = (source: PredictionHistoryItem["source"]) => {
    switch (source) {
      case "image_upload":
        return t("history.sourceImage")
      case "video_upload":
        return t("history.sourceVideo")
      case "stream_capture":
        return t("history.sourceStream")
      default:
        return source
    }
  }

  const maxConfidence = Math.max(...prediction.detections.map((p) => p.confidence), 0)
  const breedNames = prediction.detections.map((d) => d.breedName).join(", ") || "Unknown"

  const handleDelete = () => {
    Alert.alert(t("history.confirmDelete"), "Are you sure you want to delete this prediction?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(prediction.id),
      },
    ])
  }

  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {prediction.source === "image_upload" || prediction.source === "stream_capture" ? (
          <Image source={{ uri: prediction.processedMediaUrl || undefined }} style={styles.thumbnail} />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoText}>{t("history.videoFile")}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.breedName} numberOfLines={2}>
          {breedNames}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.confidence}>
            {t("history.confidence")}: {(maxConfidence * 100).toFixed(1)}%
          </Text>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{getSourceText(prediction.source)}</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Calendar size={12} color="#666" />
          <Text style={styles.dateText}>{new Date(prediction.createdAt).toLocaleString()}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => {
               onView(prediction.id)
              
            }}
          >
            <Eye size={16} color="#0066ff" />
            <Text style={styles.viewButtonText}>{t("history.view")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => onDownload(prediction)}>
            <Download size={16} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
            <Trash2 size={16} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#f5f5f5",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  videoText: {
    fontSize: 14,
    color: "#999",
  },
  content: {
    padding: 12,
  },
  breedName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  confidence: {
    fontSize: 12,
    color: "#666",
  },
  sourceBadge: {
    backgroundColor: "#f0f5ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 11,
    color: "#0066ff",
    fontWeight: "500",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 11,
    color: "#999",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  viewButton: {
    flex: 1.5,
    backgroundColor: "#f8f8f8",
    borderColor: "#e0e0e0",
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0066ff",
  },
  deleteButton: {
    borderColor: "#ffebee",
  },
})
