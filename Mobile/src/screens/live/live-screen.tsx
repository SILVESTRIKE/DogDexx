import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import RNFS from 'react-native-fs';
// Icons - sử dụng react-native-vector-icons hoặc expo-vector-icons
import Icon from 'react-native-vector-icons/Feather';
import { apiClient } from '../../lib/api-client';
import { captureRef } from 'react-native-view-shot';
import { FeedStackParamList } from '../../navigation/FeedStack';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useI18n } from '../../lib/i18n-context';
// Types
interface Detection {
  detectedBreed: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

type Props = NativeStackScreenProps<FeedStackParamList, 'LiveScreen'>;
export default function LiveDetectionScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const cameraRef = useRef<Camera>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);

  // Initialize WebSocket - SỬ DỤNG LẠI apiClient
  const initializeWebSocket = async () => {
    try {
      // Import apiClient từ file của bạn
      const ws = await apiClient.connectStreamPrediction1();
      console.log('[RN] WebSocket connecting to:', ws);

      ws.onopen = () => {
        console.log('[BFF-WS] WebSocket connected');
        console.log('[RN] WebSocket ready state:', ws.readyState);
        setIsConnected(true);
      };

      ws.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[BFF-WS] Message received:', data);
          if (data.type === 'final_result') {
            console.log('[BFF-WS] Final result received:', data);
            if (data.predictionId) {
              stopCamera('Stream Completed');
              navigation.navigate('ResulteScreen', { id: data.predictionId });
            } else {
              console.error(
                '[BFF-WS] Final result missing predictionId:',
                data,
              );
              Alert.alert('Error', 'Failed to get prediction ID for redirect.');
            }
          } else if (data.type === 'endOfStream') {
            console.log('[BFF-WS] Stream ended:', data.message);
            stopCamera('Stream Completed');
          } else if (data && Array.isArray(data.detections)) {
            setDetections(data.detections);
          } else if (data.error) {
            const errorMessage = data.error || 'An unknown error occurred.';
            console.error('[BFF-WS] Error from server:', errorMessage);
            Alert.alert('Server Error', errorMessage);
          }
        } catch (error) {
          console.error('[RN] Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (event: any) => {
        console.error('[BFF-WS] WebSocket error occurred:', event.code);
        setIsConnected(false);
      };

      ws.onclose = (event: any) => {
        console.log(
          `[BFF-WS] WebSocket disconnected: Code=${event.code}, Reason=${event.reason}`,
        );
        setIsConnected(false);
        stopCamera('Connection Closed');
        if (event.code !== 1000 && event.code !== 1005) {
          let message = 'Connection to server closed unexpectedly.';
          switch (event.code) {
            case 1008:
              message =
                'Insufficient tokens or policy violation. Stream stopped.';
              break;
            case 1011:
              message = 'Server error occurred. Please try again later.';
              break;
            default:
              message += ` (Code: ${event.code})`;
          }

          //Alert.alert('Disconnected', message);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[RN] Error connecting WebSocket:', error);
      Alert.alert(
        'Connection Error',
        'Failed to connect to the detection service. Please try again later.',
      );
    }
  };

  // Send frame to WebSocket
  const sendFrameToWebSocket = async () => {
    //  if (!isStreaming) console.log('Not streaming currently');
    console.log('isStreaming status:', wsRef.current!.readyState);
    if (
      !cameraRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      console.log('Camera not ready or WebSocket not open or not streaming');
      return;
    }

    try {
      // Chụp ảnh từ camera
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });
      const base64 = await RNFS.readFile(photo.path, 'base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(dataUrl);
        console.log('Frame sent to WebSocket');
      }
    } catch (error) {
      //console.error('[Camera] Capture error:', error);// isstreaming đặt kiểm tra ngay đầu thì nó không gửi luôn
    }
  };

  // Start camera and streaming
  const startCamera = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to use this feature.',
        );
        return;
      }
    }
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log('Socket already exists/connecting');
      return;
    }

    if (isStreaming) {
      stopCamera('User initiated');
      return;
    }

    setIsStreaming(true);
    setDetections([]);
    setIsConnecting(true);

    await initializeWebSocket();
    setIsConnecting(false);

    //Gửi frame mỗi 200ms (5 FPS)
    frameIntervalRef.current = setInterval(() => {
      sendFrameToWebSocket();
    }, 1000);
  };

  // Stop camera
  const stopCamera = (reason: string = 'Client initiated') => {
   // console.log(`[RN] Stopping camera1: ${reason}`);
    setIsStreaming(false);
    setDetections([]);

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, reason);
      }
      wsRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera('Component Unmount');
    };
  }, []);

  // Render connection status badge
  const renderStatusBadge = () => {
    if (!isStreaming) return null;

    if (isConnected) {
      return (
        <View style={styles.badgeConnected}>
          <Icon name="wifi" size={12} color="#fff" />
          <Text style={styles.badgeText}>Connected</Text>
        </View>
      );
    }

    if (isConnecting) {
      return (
        <View style={styles.badgeConnecting}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.badgeTextDark}>Connecting...</Text>
        </View>
      );
    }

    return (
      <View style={styles.badgeConnecting}>
        <Icon name="wifi-off" size={12} color="#666" />
        <Text style={styles.badgeTextDark}>Connecting...</Text>
      </View>
    );
  };

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('live.title')}</Text>
        <Text style={styles.subtitle}>{t('live.subtitle')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Camera Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Camera</Text>
              {renderStatusBadge()}
            </View>
            <TouchableOpacity
              style={[
                styles.button,
                isStreaming ? styles.buttonDanger : styles.buttonPrimary,
              ]}
              onPress={
                isStreaming ? () => stopCamera('User stopped') : startCamera
              }
            >
              <Icon
                name={isStreaming ? 'camera-off' : 'camera'}
                size={16}
                color="#fff"
              />
              <Text style={styles.buttonText}>
                {isStreaming ? 'Tắt Camera' : 'Bật Camera'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Camera View */}
          <View style={styles.cameraContainer}>
            {isStreaming ? (
              <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={isStreaming}
                photo={true}
              />
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Icon name="camera" size={64} color="#999" />
                <Text style={styles.placeholderText}>
                  {t('live.clickToStart')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Instructions Card */}
        <View style={[styles.card, styles.instructionsCard]}>
          <Text style={styles.cardTitleSmall}>{t('live.instructions')}</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instruction}>{t('live.instruction1')}</Text>
            <Text style={styles.instruction}>{t('live.instruction2')}</Text>
            <Text style={styles.instruction}>{t('live.instruction3')}</Text>
            <Text style={styles.instruction}>{t('live.instruction4')}</Text>
          </View>
        </View>

        {/* Detections Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('live.title')} ({detections.length})
          </Text>
          <ScrollView style={styles.detectionsList}>
            {detections.length === 0 && isStreaming ? (
              <Text style={styles.noDetections}> {t('live.searching')}</Text>
            ) : (
              detections.map((det, index) => (
                <View key={index} style={styles.detectionItem}>
                  <Text style={styles.detectionBreed}>
                    {det.detectedBreed.replace(/-/g, ' ')}
                  </Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {(det.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cardTitleSmall: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  badgeConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeConnecting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e5e5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  badgeTextDark: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  cameraContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    marginTop: 16,
    fontSize: 14,
  },
  instructionsCard: {
    backgroundColor: '#f9fafb',
  },
  instructionsList: {
    gap: 8,
  },
  instruction: {
    fontSize: 14,
    color: '#666',
  },
  detectionsList: {
    maxHeight: 200,
  },
  detectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  detectionBreed: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e7',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
  },
  noDetections: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});
