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

export default function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        © 2025 DogDogDex. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.mutedForeground,
  },
});
