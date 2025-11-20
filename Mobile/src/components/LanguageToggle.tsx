import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useI18n, I18nContextType } from "../lib/i18n-context";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n() as I18nContextType;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          locale === "vi" ? styles.active : styles.inactive
        ]}
        onPress={() => setLocale("vi")}
      >
        <Text style={styles.text}>{t("nav.vietnamese")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          locale === "en" ? styles.active : styles.inactive
        ]}
        onPress={() => setLocale("en")}
      >
        <Text style={styles.text}>{t("nav.english")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  active: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
  },
  inactive: {
    backgroundColor: "#fff",
  },
  text: {
    color: "#000",
  },
});
