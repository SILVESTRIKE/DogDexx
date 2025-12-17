"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { ChevronDown } from "lucide-react-native"
import { useI18n } from "../lib/i18n-context"
import type { Detection } from "../lib/types"

interface BreedSelectorProps {
  detections: Detection[]
  selectedDetection: Detection
  onSelectionChange: (index: number) => void
}

export default function BreedSelector({ detections, selectedDetection, onSelectionChange }: BreedSelectorProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("results.selectBreedPlaceholder")}</Text>

      <TouchableOpacity style={styles.trigger} onPress={() => setIsOpen(!isOpen)}>
        <Text style={styles.triggerText}>
          {selectedDetection.breedInfo?.breed || selectedDetection.detectedBreed.replace(/-/g, " ")} (
          {Math.round(selectedDetection.confidence * 100)}%)
        </Text>
        <ChevronDown size={20} color="#6b7280" style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.content}>
          {detections.map((det, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.option, selectedDetection === det && styles.optionSelected]}
              onPress={() => {
                onSelectionChange(index)
                setIsOpen(false)
              }}
            >
              <Text style={[styles.optionText, selectedDetection === det && styles.optionTextSelected]}>
                {det.breedInfo?.breed || det.detectedBreed.replace(/-/g, " ")} ({Math.round(det.confidence * 100)}%)
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 8,
  },
  trigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
  },
  content: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  optionSelected: {
    backgroundColor: "#eff6ff",
  },
  optionText: {
    fontSize: 14,
    color: "#6b7280",
  },
  optionTextSelected: {
    color: "#2563eb",
    fontWeight: "600",
  },
})
