'use client';

import type React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PokedexHeader from '../../components/PokedexHeader';
import DogGrid from '../../components/DogGrid';
import { theme } from '../../styles';
import type { DogBreed } from '../../lib/types';
import { apiClient } from '../../lib/api-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AllBreedStackParamList } from '../../navigation/AllBreedStack';

import { useCollection } from '../../lib/collection-context';
import { useI18n } from '../../lib/i18n-context';
type Props = NativeStackScreenProps<AllBreedStackParamList, 'PokedexScreen'>;

export default function PokedexScreen({ navigation, route }: Props) {
  const { t, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [filterBy, setFilterBy] = useState('all');
  const { collectionStats, refreshCollection } = useCollection();

  useEffect(() => {
    refreshCollection();
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortBy(value);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterBy(value);
  }, []);

  const handleCardPress = (dog: DogBreed) => {
    if (dog.isCollected) {
      navigation.navigate('DogDetail', {
        slug: dog.slug,
      });
    }
  };
  const handleAchievement = () => {

      navigation.navigate('Archievetment');
    
  };

  const groups = [
    'Herding',
    'Hound',
    'Non-Sporting',
    'Sporting',
    'Terrier',
    'Toy',
    'Working',
    'Wild',
    'Primitive',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <PokedexHeader
          collectionStats={collectionStats}
          totalCount={collectionStats?.totalBreeds ?? 0}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          filterBy={filterBy}
          onFilterChange={handleFilterChange}
          groups={groups}
          onAchievement={handleAchievement}
        />

        <DogGrid
          search={searchQuery}
          sort={sortBy}
          filter={filterBy}
          locale={locale}
          onTotalCountChange={() => {}}
          onCardPress={handleCardPress}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
});
