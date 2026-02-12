import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { useI18n } from '../../lib/i18n-context';
import FeatureCard from '../../components/FeatureCard';
import Footer from '../../components/Footer';
import ContactForm from '../../components/ContactForm';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

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
const FeatureIcons = {
  lightning: '⚡',
  shield: '🛡️',
  users: '👥',
  globe: '🌍',
};
type AboutScreenRouteProp = NativeStackNavigationProp<RootStackParamList,'AboutScreen'>;
export default function AboutScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<AboutScreenRouteProp>();
  const features = [
    {
      icon: FeatureIcons.lightning,
      title: t('about.fastTitle') || 'Lightning Fast',
      description:
        t('about.fastDesc') ||
        'Real-time dog breed detection powered by advanced AI',
    },
    {
      icon: FeatureIcons.shield,
      title: t('about.secureTitle') || 'Secure & Private',
      description:
        t('about.secureDesc') ||
        'Your data is encrypted and never shared with third parties',
    },
    {
      icon: FeatureIcons.users,
      title: t('about.communityTitle') || 'Community Driven',
      description:
        t('about.communityDesc') ||
        'Join thousands of dog lovers improving AI together',
    },
    {
      icon: FeatureIcons.globe,
      title: t('about.globalTitle') || 'Global Scale',
      description:
        t('about.globalDesc') ||
        'Supports 200+ dog breeds from around the world',
    },
  ];

  const handleGetStarted = () => {
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Text style={styles.title}>
          {t('about.title') || 'About DogDogDex'}
        </Text>
        <Text style={styles.subtitle}>
          {t('about.subtitle') ||
            'Revolutionizing dog breed identification with artificial intelligence'}
        </Text>
      </View>

      {/* Mission Section */}
      <View style={styles.missionCard}>
        <Text style={styles.sectionTitle}>
          {t('about.mission') || 'Our Mission'}
        </Text>
        <Text style={styles.missionText}>
          {t('about.missionText') ||
            'We believe that technology should make the world more connected. DogDogDex uses cutting-edge AI to help dog lovers, veterinarians, and researchers identify dog breeds instantly. Our mission is to make dog breed identification accessible to everyone, everywhere.'}
        </Text>
      </View>

      {/* Features Grid */}
      <View style={styles.featuresContainer}>
        {features.map((feature, idx) => (
          <FeatureCard key={idx} feature={feature} />
        ))}
      </View>

      {/* Team Section */}
      <View style={styles.teamSection}>
        <Text style={styles.sectionTitle}>{t('about.team') || 'Our Team'}</Text>
        <Text style={styles.teamText}>
          {t('about.teamText') ||
            'Built by a passionate team of AI researchers, dog lovers, and software engineers dedicated to creating the best dog breed identification experience.'}
        </Text>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>
          {t('about.ready') || 'Ready to get started?'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>
            {t('common.getStarted') || 'Get Started'}
          </Text>
        </TouchableOpacity>
      </View>

      <Footer />
       <ContactForm />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 300,
  },
  missionCard: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.secondary,
    borderRadius: 12,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  missionText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 24,
  },
  featuresContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  teamSection: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  teamText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  ctaSection: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  ctaTitle: {
    ...typography.heading,
    color: colors.foreground,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
});
