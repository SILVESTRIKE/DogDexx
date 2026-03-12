import { View, Text, StyleSheet } from "react-native"
import { Activity, Brain, Wind } from "lucide-react-native"
import { useI18n } from "../lib/i18n-context"
import type { BreedInfo } from "../lib/types"
import ProgressBar from "./progress-bar"

interface CharacteristicsCardProps {
  breedInfo: BreedInfo
}

export default function CharacteristicsCard({ breedInfo }: CharacteristicsCardProps) {
  const { t } = useI18n()

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Activity size={20} color="#2563eb" />
        <Text style={styles.title}>{t("results.characteristics")}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.characteristic}>
          <View style={styles.characteristicHeader}>
            <View style={styles.characteristicLabel}>
              <Activity size={16} color="#2563eb" />
              <Text style={styles.label}>{t("results.energy")}</Text>
            </View>
            <Text style={styles.value}>{breedInfo.energy_level ?? "?"}/5</Text>
          </View>
          <ProgressBar value={(breedInfo.energy_level ?? 0) * 20} />
        </View>

        <View style={styles.characteristic}>
          <View style={styles.characteristicHeader}>
            <View style={styles.characteristicLabel}>
              <Brain size={16} color="#8b5cf6" />
              <Text style={styles.label}>{t("results.trainability")}</Text>
            </View>
            <Text style={styles.value}>{breedInfo.trainability ?? "?"}/5</Text>
          </View>
          <ProgressBar value={(breedInfo.trainability ?? 0) * 20} />
        </View>

        <View style={styles.characteristic}>
          <View style={styles.characteristicHeader}>
            <View style={styles.characteristicLabel}>
              <Wind size={16} color="#06b6d4" />
              <Text style={styles.label}>{t("results.shedding")}</Text>
            </View>
            <Text style={styles.value}>{breedInfo.shedding_level ?? "?"}/5</Text>
          </View>
          <ProgressBar value={(breedInfo.shedding_level ?? 0) * 20} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  content: {
    gap: 12,
  },
  characteristic: {
    gap: 6,
  },
  characteristicHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  characteristicLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  value: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2937",
  },
})
