import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MapPin, BookOpen } from 'lucide-react-native';
import { useI18n } from '../lib/i18n-context';

interface BreedCardProps {
  breedName: string;
  processedMediaUrl: string | null;
  group: string;
  confidence: number;
  slug: string;
 onViewDetails?: () => void; // thêm callback
 onViewPokedex?: () => void; // thêm callback
}

export default function BreedCard({
  breedName,
  processedMediaUrl,
  group,
  confidence,
  slug,
  onViewDetails,
  onViewPokedex
}: BreedCardProps) {
  const { t } = useI18n();
  const { width } = Dimensions.get('window');
  const imageSize = Math.min(width - 32, 320);

  return (
    <View style={styles.card}>
      {/* Image Section */}
      <View
        style={[styles.imageContainer, { width: imageSize, height: imageSize }]}
      >
        {processedMediaUrl && (
          <>
            <Image
              source={{ uri: processedMediaUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoContainer}>
        <Text style={styles.breedName}>{breedName}</Text>

        {/* Origin Badge */}
        <View style={styles.badge}>
          <MapPin size={14} color="#2563eb" />
          <Text style={styles.badgeText}>{group}</Text>
        </View>

        {/* Confidence Bar */}
        <View style={styles.confidenceSection}>
          <View style={styles.confidenceHeader}>
            <Text style={styles.confidenceLabel}>
              {t('results.confidence')}
            </Text>
            <Text style={styles.confidenceValue}>{confidence}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: `${confidence}%` }]}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.primaryButton}
        onPress={onViewPokedex} >
          <BookOpen size={20} color="#fff" />

          <Text style={styles.primaryButtonText}>
            {t('results.viewInPokedex')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
         onPress={onViewDetails} 
        >
          <Text style={styles.secondaryButtonText}>
            {t('results.viewDetails')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  imageContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    gap: 12,
  },
  breedName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  confidenceSection: {
    marginVertical: 8,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
});
