// ScanItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ScanItem } from '../types';

interface ScanItemProps {
  item: ScanItem;
  onShowPress?: (item: ScanItem) => void;
  onRerunPress?: (item: ScanItem) => void;
}

const ScanItemComponent: React.FC<ScanItemProps> = ({
  item,
  onShowPress,
  onRerunPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Timestamp header */}
      <Text style={styles.timestamp}>{item.timestamp}</Text>

      {/* Main row: Circular image (smaller, ~20% left) + Right content (80%) */}
      <View style={styles.mainRow}>
        <View style={styles.imageContainer}>
          <Image
            source={
              item.imageUrl
                ? { uri: item.imageUrl }
                : {
                    uri: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?&w=200&h=200',
                  }
            }
            style={styles.dogImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.rightContent}>
          <View style={styles.textContent}>
            <Text style={styles.breedLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.percentage}>{item.percentage}</Text>
            <Text style={styles.furtherMatches} numberOfLines={2}>
              {item.furtherMatches}
            </Text>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => onRerunPress?.(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Rerun</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => onShowPress?.(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText2}>Show</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f5f5f5',
  },
  timestamp: {
    fontSize: 12,
    color: '#9e9e9e',
    fontWeight: '500',
    marginBottom: 12,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    flexBasis: '20%', // Giữ nhỏ ~20%
    aspectRatio: 1,
    borderRadius: '50%',
    overflow: 'hidden',
    backgroundColor: '#e0e0e0', // Màu xám bên trong (visible nếu không có ảnh)
    borderWidth: 2, // Giữ viền xám cho hình (theo yêu cầu trước)
    borderColor: '#d0d0d0', // Viền xám nhạt
    marginRight: 12,
  },
  dogImage: {
    width: '100%',
    height: '100%',
  },
  rightContent: {
    flex: 1, // Tự động chiếm phần còn lại (~80%)
  },
  textContent: {
    marginBottom: 12,
  },
  breedLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#43acafff',
    marginBottom: 2,
    lineHeight: 22,
  },
  percentage: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  furtherMatches: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Căn đều (space-around để hai button cách đều trong phần còn lại)
    alignItems: 'center',
    width: '100%', // Đầy đủ chiều rộng của rightContent để căn giữa
  },
  button: {
    // Bỏ backgroundColor, borderWidth, borderColor, padding lớn – chỉ giữ text đơn giản
    paddingHorizontal: 4, // Padding tối thiểu để clickable
    paddingVertical: 4,
    borderRadius: 4, // Giữ nhẹ để mượt
    minWidth: 60, // Đảm bảo kích thước cơ bản
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#666', // Màu xanh link-like để chỉ rõ clickable (thay vì xám nhạt)
   // textDecorationLine: 'underline', // Thêm gạch chân để giống text link (tùy chọn, có thể bỏ nếu không muốn)
  },
  buttonText2: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#43acafff', // Màu xanh link-like để chỉ rõ clickable (thay vì xám nhạt)
   // textDecorationLine: 'underline', // Thêm gạch chân để giống text link (tùy chọn, có thể bỏ nếu không muốn)
  },
});

export default ScanItemComponent;