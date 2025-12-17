'use client';

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/ScanStack';
import {
  useNavigation,
  useRoute,
  NavigationProp,
} from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useI18n } from '../../lib/i18n-context';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api-client';
import type { Detection, BffPredictionResponse } from '../../lib/types';
import BreedCard from '../../components/breed-card';
import CharacteristicsCard from '../../components/characteristics-card';
import PhysicalInfoCard from '../../components/physical-info-card';
import TemperamentCard from '../../components/temperament-card';
import DescriptionCard from '../../components/description-card';
import BreedSelector from '../../components/breed-selector';
import ErrorView from '../../components/error-view';
import LoadingView from '../../components/loading-view';
import NoDetectionsView from '../../components/no-detections-view';
import { BreedChatBox } from '../../components/BreedChatBox';
import { HealthRecommendations } from '../../components/HealthRecommendations';
import { RecommendedProducts } from '../../components/RecommendedProducts';
import { FeedbackForm } from '../../components/FeedbackForm';
type Props = NativeStackScreenProps<ScanStackParamList, 'ResulteScreen'>;
interface RouteParams {
  id: string;
}
export default function ResultsScreen({ navigation }: Props) {
  const route = useRoute();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  // const navigation: any = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDetections, setAllDetections] = useState<Detection[]>([]);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(
    null,
  );
  const [processedMediaUrl, setProcessedMediaUrl] = useState<string | null>(
    null,
  );
  const [noDetectionsFound, setNoDetectionsFound] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  useEffect(() => {
    const historyId = (route.params as RouteParams)?.id;

    if (!historyId) {
      setError('No prediction ID provided. Please go back and try again.');
      setLoading(false);
      return;
    }

    const processResultData = (result: BffPredictionResponse) => {
      setHasFeedback(result.hasFeedback ?? false);
      setProcessedMediaUrl(result.processedMediaUrl);
      setPredictionId(result.predictionId);

      if (!result.detections || result.detections.length === 0) {
        setNoDetectionsFound(true);
        return;
      }

      const primary = result.detections.reduce((prev, current) =>
        prev.confidence > current.confidence ? prev : current,
      );

      setAllDetections(result.detections);
      setSelectedDetection(primary);
    };

    const pollForStatus = async (id: string) => {
      let attempts = 0;
      const maxAttempts = 300; // 5 phút
      setIsPolling(true);
      setError(null);

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setError('Timeout waiting for prediction result.');
          setLoading(false);
          return;
        }

        try {
          const status = await apiClient.getPredictionStatus(id);
          console.log('Polled status:', status);

          if (status.status === 'completed') {
            setIsPolling(false);
            fetchHistoryById();
            return;
          }

          if (status.status === 'failed') {
            setError(status.message || 'Prediction failed.');
            setIsPolling(false);
            setLoading(false);
            return;
          }
          attempts++;
          setTimeout(poll, 1000);
        } catch (e) {
          attempts++;
          setTimeout(poll, 1000);
        }
      };

      poll();
    };

    const fetchHistoryById = async () => {
      setLoading(true);
      try {
        const result: BffPredictionResponse =
          await apiClient.getPredictionHistoryById(historyId, locale);

        if (
          result.processedMediaUrl === 'processing' ||
          result.processedMediaUrl?.includes('processing')
        ) {
          setIsPolling(true);
          setLoading(false);
          pollForStatus(historyId);
          return;
        }

        processResultData(result);
      } catch (err: any) {
        if (!isPolling) {
          setError(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryById();
  }, [locale]);

  const handleSelectionChange = (index: number) => {
    if (allDetections[index]) {
      setSelectedDetection(allDetections[index]);
    }
  };
  const handleViewDetails = () => {
    if (selectedDetection?.breedInfo?.slug) {
      navigation.navigate('DogDetail', {
        slug: selectedDetection.breedInfo.slug,
      });
    }
  };
  const onViewPokedex = () => {
    if (selectedDetection?.breedInfo?.slug) {
      navigation.navigate('PokedexScreen');
    }
  };

  if (loading || isPolling) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  if (noDetectionsFound) {
    return <NoDetectionsView />;
  }

  if (!selectedDetection || !selectedDetection.breedInfo) {
    return (
      <ErrorView error="Could not display details. The result data might be incomplete." />
    );
  }

  const selectedBreedInfo = selectedDetection.breedInfo;
  const selectedDisplayName = selectedBreedInfo.breed;
  const selectedConfidence = Math.round(selectedDetection.confidence * 100);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}

      {/* Main Result Card */}
      <BreedCard
        breedName={selectedDisplayName}
        processedMediaUrl={processedMediaUrl}
        group={selectedBreedInfo.group || ''}
        confidence={selectedConfidence}
        slug={selectedBreedInfo.slug}
        onViewDetails={handleViewDetails}
        onViewPokedex={onViewPokedex}
      />

      {/* Breed Selector */}
      {allDetections.length > 1 && (
        <BreedSelector
          detections={allDetections}
          selectedDetection={selectedDetection}
          onSelectionChange={handleSelectionChange}
        />
      )}

      {/* Details Section */}
      <View style={styles.detailsSection}>
        <CharacteristicsCard breedInfo={selectedBreedInfo} />
        <PhysicalInfoCard breedInfo={selectedBreedInfo} />
        <TemperamentCard breedInfo={selectedBreedInfo} />
        <DescriptionCard description={selectedBreedInfo.description} />
      </View>
      <HealthRecommendations
        breedSlug={selectedBreedInfo.slug}
        breedName={selectedBreedInfo.breed}
      />
      <RecommendedProducts
        breedSlug={selectedBreedInfo.slug}
        breedName={selectedBreedInfo.breed}
      />
      <BreedChatBox
        breedSlug="pembroke-welsh-corgi"
        breedName="Corgi"
        initialMessage="Xin chào! Tôi có thể giúp bạn hiểu thêm về giống chó này 🐶"
      />
      <FeedbackForm
        detectedBreed={selectedDisplayName}
        confidence={selectedConfidence}
        imageUrl={''}
        predictionId={predictionId}
        initialSubmitted={hasFeedback} // Truyền trạng thái ban đầu xuống form
      />

      {/* Bottom Spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsSection: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
});
