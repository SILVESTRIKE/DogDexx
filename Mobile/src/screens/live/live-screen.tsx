import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevice, PhotoFile } from 'react-native-vision-camera';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { apiClient } from '../../lib/api-client';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeedStackParamList } from '../../navigation/FeedStack';
import { useI18n } from '../../lib/i18n-context';

// Types
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Detection {
  detectedBreed: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

// Constants
const STREAM_FRAME_WIDTH = 640;
const FRAME_INTERVAL_MS = 200; // 5 FPS
const WS_URL = 'ws://your-server-url/stream'; // Thay đổi URL của bạn
type Props = NativeStackScreenProps<FeedStackParamList, 'LiveScreen'>;
export default function LiveDetectionScreen({ navigation, route }: Props) {
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef<boolean>(false);
  const { t } = useI18n();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [hasPermission, setHasPermission] = useState(false);

  // Request camera permission
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera('Component Unmount');
    };
  }, []);

  // Initialize WebSocket
  const initializeWebSocket = useCallback(async () => {
    try {
      const ws = await apiClient.connectStreamPrediction1();

      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'final_result') {
            console.log('[WS] Final result received:', data);
            if (data.predictionId) {
              console.log(
                '[WS] Navigating to Results with ID:',
                data.predictionId,
              );
              stopCamera('Received Final Result');
              // navigation.navigate('Results' as never, { id: data.predictionId } as never);
              navigation.navigate('ResulteScreen', { id: data.predictionId });
            }
          } else if (data.type === 'endOfStream') {
            console.log('[WS] Stream ended:', data.message);
            stopCamera('Stream Completed');
          } else if (data && Array.isArray(data.detections)) {
            setDetections(data.detections);
          } else if (data.error) {
            console.error('[WS] Server error:', data.error);
          }
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };

      ws.onerror = () => {
        console.error('[WS] Error occurred');
        setIsConnected(false);
      };

      ws.onclose = event => {
        console.log(`[WS] Closed: Code=${event.code}`);
        setIsConnected(false);
        if (event.code !== 1000 && event.code !== 1005) {
          stopCamera('Connection Closed');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WS] Connection error:', error);
      setIsConnecting(false);
    }
  }, [navigation]);

  // Send frame to WebSocket
  const sendFrameToWebSocket = useCallback(async () => {
    const camera = cameraRef.current;

    if (
      !camera ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      isCapturingRef.current
    ) {
      return;
    }

    isCapturingRef.current = true;

    try {
      // Capture photo
      const photo: PhotoFile = await camera.takePhoto({
        enableShutterSound: false,
      });

      const photoUri = `file://${photo.path}`;

      // Calculate target dimensions
      const aspectRatio = photo.height / photo.width;
      const targetWidth = STREAM_FRAME_WIDTH;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      // Resize image
      const resizedImage = await ImageResizer.createResizedImage(
        photoUri,
        targetWidth,
        targetHeight,
        'JPEG',
        60,
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: false },
      );

      // Read as base64
      const base64Data = await RNFS.readFile(resizedImage.uri, 'base64');

      // Send via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const dataUrl = `data:image/jpeg;base64,${base64Data}`;
        wsRef.current.send(dataUrl);
      }

      // Cleanup temp files
      await RNFS.unlink(photo.path).catch(() => {});
      await RNFS.unlink(resizedImage.uri.replace('file://', '')).catch(
        () => {},
      );
    } catch (error) {
      console.warn('[Camera] Frame capture error:', error);
    } finally {
      isCapturingRef.current = false;
    }
  }, []);

  // Start camera streaming
  const startCamera = useCallback(async () => {
    if (isStreaming) {
      stopCamera('Restart');
    }

    setIsStreaming(true);
    setDetections([]);
    setIsConnecting(true);

    await initializeWebSocket();

    // Start frame capture interval
    frameIntervalRef.current = setInterval(() => {
      sendFrameToWebSocket();
    }, FRAME_INTERVAL_MS);
  }, [isStreaming, initializeWebSocket, sendFrameToWebSocket]);

  // Stop camera streaming
  const stopCamera = useCallback((reason: string = 'Client initiated') => {
    console.log('[Camera] Stopping:', reason);

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

    setIsStreaming(false);
    setIsConnected(false);
    setIsConnecting(false);
    setDetections([]);
  }, []);

  // Render connection status badge
  const renderStatusBadge = () => {
    if (!isStreaming) return null;

    if (isConnected) {
      return (
        <View style={[styles.badge, styles.badgeConnected]}>
          <Icon name="wifi" size={12} color="#fff" />
          <Text style={styles.badgeText}>Connected</Text>
        </View>
      );
    }

    if (isConnecting) {
      return (
        <View style={[styles.badge, styles.badgeConnecting]}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.badgeText}>Connecting...</Text>
        </View>
      );
    }

    return (
      <View style={[styles.badge, styles.badgeDisconnected]}>
        <Icon name="wifi-off" size={12} color="#fff" />
        <Text style={styles.badgeText}>Disconnected</Text>
      </View>
    );
  };

  // No permission view
  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Icon name="camera-off" size={48} color="#888" />
        <Text style={styles.noPermissionText}>Camera permission required</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Camera.requestCameraPermission()}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // No device view
  if (!device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('live.title')}</Text>
        <Text style={styles.subtitle}>Real-time dog breed detection</Text>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <View style={styles.cameraHeaderLeft}>
            <Text style={styles.cameraTitle}>Camera</Text>
            {renderStatusBadge()}
          </View>
          <TouchableOpacity
            style={[
              styles.cameraButton,
              isStreaming ? styles.stopButton : styles.startButton,
            ]}
            onPress={isStreaming ? () => stopCamera() : startCamera}
          >
            <Icon
              name={isStreaming ? 'camera-off' : 'camera'}
              size={16}
              color="#fff"
            />
            <Text style={styles.cameraButtonText}>
              {isStreaming ? t('live.stopCamera') : t('live.startCamera')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cameraWrapper}>
          {isStreaming ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              photo={true}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Icon name="camera" size={64} color="#666" />
              <Text style={styles.placeholderText}>
                {t('live.clickToStart')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Instructions Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('live.instructions')}</Text>
        <Text style={styles.instruction}>• {t('live.instruction1')}</Text>
        <Text style={styles.instruction}>• {t('live.instruction2')}</Text>
        <Text style={styles.instruction}>• {t('live.instruction3')}</Text>
        <Text style={styles.instruction}>• {t('live.instruction4')}</Text>
      </View>

      {/* Detections Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {t('live.title')} ({detections.length})
        </Text>
        <ScrollView style={styles.detectionsList}>
          {detections.length === 0 && isStreaming ? (
            <Text style={styles.lookingText}> {t('live.searching')} </Text>
          ) : (
            detections.map((det, index) => (
              <View key={index} style={styles.detectionItem}>
                <Text style={styles.breedName}>
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
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cameraContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 16,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cameraHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeConnected: {
    backgroundColor: '#22c55e',
  },
  badgeConnecting: {
    backgroundColor: '#6b7280',
  },
  badgeDisconnected: {
    backgroundColor: '#ef4444',
  },
  badgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  startButton: {
    backgroundColor: '#3b82f6',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  cameraButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cameraWrapper: {
    height: (width - 32) * 0.5625, // 16:9 aspect ratio
    backgroundColor: '#000',
    position: 'relative', // Thêm dòng này
    overflow: 'hidden', // Thêm dòng này để đảm bảo camera không tràn ra ngoài
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  instruction: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 6,
  },
  detectionsList: {
    maxHeight: 150,
  },
  lookingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  detectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  breedName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  noPermissionText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
