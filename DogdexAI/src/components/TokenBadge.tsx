import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Coins } from "lucide-react-native";

interface TokenBadgeProps {
  remaining: number;
  total: number;
}

export function TokenBadge({ remaining, total }: TokenBadgeProps) {
  return (
    <View style={styles.container}>
      <Coins size={16} color="#f59e0b" /> 
      <Text style={styles.text}>
        {remaining}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f2f2f2",  // tương đương bg-muted
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    fontFamily: "monospace", // tương đương font-mono
  },
});
