import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { Plan } from '../lib/types';
import { useI18n } from '../lib/i18n-context';

interface PricingCardProps {
  plan: Plan;
  billingPeriod: 'monthly' | 'yearly';
  onUpgrade: (planId: string) => void;
  currentPlan?: string;
}

const CheckIcon = () => <Text style={styles.checkIcon}>✓</Text>;
const XIcon = () => <Text style={styles.xIcon}>✕</Text>;

export const PricingCard: React.FC<PricingCardProps> = ({
  plan,
  billingPeriod,
  onUpgrade,
  currentPlan,
}) => {
  const { t } = useI18n();
  const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const buttonLabel =
    currentPlan === plan.slug
      ? t('pricing.currentPlan')
      : plan.slug === 'free'
        ? t('pricing.getStarted')
        : t('pricing.upgrade');

  return (
    <Card featured={plan.isFeatured} style={styles.cardContainer}>
      {plan.isFeatured && (
        <Badge label={t('pricing.professional')} />
      )}

      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.planDescription}>{plan.description}</Text>

      <View style={styles.priceContainer}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <Text style={styles.period}>
          {billingPeriod === 'monthly' ? t('pricing.perMonth') : t('pricing.perYear')}
        </Text>
      </View>

      <Button
        title={buttonLabel}
        onPress={() => onUpgrade(plan.slug)}
        variant={plan.isFeatured ? 'default' : 'outline'}
        disabled={currentPlan === plan.slug}
        fullWidth
        style={styles.button}
      />

      <View style={styles.featuresContainer}>
        {plan.features?.map((feature, idx) => (
          <View key={idx} style={styles.featureRow}>
            {feature.included ? <CheckIcon /> : <XIcon />}
            <Text
              style={[
                styles.featureName,
                !feature.included && styles.featureNameDisabled,
              ]}
            >
              {feature.name}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 12,
    transform: [{ scale: 1 }],
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  priceContainer: {
    marginBottom: 24,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  period: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    marginBottom: 24,
  },
  featuresContainer: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    fontSize: 20,
    color: '#22c55e',
    fontWeight: 'bold',
  },
  xIcon: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
  featureName: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  featureNameDisabled: {
    color: '#999',
  },
});
