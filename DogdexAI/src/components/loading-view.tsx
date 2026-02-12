import { View, ActivityIndicator, Text, StyleSheet } from "react-native"
import { useI18n } from "../lib/i18n-context"

export default function LoadingView() {
  const { t } = useI18n()

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>{t("common.loading")}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    gap: 12,
  },
  text: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
  },
})
