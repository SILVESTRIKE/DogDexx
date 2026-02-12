import { View, Text, StyleSheet } from "react-native"
import { useI18n } from "../lib/i18n-context"

interface DescriptionCardProps {
  description: string
}

export default function DescriptionCard({ description }: DescriptionCardProps) {
  const { t } = useI18n()

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("results.description")}</Text>
      <Text style={styles.description}>{description}</Text>
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
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
  },
})
