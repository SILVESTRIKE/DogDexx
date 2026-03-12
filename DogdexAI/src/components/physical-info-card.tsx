import { View, Text, StyleSheet } from "react-native"
import { Ruler, Calendar } from "lucide-react-native"
import { useI18n } from "../lib/i18n-context"
import type { BreedInfo } from "../lib/types"

interface PhysicalInfoCardProps {
  breedInfo: BreedInfo
}

export default function PhysicalInfoCard({ breedInfo }: PhysicalInfoCardProps) {
  const { t } = useI18n()

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ruler size={20} color="#2563eb" />
        <Text style={styles.title}>{t("results.physicalInfo")}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("results.height")}</Text>
          <Text style={styles.value}>{breedInfo.height}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t("results.weight")}</Text>
          <Text style={styles.value}>{breedInfo.weight}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.lifeSpanLabel}>
            <Calendar size={14} color="#6b7280" />
            <Text style={styles.label}>{t("results.lifespan")}</Text>
          </View>
          <Text style={styles.value}>{breedInfo.life_expectancy}</Text>
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
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lifeSpanLabel: {
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
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
})
