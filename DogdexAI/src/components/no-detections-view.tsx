import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { AlertTriangle, ArrowLeft } from "lucide-react-native"
import { useI18n } from "../lib/i18n-context"

export default function NoDetectionsView() {
  const { t } = useI18n()

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <AlertTriangle size={40} color="#ef4444" />
        </View>
        <Text style={styles.title}>{t("results.noDetectionsTitle")}</Text>
        <Text style={styles.message}>{t("results.noDetectionsDescription")}</Text>
        <TouchableOpacity style={styles.button}>
          <ArrowLeft size={20} color="#fff" />
          <Text style={styles.buttonText}>{t("results.tryAgain")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
})
