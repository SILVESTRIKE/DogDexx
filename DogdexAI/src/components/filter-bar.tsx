"use client"

import React from "react"
import { View, TouchableOpacity, Text, StyleSheet, Modal, FlatList } from "react-native"
import { useI18n } from "../lib/i18n-context"

type FilterType = "all" | "image" | "video"
type SortType = "newest" | "oldest" | "confidence"

interface FilterBarProps {
  filterType: FilterType
  sortBy: SortType
  onFilterTypeChange: (type: FilterType) => void
  onSortByChange: (sort: SortType) => void
}

export default function FilterBar({
  filterType,
  sortBy,
  onFilterTypeChange,
  onSortByChange,
}: FilterBarProps): React.JSX.Element {
  const { t } = useI18n()
  const [showFilterModal, setShowFilterModal] = React.useState(false)
  const [showSortModal, setShowSortModal] = React.useState(false)

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: t("history.typeAll"), value: "all" },
    { label: t("history.typeImage"), value: "image" },
    { label: t("history.typeVideo"), value: "video" },
  ]

  const sortOptions: { label: string; value: SortType }[] = [
    { label: t("history.sortNewest"), value: "newest" },
    { label: t("history.sortOldest"), value: "oldest" },
    { label: t("history.sortConfidence"), value: "confidence" },
  ]

  return (
    <>
      {/* Filter Button */}
      <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
        <Text style={styles.filterButtonText}>
          {filterOptions.find((o) => o.value === filterType)?.label || "Filter"}
        </Text>
      </TouchableOpacity>

      {/* Sort Button */}
      <TouchableOpacity style={styles.filterButton} onPress={() => setShowSortModal(true)}>
        <Text style={styles.filterButtonText}>{sortOptions.find((o) => o.value === sortBy)?.label || "Sort"}</Text>
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("history.filterType")}</Text>
            <FlatList
              data={filterOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, filterType === item.value && styles.selectedOption]}
                  onPress={() => {
                    onFilterTypeChange(item.value)
                    setShowFilterModal(false)
                  }}
                >
                  <Text style={[styles.modalOptionText, filterType === item.value && styles.selectedOptionText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("history.sortBy")}</Text>
            <FlatList
              data={sortOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, sortBy === item.value && styles.selectedOption]}
                  onPress={() => {
                    onSortByChange(item.value)
                    setShowSortModal(false)
                  }}
                >
                  <Text style={[styles.modalOptionText, sortBy === item.value && styles.selectedOptionText]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  filterButton: {
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  filterButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  selectedOption: {
    backgroundColor: "#f0f5ff",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedOptionText: {
    color: "#0066ff",
    fontWeight: "600",
  },
})
