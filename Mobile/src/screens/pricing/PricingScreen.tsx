import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from 'react-native';
import { useI18n } from '../../lib/i18n-context';
import { Plan } from '../../lib/types';
import { apiClient } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth-context';
import { PricingCard } from '../../components/PricingCard';
import { Card } from '../../components/ui/Card';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useNavigation } from '@react-navigation/native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
export default function PricingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useI18n();
  const { user, setAuthModalOpen, setAuthModalMode } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
    'monthly',
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchPlans = async () => {
    try {
      const response = await apiClient.getPublicPlans();
      const plansWithFeatures = response.data.map((plan: Plan) => {
        return {
          ...plan,
          name: t(`pricing.${plan.slug}`) || plan.name,
          description:
            t(`pricing.${plan.slug}Description`) ||
            `Description for ${plan.name}`,
          isFeatured: plan.slug === 'professional',
          features: [
            {
              name: t('pricing.featureTokenLimit', {
                count: plan.tokenAllotment,
              }),
              included: true,
            },
            {
              name: t('pricing.featureStorage'),
              included: plan.slug !== 'free',
            },
            {
              name: t('pricing.apiAccess'),
              included: plan.apiAccess,
            },
            {
              name: t('pricing.priority'),
              included: ['professional', 'enterprise'].includes(plan.slug),
            },
            {
              name: t('pricing.customModels'),
              included: ['enterprise'].includes(plan.slug),
            },
          ],
        };
      });
      setPlans(plansWithFeatures);
    } catch (error) {
      console.error('Failed to fetch pricing plans:', error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchPlans();
  }, [t]);
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPlans(); // tải lại plans
    setRefreshing(false);
  };
  const handleUpgrade = (planId: string) => {
    if (!user || !user.email) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    // Proceed to checkout

    console.log(`Upgrading to plan: ${planId} (${billingPeriod})`);
    navigation.navigate('Checkout', { plan: planId, period: billingPeriod });
    // TODO: Navigate to checkout screen
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('pricing.title')}</Text>
        <Text style={styles.description}>{t('pricing.description')}</Text>

        {/* Billing Toggle */}
        <View style={styles.billingToggle}>
          <Button
            title={t('pricing.monthly')}
            onPress={() => setBillingPeriod('monthly')}
            variant={billingPeriod === 'monthly' ? 'default' : 'outline'}
            style={styles.toggleButton}
          />
          <View style={styles.toggleButtonGap} />
          <TouchableOpacity
            style={[
              styles.toggleButton,
              billingPeriod === 'yearly' && styles.activeToggle,
            ]}
            onPress={() => setBillingPeriod('yearly')}
          >
            <Text
              style={[
                styles.toggleText,
                billingPeriod === 'yearly' && styles.activeToggleText,
              ]}
            >
              {t('pricing.yearly')}
            </Text>
            <Text style={styles.saveBadge}>{t('pricing.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pricing Cards */}
      <View style={styles.cardsContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#000" style={styles.loader} />
        ) : (
          plans.map(plan => (
            <PricingCard
              key={plan.slug}
              plan={plan}
              billingPeriod={billingPeriod}
              onUpgrade={handleUpgrade}
              currentPlan={user?.plan}
            />
          ))
        )}
      </View>

      {/* FAQ Section */}
      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>{t('pricing.faq')}</Text>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQuestion}>{t('pricing.faqQ1')}</Text>
          <Text style={styles.faqAnswer}>{t('pricing.faqA1')}</Text>
        </Card>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQuestion}>{t('pricing.faqQ2')}</Text>
          <Text style={styles.faqAnswer}>{t('pricing.faqA2')}</Text>
        </Card>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQuestion}>{t('pricing.faqQ3')}</Text>
          <Text style={styles.faqAnswer}>{t('pricing.faqA3')}</Text>
        </Card>

        <Card style={styles.faqCard}>
          <Text style={styles.faqQuestion}>{t('faqQ4')}</Text>
          <Text style={styles.faqAnswer}>{t('faqA4')}</Text>
        </Card>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>{t('ready')}</Text>
        <Text style={styles.ctaDescription}>{t('readyDescription')}</Text>
        <Button
          title={t('startFree')}
          onPress={() => console.log('Start Free')}
          fullWidth
          style={styles.ctaButton}
        />
      </View>

      {/* Ad Sections */}
      <View style={styles.adSections}>
        <Card style={{ ...styles.adCard, ...styles.adCard1 }}>
          <Text style={styles.adCardTitle}>{t('footer.adSection1Title')}</Text>
          <Text style={styles.adCardDescription}>
            {t('footer.adSection1Description')}
          </Text>
          <TouchableOpacity>
            <Text style={styles.adCardLink}>{t('footer.learnMore')} →</Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ ...styles.adCard1, ...styles.adCard2 }}>
          <Text style={styles.adCardTitle}>{t('footer.adSection2Title')}</Text>
          <Text style={styles.adCardDescription}>
            {t('footer.adSection2Description')}
          </Text>
          <TouchableOpacity>
            <Text style={[styles.adCardLink, styles.adCardLink2]}>
              {t('footer.learnMore')} →
            </Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ ...styles.adCard2, ...styles.adCard3 }}>
          <Text style={styles.adCardTitle}>{t('footer.adSection3Title')}</Text>
          <Text style={styles.adCardDescription}>
            {t('footer.adSection3Description')}
          </Text>
          <TouchableOpacity>
            <Text style={[styles.adCardLink, styles.adCardLink3]}>
              {t('footer.learnMore')} →
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: '90%',
  },
  billingToggle: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  toggleButton: {
    flex: 1,
    maxWidth: 140,
  },
  toggleButtonGap: {
    width: 12,
  },
  activeToggle: {
    backgroundColor: '#000',
  },
  toggleText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#fff',
  },
  saveBadge: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  cardsContainer: {
    marginVertical: 24,
  },
  loader: {
    marginVertical: 60,
  },
  faqSection: {
    paddingHorizontal: 20,
    marginVertical: 24,
  },
  faqTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  faqCard: {
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  ctaButton: {
    width: '100%',
    maxWidth: 300,
  },
  adSections: {
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  adCard: {
    alignItems: 'center',
    padding: 20,
  },
  adCard1: {
    backgroundColor: '#f5f5f0',
  },
  adCard2: {
    backgroundColor: '#f0f5ff',
  },
  adCard3: {
    backgroundColor: '#f0f5f0',
  },
  adCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  adCardDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  adCardLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  adCardLink2: {
    color: '#2563eb',
  },
  adCardLink3: {
    color: '#16a34a',
  },
});
