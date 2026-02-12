import { View, Text, StyleSheet } from 'react-native';

const colors = {
  primary: '#1a1a1a',
  primaryForeground: '#fafafa',
  background: '#ffffff',
  foreground: '#242424',
  card: '#ffffff',
  cardForeground: '#242424',
  secondary: '#f5f5f5',
  secondaryForeground: '#1a1a1a',
  mutedForeground: '#8e8e8e',
  border: '#e5e5e5',
  accent: '#f5f5f5',
  accentForeground: '#1a1a1a',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const typography = {
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
};

interface FeatureProps {
  feature: {
    icon: string;
    title: string;
    description: string;
  };
}

export default function FeatureCard({ feature }: FeatureProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{feature.icon}</Text>
      <Text style={styles.title}>{feature.title}</Text>
      <Text style={styles.description}>{feature.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodySmall,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
});
