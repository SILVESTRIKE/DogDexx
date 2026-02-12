import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { DogBreed } from '../types';

interface BreedItemProps {
  breed: DogBreed;
  onPress?: (breed: DogBreed) => void;
}

const BreedItem: React.FC<BreedItemProps> = ({ breed, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.breedItem}
      onPress={() => onPress?.(breed)}
      activeOpacity={0.7}
    >
      {/* Hình ảnh bên trái - 15% (hình tròn nhỏ hơn) */}
      <View style={styles.imageContainer}>
        <Image 
          source={
            breed.imageUrl
              ? { uri: breed.imageUrl }
              : {
                  uri: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?&w=200&h=200',
                }
          }
          style={styles.breedImage}
          resizeMode="cover"
        />
      </View>
      
      {/* Nội dung bên phải - 85% */}
      <View style={styles.contentContainer}>
        <Text style={styles.breedName} numberOfLines={1} ellipsizeMode="tail">
          {breed.name}
        </Text>
        <Text style={styles.fciNumber}>FCI Number: {breed.fciNumber}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  breedItem: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  imageContainer: {
    width: '15%', // Giảm xuống 15% để nhỏ hơn
    aspectRatio: 1, // Giữ tỷ lệ vuông
    marginRight: 16,
    borderRadius: '50%', // Thay thành 50% để hình tròn hoàn hảo
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  breedImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1, // Tự động chiếm phần còn lại (~85%)
    justifyContent: 'center',
  },
  breedName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  fciNumber: {
    fontSize: 14,
    color: '#666',
  },
});

export default BreedItem;