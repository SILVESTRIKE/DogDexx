import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';

import { apiClient } from '../lib/api-client';
import { useI18n } from '../lib/i18n-context';
import MaterialIcons from 'react-native-vector-icons/FontAwesome5';
import MaterialIcons1 from 'react-native-vector-icons/MaterialIcons';

interface HealthBlock {
  title: string;
  items: string[];
}

interface HealthRecommendationsProps {
  breedSlug: string;
  breedName: string;
}

export function HealthRecommendations({
  breedSlug,
  breedName,
}: HealthRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { locale: lang, t } = useI18n();

  // Fetch data từ backend - logic giống như component web
  useEffect(() => {
    if (!breedSlug) return;
    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.getHealthRecommendations(breedSlug, lang);
        setRecommendations(data.recommendations);
      } catch (err) {
        console.error('Failed to fetch health recommendations:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load recommendations.'
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecommendations();
  }, [breedSlug, lang]);

  // Phân tích dữ liệu từ AI thành cấu trúc Accordion
  const structuredData = useMemo(() => {
    if (!recommendations) return [];

    const blocks: HealthBlock[] = [];
    let currentBlock: HealthBlock | null = null;

    recommendations.split('\n').forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('### ')) {
        currentBlock = { title: trimmedLine.substring(4), items: [] };
        blocks.push(currentBlock);
      } else if (trimmedLine.startsWith('- ') && currentBlock) {
        currentBlock.items.push(trimmedLine.substring(2));
      }
    });

    return blocks;
  }, [recommendations]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.headerSkeleton}>
            <ActivityIndicator size="large" color="#0066cc" />
          </View>
          <View style={styles.contentSkeleton}>
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
          </View>
        </View>
      </View>
    );
  }

  // Error state hoặc không có dữ liệu
  if (error || structuredData.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header với icon */}
        <View style={styles.header}>
          <MaterialIcons name="stethoscope" size={24} color="#0066cc" />
          <Text style={styles.headerTitle}>
            {t('results.healthRecommendations')}
          </Text>
        </View>

        {/* Accordion Items */}
        <ScrollView style={styles.content} scrollEnabled={false}>
          {structuredData.map((block, index) => (
            <AccordionItem
              key={index}
              title={block.title}
              items={block.items}
              isExpanded={expandedIndex === index}
              onPress={() =>
                setExpandedIndex(expandedIndex === index ? null : index)
              }
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

interface AccordionItemProps {
  title: string;
  items: string[];
  isExpanded: boolean;
  onPress: () => void;
}

function AccordionItem({
  title,
  items,
  isExpanded,
  onPress,
}: AccordionItemProps) {
  const animatedHeight = useMemo(() => new Animated.Value(0), []);
  const animatedRotation = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedRotation, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const rotation = animatedRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const maxHeight = items.length * 40 + 20;
  const height = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxHeight],
  });

  return (
    <View style={styles.accordionItem}>
      <TouchableOpacity style={styles.accordionTrigger} onPress={onPress}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <MaterialIcons1 name="expand-more" size={24} color="#0066cc" />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.accordionContent, { height }]}>
        <View style={styles.itemsList}>
          {items.map((item, index) => (
            <View key={index} style={styles.bulletItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    paddingHorizontal: 0,
  },
  headerSkeleton: {
    height: 32,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  contentSkeleton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  skeletonLine: {
    height: 48,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  // Accordion styles
  accordionItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  accordionTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f9f9f9',
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  accordionContent: {
    overflow: 'hidden',
  },
  itemsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: 'bold',
  },
  itemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    lineHeight: 20,
  },
});
