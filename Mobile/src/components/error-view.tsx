import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { AlertCircle } from "lucide-react-native"
import { useI18n } from "../lib/i18n-context"
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useNavigation } from "@react-navigation/native";
import { ScanStackParamList } from "../navigation/ScanStack";

interface ErrorViewProps {
  error: string
}
type AboutScreenRouteProp = NativeStackNavigationProp<ScanStackParamList>;
export default function ErrorView({ error }: ErrorViewProps) {
  const { t } = useI18n()
  const navigation = useNavigation<AboutScreenRouteProp>();
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <AlertCircle size={40} color="#ef4444" />
        </View>
        <Text style={styles.title}>{t("common.error")}</Text>
        <Text style={styles.message}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>{t("common.back")}</Text>
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
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
})
