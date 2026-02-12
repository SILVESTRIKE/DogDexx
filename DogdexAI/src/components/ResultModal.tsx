import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultData: any;
  onCleanup?: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  resultData,
  onCleanup,
}) => {
  const navigation = useNavigation();
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen && resultData) {
      setPreviewImage(resultData.processedMediaUrl);
      
      // Lấy kích thước ảnh gốc
      Image.getSize(
        resultData.processedMediaUrl,
        (width, height) => {
          setOriginalImageSize({ width, height });
        },
        (error) => console.error('Error getting image size:', error)
      );
    }
  }, [isOpen, resultData]);

  if (!resultData) return null;

  const detection = resultData.detections[0];
  const confidencePercent = Math.round(detection.confidence * 100);

  // Tính toán tỷ lệ scale từ ảnh gốc xuống preview
  const getScaledBox = () => {
    if (!imageLayout.width || !originalImageSize.width) return null;

    const scaleX = imageLayout.width / originalImageSize.width;
    const scaleY = imageLayout.height / originalImageSize.height;

    const [x1, y1, x2, y2] = detection.box;
    return {
      x: x1 * scaleX,
      y: y1 * scaleY,
      width: (x2 - x1) * scaleX,
      height: (y2 - y1) * scaleY,
    };
  };

  const scaledBox = getScaledBox();

  const drawAndSave = async () => {
    if (!resultData.rawBase64) {
      // Toast notification - cần cài thư viện react-native-toast-message
    //   alert('Thiếu dữ liệu ảnh gốc.');
    Alert.alert('Lỗi', 'Thiếu dữ liệu ảnh gốc.');
      return;
    }
    setIsSaving(true);

    try {
      // Xử lý canvas với react-native-canvas hoặc gửi lên server
      // Đây là logic giả định - cần điều chỉnh theo API thực tế
      const finalBase64 = resultData.rawBase64; // Simplified

      // Gọi API save
      const response = await fetch('YOUR_API_ENDPOINT/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processed_media_base64: finalBase64,
          detections: [
            {
              class: detection.detectedBreed,
              confidence: detection.confidence,
              box: detection.box,
              track_id: detection.track_id,
            },
          ],
          media_type: 'image/jpeg',
        }),
      });

      const res = await response.json();

      // Toast success
    //   alert('Lưu thành công!');
      if (onCleanup) onCleanup();

      // Navigate to results screen
    //   navigation.navigate('ResulteScreen', { id: res.id });
    } catch (e) {
      console.error(e);
    //   alert('Lỗi khi xử lý ảnh.');
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent>
      <StatusBar backgroundColor="rgba(0,0,0,0.8)" barStyle="light-content" />
      
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Preview Image */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: previewImage }}
              style={styles.image}
              resizeMode="contain"
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setImageLayout({ width, height });
              }}
            />

            {/* Detection Box Overlay */}
            {scaledBox && (
              <Svg
                style={StyleSheet.absoluteFill}
                width={imageLayout.width}
                height={imageLayout.height}>
                {/* Detection Rectangle */}
                <Rect
                  x={scaledBox.x}
                  y={scaledBox.y}
                  width={scaledBox.width}
                  height={scaledBox.height}
                  stroke="#22c55e"
                  strokeWidth="3"
                  fill="none"
                />
                
                {/* Label Background */}
                <Rect
                  x={scaledBox.x}
                  y={scaledBox.y - 30}
                  width={scaledBox.width}
                  height="30"
                  fill="#22c55e"
                />
                
                {/* Label Text */}
                <SvgText
                  x={scaledBox.x + 10}
                  y={scaledBox.y - 10}
                  fill="#fff"
                  fontSize="14"
                  fontWeight="bold">
                  {detection.detectedBreed} {confidencePercent}%
                </SvgText>
              </Svg>
            )}

            {/* Confidence Badge */}
            <View
              style={[
                styles.badge,
                confidencePercent > 80 ? styles.badgeGreen : styles.badgeYellow,
              ]}>
              <Text style={styles.badgeText}>
                {confidencePercent}% Tin cậy
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSaving}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Info & Actions */}
          <View style={styles.infoContainer}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>{detection.detectedBreed}</Text>
              <Text style={styles.subtitle}>
                ID: {detection.track_id} • AI Confidence: {confidencePercent}%
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={isSaving}>
                <Text style={styles.cancelButtonText}>Hủy bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={drawAndSave}
                disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.saveButtonText}>💾 </Text>
                    <Text style={styles.saveButtonText}>Lưu & Xem chi tiết</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width - 40,
    maxWidth: 500,
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  imageContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeGreen: {
    backgroundColor: '#16a34a',
  },
  badgeYellow: {
    backgroundColor: '#ca8a04',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '300',
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#737373',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#000',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});