import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n-context';
import { Plan } from '../../lib/types';
import { apiClient } from '../../lib/api-client';
import { ArrowLeft } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface CheckoutParams {
  plan: string;
  period: 'monthly' | 'yearly';
}
type CheckoutScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Checkout'
>;

export default function CheckoutScreen({ route }: { route: any }) {
  const navigation = useNavigation<CheckoutScreenNavigationProp>();
  const { user } = useAuth();
  const { t } = useI18n();

  const { plan: planId, period: billingPeriod = 'monthly' } = (route?.params ||
    {}) as Partial<CheckoutParams>;

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (!user) {
      Alert.alert(t('checkout.failed'), 'User not authenticated');
      return;
    }

    if (!planId) {
      Alert.alert(t('checkout.failed'), 'Plan ID is missing');
      return;
    }

    const fetchPlanDetails = async () => {
      try {
        const response = await apiClient.getPublicPlanBySlug(planId);
        setSelectedPlan(response.data);
      } catch (err: any) {
        const errorMsg = err.message || 'Could not load plan details';
        Alert.alert(t('checkout.failed'), errorMsg);
        setError(errorMsg);
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchPlanDetails();
  }, [user, planId, t]);

  const handleCheckout = async () => {
    if (!planId) return;

    setIsCheckingOut(true);
    setError('');

    try {
      const { payUrl } = await apiClient.createCheckoutSession(
        planId,
        billingPeriod as 'monthly' | 'yearly',
      );
      navigation.navigate('momo', { payUrl: payUrl });
      //Alert.alert('Payment', `Redirecting to: ${payUrl}`);
    } catch (err: any) {
      const errorMsg = err.message || 'Checkout failed';
      Alert.alert(t('checkout.failed'), errorMsg);
      setError(errorMsg);
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (isPageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!user || !planId || !selectedPlan) {
    return null;
  }

  const price =
    billingPeriod === 'monthly'
      ? selectedPlan.priceMonthly
      : selectedPlan.priceYearly;
  const formattedPrice = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft size={20} color="#000" />
        <Text style={styles.backText}>{t('common.back') || 'Back'}</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}


        <Text style={styles.title}>{t('checkout.title') || 'Checkout'}</Text>

        {/* Order Summary */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('checkout.orderSummary') || 'Order Summary'}
          </Text>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>
              {t(`pricing.${selectedPlan.slug}`) || selectedPlan.name}
            </Text>
            <Text style={styles.summaryValue}>{formattedPrice}</Text>
          </View>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>
              {billingPeriod === 'monthly'
                ? t('pricing.monthly')
                : t('pricing.yearly')}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {t('checkout.total') || 'Total'}
            </Text>
            <Text style={styles.totalValue}>{formattedPrice}</Text>
          </View>
        </Card>

        {/* Billing Information */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('checkout.billingInfo') || 'Billing Information'}
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('checkout.email') || 'Email'}</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user.email}
              editable={false}
              placeholder="Email"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {t('checkout.cardInfo') || 'Card Information'}
            </Text>
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {t('checkout.cardPlaceholder') ||
                  'Bạn sẽ được chuyển hướng đến cổng thanh toán MoMo để hoàn tất giao dịch.'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Error Message */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title={t('common.cancel') || 'Cancel'}
            variant="outline"
            onPress={() => {
              Alert.alert('Back', 'Navigate back to pricing');
            }}
            style={styles.cancelButton}
          />
          <Button
            title={
              isCheckingOut
                ? 'Processing...'
                : `${t('checkout.pay') || 'Pay'} ${formattedPrice}`
            }
            onPress={handleCheckout}
            disabled={isCheckingOut}
            style={styles.payButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 32,
  },
  card: {
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#333',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  placeholder: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: '#fee',
    borderWidth: 1,
    borderColor: '#fcc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  payButton: {
    flex: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
