import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Recaptcha, { RecaptchaRef } from 'react-native-recaptcha-that-works';

import Icon from 'react-native-vector-icons/Feather';
import { useI18n } from '../lib/i18n-context';
import { useAuth } from '../lib/auth-context';
import { apiClient } from '../lib/api-client';

const RECAPTCHA_SITE_KEY = '6Ldwbw4sAAAAAJdJxxTHVThczZPKj5egdZo_O_zx';
const RECAPTCHA_BASE_URL = 'https://www.google.com';

export function ContactForm() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recaptchaRef = useRef<RecaptchaRef>(null);

  const handleSubmit = () => {
    if (!email.trim() || !message.trim()) {
      Alert.alert(t('contact.errorTitle'), 'Please fill in all fields');
      return;
    }
    recaptchaRef.current?.open();
  };

  const onVerify = async (captchaToken: string) => {
    setIsSubmitting(true);
    try {
      await apiClient.submitContactForm({
        email,
        message,
        captchaToken,
      });
      setSubmitted(true);
      Alert.alert(t('contact.successTitle'), t('contact.successDescription'));
    } catch (error: any) {
      Alert.alert(
        t('contact.errorTitle'),
        error.message || t('contact.errorDescription')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = () => {
    Alert.alert(t('contact.errorTitle'), 'Could not verify CAPTCHA. Please try again.');
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <View style={styles.card}>
        <View style={styles.successContainer}>
          <View style={styles.iconCircle}>
            <Icon name="send" size={32} color="#6366f1" />
          </View>
          <Text style={styles.thankYouTitle}>{t('contact.thankYou')}</Text>
          <Text style={styles.thankYouDescription}>
            {t('contact.thankYouDescription')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('contact.title')}</Text>
        <Text style={styles.description}>{t('contact.description')}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('contact.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('contact.emailPlaceholder')}
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('contact.messageLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('contact.messagePlaceholder')}
            placeholderTextColor="#9ca3af"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (!email.trim() || !message.trim() || isSubmitting) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!email.trim() || !message.trim() || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon name="send" size={20} color="#fff" style={styles.buttonIcon} />
          )}
          <Text style={styles.buttonText}>
            {isSubmitting ? t('contact.submitting') : t('contact.submit')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.recaptchaNotice}>
          This site is protected by reCAPTCHA and the Google Privacy Policy and
          Terms of Service apply.
        </Text>
      </View>

      <Recaptcha
        ref={recaptchaRef}
        siteKey={RECAPTCHA_SITE_KEY}
        baseUrl={RECAPTCHA_BASE_URL}
        size="invisible"
        onVerify={onVerify}
        onError={onError}
        onExpire={() => console.log('Captcha expired')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    margin: 16,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textarea: {
    height: 120,
    paddingTop: 12,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recaptchaNotice: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  successContainer: {
    alignItems: 'center',
    padding: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  thankYouTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  thankYouDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default ContactForm;