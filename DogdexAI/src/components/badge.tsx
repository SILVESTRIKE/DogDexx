import { View, Text, StyleSheet } from "react-native"

interface BadgeProps {
  text: string
  variant?: "default" | "secondary"
}

export default function Badge({ text, variant = "secondary" }: BadgeProps) {
  return (
    <View style={[styles.badge, variant === "secondary" ? styles.secondary : styles.default]}>
      <Text style={[styles.text, variant === "secondary" ? styles.secondaryText : styles.defaultText]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  default: {
    backgroundColor: "#2563eb",
  },
  secondary: {
    backgroundColor: "#f3f4f6",
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
  },
  defaultText: {
    color: "#fff",
  },
  secondaryText: {
    color: "#6b7280",
  },
})
