import { View, StyleSheet } from "react-native"

interface ProgressBarProps {
  value: number
  color?: string
}

export default function ProgressBar({ value, color = "#2563eb" }: ProgressBarProps) {
  return (
    <View style={styles.background}>
      <View style={[styles.fill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
})
