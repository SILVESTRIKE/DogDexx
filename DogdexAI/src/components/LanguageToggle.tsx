import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useI18n, I18nContextType } from "../lib/i18n-context";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n() as I18nContextType;

  return (
    <View style={styles.container}>
      <View style={styles.toggleWrapper}>
        <TouchableOpacity
          style={[
            styles.button,
            locale === "vi" && styles.active
          ]}
          onPress={() => setLocale("vi")}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.text,
            locale === "vi" && styles.activeText
          ]}>
            {t("nav.vietnamese")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            locale === "en" && styles.active
          ]}
          onPress={() => setLocale("en")}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.text,
            locale === "en" && styles.activeText
          ]}>
            {t("nav.english")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  toggleWrapper: {
    flexDirection: "row",
    backgroundColor: "#F5F5F7",
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "transparent",

  },
  active: {
    backgroundColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.2,
  },
  activeText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});