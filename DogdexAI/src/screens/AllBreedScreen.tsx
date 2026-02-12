
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AllBreedStackParamList } from '../navigation/AllBreedStack';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BreedItem from '../components/BreedItem';
import { BreedListProps, DogBreed } from '../types';
import { supportedBreeds } from '../datas';
type Props = NativeStackScreenProps<AllBreedStackParamList, 'AllBreedScreen'>;

export default function AllBreedScreen({ navigation }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
  const [breeds] = useState<DogBreed[]>(supportedBreeds);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log('Search query:', query);
  };

  const handleBreedPress = (breed: DogBreed) => {
    console.log('Breed pressed:', breed.name);
    // navigation.navigate('BreedDetail', { breed });
  };

  const filteredBreeds = breeds.filter(breed =>
    breed.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: DogBreed }) => (
    <BreedItem breed={item} onPress={handleBreedPress} />
  );
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      

      {/* Supported Breeds Title */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SUPPORTED BREEDS</Text>
      </View>

      {/* Breeds List */}
      <FlatList
        data={filteredBreeds}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search a dog breed"
                value={searchQuery}
                onChangeText={handleSearch}
                placeholderTextColor="#999"
              />
            </View>

            {/* Divider */}
            <View style={styles.divider} />
          </>
        }
        // ListFooterComponent={
        //   <>
        //     {/* Divider */}
        //     <View style={styles.divider} />

          
        //   </>
        // }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  section: {
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  listContent: {
    flexGrow: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  adContainer: {
    padding: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  adText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
});