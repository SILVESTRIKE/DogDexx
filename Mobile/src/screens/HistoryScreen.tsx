import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScanItemComponent from '../components/ScanItem';
import { scanList } from '../datas';
import { ScanItem } from '../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HistoryStackParamList } from '../navigation/HistoryStack';

type Props = NativeStackScreenProps<HistoryStackParamList, 'HistoryScreen'>;

export default function HistoryScreen({ navigation }: Props) {
  const handleShowPress = (item: ScanItem) => {
    console.log('Show pressed for:', item.label);
    // Xử lý khi nhấn nút Show, ví dụ: navigation.navigate('DetailScreen', { item })
  };

  const handleRerunPress = (item: ScanItem) => {
    console.log('Rerun pressed for:', item.label);
    // Xử lý khi nhấn nút Rerun
  };

  const renderItem = ({ item }: { item: ScanItem }) => (
    <ScanItemComponent 
      item={item} 
      onShowPress={handleShowPress}
      onRerunPress={handleRerunPress}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={scanList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    flexGrow: 1,
  },
});