'use client';
import RNFS from 'react-native-fs';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n-context';
import { apiClient } from '../../lib/api-client';
import type { PredictionHistoryItem } from '../../lib/types';
import Toast from 'react-native-toast-message';
import PredictionCard from '../../components/prediction-card';
import FilterBar from '../../components/filter-bar';
import { ArrowDown, Navigation } from 'lucide-react-native';
import { HistoryStackParamList } from '../../navigation/HistoryStack';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type FilterType = 'all' | 'image' | 'video';
type SortType = 'newest' | 'oldest' | 'confidence';
type Props = NativeStackScreenProps<HistoryStackParamList, 'HistoryScreen'>;
export default function HistoryScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useI18n();
  const [predictions, setPredictions] = useState<PredictionHistoryItem[]>([]);
  const [filteredPredictions, setFilteredPredictions] = useState<
    PredictionHistoryItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!user) return;
    fetchHistory(1, true);
  }, [user]);

  const fetchHistory = async (pageToFetch: number, reset = false) => {
    try {
      // setLoading(true);
      // const data = await apiClient.getPredictionHistory();
      // setPredictions(data.histories || []);
      if (reset) setLoading(true);
      const data = await apiClient.getPredictionHistory({
        page: pageToFetch,
        limit,
      });
      const newHistories = data.histories || [];

      setPredictions(prev =>
        reset ? newHistories : [...prev, ...newHistories],
      );
      setHasMore(newHistories.length === limit); // nếu fetch đủ limit thì còn dữ liệu
      setPage(pageToFetch);
    } catch (error) {
      console.error('Failed to fetch prediction history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...predictions];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.media.type === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.detections.some(det =>
          det.detectedBreed
            .toLowerCase()
            .replace(/_/g, ' ')
            .includes(lowerCaseSearchTerm),
        ),
      );
    }

    // Sort
    if (sortBy === 'newest') {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sortBy === 'oldest') {
      filtered.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } else if (sortBy === 'confidence') {
      filtered.sort((a, b) => {
        const maxConfidenceA = Math.max(
          ...a.detections.map(p => p.confidence),
          0,
        );
        const maxConfidenceB = Math.max(
          ...b.detections.map(p => p.confidence),
          0,
        );
        return maxConfidenceB - maxConfidenceA;
      });
    }

    setFilteredPredictions(filtered);
  }, [predictions, searchTerm, filterType, sortBy]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    fetchHistory(page + 1);
  };
  const handleDelete = async (id: string) => {
    try {
      const result = await apiClient.deletePredictionHistory(id);
      setPredictions(predictions.filter(p => p.id !== id));
      Toast.show({
        type: 'success',
        text1: t('history.deleteSuccess'),
      });
    } catch (error: any) {
      console.error('Failed to delete prediction:', error);
      Toast.show({
        type: 'error',
        text1: t('history.deleteError'),
        text2: error.message,
      });
    }
  };
  const handleViewDetails = (id: string) => {
    navigation.navigate('ResulteScreen', {
      id: id,
    });
  };

  const handleDownload = async (prediction: PredictionHistoryItem) => {
    const url = prediction.processedMediaUrl;
    if (!url) return;

    try {
      // QUYỀN - Android < 13
      if (Platform.OS === 'android' && Platform.Version < 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
      }

      // 1️⃣ Fix URL Cloudinary -> JPG
      const fixedUrl = url.replace('/upload/', '/upload/f_jpg/') + '.jpg';

      const fileName = fixedUrl.split('/').pop() || 'image.jpg';
      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

      console.log('Final download URL:', fixedUrl);

      const download = RNFS.downloadFile({
        fromUrl: fixedUrl,
        toFile: destPath,
      });

      const res = await download.promise;

      if (res.statusCode === 200) {
        console.log('Saved:', destPath);
        Toast.show({ type: 'success', text1: 'Download OK!' });
      } else {
        throw new Error('Status ' + res.statusCode);
      }
    } catch (e) {
      console.log('Download error:', e);
      Toast.show({ type: 'error', text1: 'Download failed' });
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchHistory(1, true);
    setRefreshing(false);
  }, []);

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('history.loginRequired')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('history.title')}</Text>
        <Text style={styles.subtitle}>{t('history.subtitle')}</Text>
      </View>

      {/* Search and Filters */}
      <ScrollView
        style={styles.filtersContainer}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <TextInput
          style={styles.searchInput}
          placeholder={t('history.searchPlaceholder')}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#999"
        />
        <FilterBar
          filterType={filterType}
          sortBy={sortBy}
          onFilterTypeChange={setFilterType}
          onSortByChange={setSortBy}
        />
      </ScrollView>

      {/* Content */}
      {loading && page === 1 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066ff" />
        </View>
      ) : filteredPredictions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('history.noPredictions')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPredictions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PredictionCard
              prediction={item}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onView={handleViewDetails}
            />
          )}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={() =>
            hasMore ? (
              <Text
                style={{ textAlign: 'center', padding: 12, color: '#0066ff' }}
                onPress={loadMore}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#0066ff" />
                ) : (
                  <ArrowDown size={24} color="#0066ff" />
                )}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 8,
  },
  listContent: {
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
});
