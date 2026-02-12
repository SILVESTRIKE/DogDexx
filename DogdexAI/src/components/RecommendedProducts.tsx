import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { apiClient } from '../lib/api-client';
import { useI18n } from '../lib/i18n-context';
import type { RecommendedProduct } from '../lib/types';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialCommunityIcons1 from 'react-native-vector-icons/Ionicons';


interface Props {
  breedSlug: string;
  breedName: string;
}

export function RecommendedProducts({ breedSlug, breedName }: Props) {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { locale: lang, t } = useI18n();

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.getRecommendedProducts(breedSlug, lang);
        setProducts(response.products);
      } catch (error) {
        console.error('Failed to fetch products', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [breedSlug, lang]);

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      console.error('Failed to open URL:', url);
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {t('results.recommendedProductsTitle', { breedName })}
        </Text>
        <View style={styles.loadingContainer}>
          {[...Array(3)].map((_, i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      </View>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const renderProduct = ({ item, index }: { item: RecommendedProduct; index: number }) => (
    <TouchableOpacity
      key={index}
      onPress={() => handleOpenUrl(item.shopeeUrl)}
      activeOpacity={0.7}
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.category}>{item.category}</Text>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.reason} numberOfLines={3}>
            {item.reason}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => handleOpenUrl(item.shopeeUrl)}
        >
          <MaterialCommunityIcons
            name="shopping-outline"
            size={18}
            color="#fff"
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>
            {t('results.findOnShopee')}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <MaterialCommunityIcons1
          name="sparkles-sharp"
          size={24}
          color="#3b82f6"
          style={styles.icon}
        />
        <Text style={styles.title}>
          {t('results.recommendedProductsTitle', { breedName })}
        </Text>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(_, index) => index.toString()}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
        numColumns={2}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  loadingContainer: {
    gap: 12,
  },
  skeletonCard: {
    height: 160,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 12,
  },
  row: {
    gap: 12,
  },
  listContent: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  category: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    minHeight: 60,
    justifyContent: 'center',
  },
  reason: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
