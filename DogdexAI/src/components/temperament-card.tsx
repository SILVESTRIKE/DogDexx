import { View, Text, StyleSheet } from "react-native"
import { Heart } from "lucide-react-native"
import { useI18n } from "../lib/i18n-context"
import type { BreedInfo } from "../lib/types"
import Badge from "./badge"

interface TemperamentCardProps {
  breedInfo: BreedInfo
}

export default function TemperamentCard({ breedInfo }: TemperamentCardProps) {
  const { t } = useI18n()

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Heart size={20} color="#2563eb" />
        <Text style={styles.title}>{t("results.temperament")}</Text>
      </View>

      <View style={styles.content}>
        {breedInfo.temperament?.slice(0, 6).map((trait) => (
          <Badge key={trait} text={trait} />
        ))}
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
})
