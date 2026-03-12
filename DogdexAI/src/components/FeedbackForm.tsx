import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react-native';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import { useI18n } from '../lib/i18n-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FeedbackFormProps {
  detectedBreed: string
  confidence: number
  imageUrl: string
  predictionId?: string | null,
  initialSubmitted?: boolean
}
export function FeedbackForm({
  detectedBreed,
  confidence,
  imageUrl,
  predictionId,
  initialSubmitted = false,
}: FeedbackFormProps) {
  const { t } = useI18n();
  const { user, isAuthenticated, setAuthModalOpen, setAuthModalMode } = useAuth();

  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctBreed, setCorrectBreed] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      if (predictionId) {
        await apiClient.submitPredictionFeedback(predictionId, {
          isCorrect: isCorrect ?? false,
          user_submitted_label: isCorrect ? undefined : correctBreed,
          notes: notes || undefined,
        });
      } else {
        // Fallback to AsyncStorage if no prediction ID
        const feedback = {
          id: Date.now().toString(),
          predictionId: Date.now().toString(),
          detectedBreed,
          confidence,
          isCorrect: isCorrect ?? false,
          correctBreed: isCorrect ? detectedBreed : correctBreed,
          notes,
          timestamp: new Date().toISOString(),
          userId: user?.email || 'anonymous',
          imageUrl,
        };

        const existingFeedback = await AsyncStorage.getItem('dogdex_feedback');
        const feedbackArray = existingFeedback ? JSON.parse(existingFeedback) : [];
        feedbackArray.push(feedback);
        await AsyncStorage.setItem('dogdex_feedback', JSON.stringify(feedbackArray));
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert(t('feedback.error'), t('feedback.errorDescription'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <ThumbsUp size={32} color="#3b82f6" />
          </View>
          <Text style={styles.title}>{t('feedback.loginRequiredTitle')}</Text>
          <Text style={styles.description}>{t('feedback.loginRequiredDescription')}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setAuthModalMode('login');
              setAuthModalOpen(true);
            }}
          >
            <Text style={styles.primaryButtonText}>{t('feedback.loginToFeedback')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Send size={32} color="#3b82f6" />
          </View>
          <Text style={styles.title}>{t('feedback.thankYou')}</Text>
          <Text style={styles.description}>{t('feedback.thankYouDescription')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('feedback.title')}</Text>
        <Text style={styles.cardDescription}>{t('feedback.description')}</Text>

        {/* Correct/Incorrect Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('feedback.wasCorrect')}</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                isCorrect === true && styles.toggleButtonActive,
              ]}
              onPress={() => {
                setIsCorrect(true);
                setCorrectBreed(detectedBreed);
              }}
            >
              <ThumbsUp
                size={20}
                color={isCorrect === true ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  isCorrect === true && styles.toggleButtonTextActive,
                ]}
              >
                {t('feedback.yes')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                isCorrect === false && styles.toggleButtonActive,
              ]}
              onPress={() => {
                setIsCorrect(false);
                setCorrectBreed('');
              }}
            >
              <ThumbsDown
                size={20}
                color={isCorrect === false ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  isCorrect === false && styles.toggleButtonTextActive,
                ]}
              >
                {t('feedback.no')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Correct Breed Input (shown if incorrect) */}
        {isCorrect === false && (
          <View style={styles.section}>
            <Text style={styles.label}>
              {t('feedback.correctBreed')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('feedback.selectBreed')}
              placeholderTextColor="#999"
              value={correctBreed}
              onChangeText={setCorrectBreed}
            />
          </View>
        )}

        {/* Optional Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('feedback.additionalComments')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('feedback.commentsPlaceholder')}
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isCorrect === null ||
              (isCorrect === false && !correctBreed.trim()) ||
              isSubmitting) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={
            isCorrect === null ||
            (isCorrect === false && !correctBreed.trim()) ||
            isSubmitting
          }
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={20} color="#fff" />
              <Text style={styles.submitButtonText}>
                {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  required: {
    color: '#ef4444',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  textarea: {
    minHeight: 100,
    paddingVertical: 12,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
