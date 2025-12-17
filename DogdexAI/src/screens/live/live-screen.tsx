import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Svg, {
  Rect,
  Text as SvgText,
  Defs,
  Filter,
  FeColorMatrix,
  Image as SvgImage,
} from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { apiClient } from '../../lib/api-client';
import ImageResizer from 'react-native-image-resizer';
import { captureRef } from 'react-native-view-shot';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeedStackParamList } from '../../navigation/FeedStack';

// --- UNIFIED CONFIGURATION ---
const STANDARD_WIDTH = 434.166656;
const STANDARD_HEIGHT = 460.833344;
const COMPRESSION_QUALITY = 0.6;
const STREAM_TOKEN_COST = 5;

interface DetectionBox {
  track_id: number;
  class: string;
  confidence: number;
  box: number[]; // [x1, y1, x2, y2] - tọa độ chuẩn hóa theo STANDARD_WIDTH x STANDARD_HEIGHT
}

interface SnapshotItem {
  id: string;
  track_id: number;
  breedLabel: string;
  imageUri: string;
  fullImageUri: string;
  confidence: number;
  detectionData: any;
}

interface SnapshotRow {
  rowId: string;
  timestamp: number;
  items: SnapshotItem[];
}
type Props = NativeStackScreenProps<FeedStackParamList, 'LiveScreen'>;
export default function LiveDetectionScreen({ navigation, route }: Props) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const isWaitingResponseRef = useRef(false);
  const isStreamingRef = useRef(false);
  const snapshotThresholdRef = useRef<number>(0.7);
  const capturedTrackIdsRef = useRef<Set<number>>(new Set());
  const isIntentionalCloseRef = useRef(false);

  const [isStreamingState, setIsStreamingState] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [snapshotRows, setSnapshotRows] = useState<SnapshotRow[]>([]);
  const snapshotRowsRef = useRef<SnapshotRow[]>([]); // Ref to track state for cleanup
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotItem | null>(null);
  const [detections, setDetections] = useState<DetectionBox[]>([]);
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [snapshotProcessing, setSnapshotProcessing] = useState<{
    imageUri: string;
    detection: DetectionBox;
    resolve: (uri: string) => void;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const snapshotViewRef = useRef<View>(null);
  const isCapturingSnapshotRef = useRef(false);

  useEffect(() => {
    if (snapshotProcessing && snapshotViewRef.current) {
      const timer = setTimeout(async () => {
        try {
          const uri = await captureRef(snapshotViewRef.current!, {
            format: 'jpg',
            quality: 0.8,
          });
          snapshotProcessing.resolve(uri);
        } catch (error) {
          console.error('Snapshot capture error:', error);
          snapshotProcessing.resolve(snapshotProcessing.imageUri);
        } finally {
          setSnapshotProcessing(null);
        }
      }, 100); // Wait for render
      return () => clearTimeout(timer);
    }
  }, [snapshotProcessing]);

  // Keep ref in sync with state
  useEffect(() => {
    snapshotRowsRef.current = snapshotRows;
  }, [snapshotRows]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    return () => {
      isIntentionalCloseRef.current = true;
      cleanupResources();
    };
  }, []);

  const streamLoop = async () => {
    if (!isStreamingRef.current || !wsRef.current) return;
    if (!isWaitingResponseRef.current) {
      await sendFrame();
    }
    requestAnimationFrame(streamLoop);
  };

  const clearSessionCache = async () => {
    try {
      console.log('Cleaning up session cache...');
      const rows = snapshotRowsRef.current;

      // Delete all snapshot files
      for (const row of rows) {
        for (const item of row.items) {
          try {
            // Remove 'file://' prefix if present
            const filePath = item.imageUri.startsWith('file://')
              ? item.imageUri.substring(7)
              : item.imageUri;

            if (await RNFS.exists(filePath)) {
              await RNFS.unlink(filePath);
            }
          } catch (err) {
            console.warn('Failed to delete file:', item.imageUri, err);
          }
        }
      }

      // Clean ImageResizer cache
      // await ImageResizer.clean(); // Not supported in v1.4.5
      console.log('Session cache cleared');
    } catch (error) {
      console.error('Error clearing session cache:', error);
    }
  };

  const cleanupResources = useCallback(() => {
    isIntentionalCloseRef.current = true;
    isStreamingRef.current = false;
    setIsStreamingState(false);
    setIsConnected(false);
    setIsConnecting(false);
    setDetections([]);

    // Clear cache
    clearSessionCache();

    // Clear state
    setSnapshotRows([]);
    capturedTrackIdsRef.current.clear();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /**
   * Resize ảnh về kích thước chuẩn STANDARD_WIDTH x STANDARD_HEIGHT
   */
  const resizeImageToStandard = async (photoPath: string): Promise<string> => {
    try {
      const resized = await ImageResizer.createResizedImage(
        photoPath,
        STANDARD_WIDTH,
        STANDARD_HEIGHT,
        'JPEG',
        COMPRESSION_QUALITY * 60,
        0,
        undefined,
        false,
        { mode: 'cover' } // Cover để đảm bảo kích thước chính xác
      );
      return resized.path;
    } catch (error) {
      console.error('Error resizing image:', error);
      return photoPath;
    }
  };

  /**
   * Gửi frame qua WebSocket - ảnh đã được resize về STANDARD_WIDTH x STANDARD_HEIGHT
   */
  const sendFrame = async () => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !cameraRef.current ||
      !isStreamingRef.current ||
      isWaitingResponseRef.current
    ) return;

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });

      // Resize về kích thước chuẩn
      const resizedPath = await resizeImageToStandard(photo.path);

      // Read file as base64
      const base64 = await RNFS.readFile(resizedPath, 'base64');

      if (base64 && wsRef.current?.readyState === WebSocket.OPEN) {
        isWaitingResponseRef.current = true;
        const buffer = Buffer.from(base64, 'base64');
        wsRef.current.send(buffer.buffer);
        //  console.log(`Frame sent: ${STANDARD_WIDTH}x${STANDARD_HEIGHT}`);
      }

      // Cleanup resized file nếu khác với original
      if (resizedPath !== photo.path) {
        RNFS.unlink(resizedPath).catch(() => { });
      }
      if (photo.path) {
        RNFS.unlink(photo.path).catch(() => { });
      }
    } catch (error) {
      console.error('Error capturing frame:', error);
      isWaitingResponseRef.current = false;
    }
  };

  /**
   * Tạo snapshot - ảnh cũng được resize về STANDARD_WIDTH x STANDARD_HEIGHT
   * Vẽ bounding box lên ảnh
   */
  const createSnapshotItem = async (
    detection: DetectionBox,
  ): Promise<SnapshotItem | null> => {
    if (isCapturingSnapshotRef.current) {
      console.log('⛔ Snapshot đang bận, bỏ qua');
      return null;
    }
    try {

      if (!cameraRef.current) return null;
      isCapturingSnapshotRef.current = true;

      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });


      // Resize về kích thước chuẩn
      const resizedPath = await resizeImageToStandard(photo.path);
      const resizedUri = `file://${resizedPath}`;

      // Process image to draw bounding box
      const finalUri = await new Promise<string>(resolve => {
        setSnapshotProcessing({
          imageUri: resizedUri,
          detection,
          resolve,
        });
      });

      return {
        id: Math.random().toString(36).substring(7),
        track_id: detection.track_id,
        breedLabel: detection.class,
        imageUri: finalUri,
        fullImageUri: finalUri,
        confidence: detection.confidence,
        detectionData: detection,
      };
    } catch (error) {
      console.error('Error creating snapshot:', error);
      return null;
    } finally {
      isCapturingSnapshotRef.current = false;
    }
  };

  const processAutoSnapshot = async (currentDetections: DetectionBox[]) => {
    if (isCapturingSnapshotRef.current) {
      console.log('⏳ Đang chụp snapshot → bỏ qua frame này');
      return;
    }
    const validDetections = currentDetections.filter(
      d => d.confidence > snapshotThresholdRef.current && d.track_id !== null,
    );

    const hasNewId = validDetections.some(
      d => !capturedTrackIdsRef.current.has(d.track_id),
    );


    if (hasNewId) {
      const rowItems: SnapshotItem[] = [];

      for (const d of validDetections) {
        if (!capturedTrackIdsRef.current.has(d.track_id)) {
          console.log('d2:', d);
          capturedTrackIdsRef.current.add(d.track_id);
          const item = await createSnapshotItem(d);
          console.log('item:', item);
          if (item) {
            rowItems.push(item);
            console.log('Chụp được');
          }
          else {
            console.log('Không chụp đc');
            capturedTrackIdsRef.current.delete(d.track_id);
          }
        }
      }

      if (rowItems.length > 0) {
        setSnapshotRows(prev =>
          [
            {
              rowId: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
              items: rowItems,
            },
            ...prev,
          ].slice(0, 10),
        );
      }
    }
  };

  const handleSaveSnapshot = async () => {
    if (!selectedSnapshot) return;

    try {
      setIsSaving(true);

      // Read file as base64
      // Remove 'file://' prefix if present for RNFS
      const filePath = selectedSnapshot.imageUri.startsWith('file://')
        ? selectedSnapshot.imageUri.substring(7)
        : selectedSnapshot.imageUri;

      const base64 = await RNFS.readFile(filePath, 'base64');

      const data = await apiClient.saveStreamPrediction({
        processed_media_base64: base64,
        detections: [{
          class: selectedSnapshot.breedLabel,
          confidence: selectedSnapshot.confidence,
          box: selectedSnapshot.detectionData.box,
          track_id: selectedSnapshot.track_id
        }],
        media_type: "image/jpeg"
      });

      Alert.alert('Thành công', 'Lưu thành công!');
      navigation.navigate('ResulteScreen', { id: data.id });

    } catch (error) {
      console.error('Error saving snapshot:', error);
      Alert.alert('Error', 'Failed to save snapshot');
    } finally {
      setIsSaving(false);
    }
  };

  const startCamera = async () => {
    if (isStreamingRef.current) return;
    setIsConnecting(true);
    isIntentionalCloseRef.current = false;

    try {
      const ws = await apiClient.connectStreamPrediction();
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        isStreamingRef.current = true;
        setIsStreamingState(true);
        requestAnimationFrame(sendFrame);
      };

      ws.onmessage = e => {
        // console.log('Message received from server');
        try {
          const data = JSON.parse(e.data);
          const dets = data.detections || (Array.isArray(data) ? data : []);
          setDetections([...dets]);
          console.log('dets:', dets);
          processAutoSnapshot(dets);
        } catch (err) {
          console.error('Parse error:', err);
        } finally {
          isWaitingResponseRef.current = false;
          requestAnimationFrame(sendFrame);
        }
      };

      ws.onclose = event => {
        console.log(`WebSocket closed: ${event.code}`);
        if (isIntentionalCloseRef.current) return;
        if (event.code === 1000 || event.code === 1005) {
          cleanupResources();
          return;
        }
        Alert.alert('Connection Lost', `Error code: ${event.code}`);
        cleanupResources();
      };

      ws.onerror = err => {
        console.error('WebSocket error:', err);
        Alert.alert('Connection Error', 'Failed to connect to AI server');
        cleanupResources();
      };
    } catch (e) {
      Alert.alert('Error', 'Cannot initialize connection');
      cleanupResources();
    }
  };

  /**
   * Vẽ bounding boxes - scale từ STANDARD_WIDTH x STANDARD_HEIGHT lên camera view
   */
  const renderDetectionBoxes = () => {
    if (!cameraSize.width || !cameraSize.height) {
      console.log('Camera size not ready');
      return null;
    }

    if (!detections || detections.length === 0) {
      //  console.log('No detections');
      return null;
    }

    // Tính scale factor từ kích thước chuẩn lên camera view
    const scaleX = cameraSize.width / STANDARD_WIDTH;
    const scaleY = cameraSize.height / STANDARD_HEIGHT;

    // console.log('Scale factors:', { scaleX, scaleY });
    // console.log('Standard size:', STANDARD_WIDTH, 'x', STANDARD_HEIGHT);
    // console.log('Camera size:', cameraSize.width, 'x', cameraSize.height);

    return (
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        width={cameraSize.width}
        height={cameraSize.height}
      >
        {detections.map((det, idx) => {
          if (!det.box || det.box.length !== 4) {
            //   console.log('Invalid box:', det.box);
            return null;
          }

          // Tọa độ từ server theo STANDARD_WIDTH x STANDARD_HEIGHT
          const [x1, y1, x2, y2] = det.box;

          // Scale lên camera view
          const x = x1 * scaleX;
          const y = y1 * scaleY;
          const width = (x2 - x1) * scaleX;
          const height = (y2 - y1) * scaleY;

          //   console.log(`Box ${idx} (scaled):`, { x, y, width, height });

          const isConfident = det.confidence > 0.8;
          const color = isConfident ? '#22c55e' : '#eab308';

          return (
            <React.Fragment key={det.track_id ?? idx}>
              <Rect
                x={x}
                y={y}
                width={width}
                height={height}
                stroke={color}
                strokeWidth={3}
                fill="transparent"
              />
              <Rect
                x={x}
                y={Math.max(0, y - 25)}
                width={Math.min(width, 150)}
                height={25}
                fill={color}
                opacity={0.9}
              />
              <SvgText
                x={x + 5}
                y={Math.max(15, y - 8)}
                fill="#fff"
                fontSize="14"
                fontWeight="bold"
              >
                {det.class} {Math.round(det.confidence * 100)}%
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  const TipsContent = () => (
    <View style={styles.tipsContainer}>
      <View style={styles.tipRow}>
        <Icon name="zap" size={16} color="#3b82f6" />
        <Text style={styles.tipText}>
          Tất cả ảnh được chuẩn hóa về {STANDARD_WIDTH}x{STANDARD_HEIGHT}
        </Text>
      </View>
      <View style={styles.tipRow}>
        <Icon name="video" size={16} color="#3b82f6" />
        <Text style={styles.tipText}>
          Giữ camera ổn định để kết quả tốt nhất
        </Text>
      </View>
      <View style={styles.tipRow}>
        <Icon name="target" size={16} color="#3b82f6" />
        <Text style={styles.tipText}>
          Đảm bảo đối tượng trong khung hình rõ ràng
        </Text>
      </View>
      <View style={styles.tipRow}>
        <Icon name="camera" size={16} color="#3b82f6" />
        <Text style={styles.tipText}>
          Nhấn vào khung phát hiện để xem chi tiết
        </Text>
      </View>
    </View>
  );

  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Icon name="camera-off" size={64} color="#999" />
        <Text style={styles.noPermissionText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Realtime AI</Text>
          <View style={styles.statusRow}>
            <Icon
              name="wifi"
              size={12}
              color={isConnected ? '#22c55e' : '#eab308'}
            />
            <Text
              style={[
                styles.statusText,
                { color: isConnected ? '#22c55e' : '#eab308' },
              ]}
            >
              {isConnected ? 'Connected' : 'Ready'} | {STANDARD_WIDTH}x{STANDARD_HEIGHT}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.button, isStreamingState && styles.buttonStop]}
          onPress={isStreamingState ? cleanupResources : startCamera}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {isStreamingState ? 'Stop Stream' : 'Start Camera'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tipsAccordion}>
        <TouchableOpacity
          style={styles.tipsHeader}
          onPress={() => setIsTipsOpen(!isTipsOpen)}
          activeOpacity={0.7}
        >
          <View style={styles.tipsHeaderLeft}>
            <Icon name="lightbulb" size={16} color="#eab308" />
            <Text style={styles.tipsHeaderText}>Tips & Hướng dẫn</Text>
          </View>
          <Icon
            name={isTipsOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#666"
          />
        </TouchableOpacity>
        {isTipsOpen && <TipsContent />}
      </View>

      <View
        style={styles.cameraContainer}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          //     console.log('Camera container layout:', { width, height });
          setCameraSize({ width, height });
        }}
      >
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
        />

        {isStreamingState && renderDetectionBoxes()}

        {!isStreamingState && !isConnecting && (
          <View style={styles.overlay}>
            <Icon name="camera" size={64} color="#666" />
            <Text style={styles.overlayText}>Tap "Start Camera" to detect</Text>
          </View>
        )}

        {isConnecting && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.overlayText}>Connecting...</Text>
          </View>
        )}
      </View>

      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarHeaderLeft}>
            <Icon name="clock" size={14} color="#3b82f6" />
            <Text style={styles.sidebarHeaderText}>
              Captured ({snapshotRows.length})
            </Text>
          </View>
          {snapshotRows.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSnapshotRows([]);
                capturedTrackIdsRef.current.clear();
              }}
            >
              <Icon name="trash-2" size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.snapshotList}
          showsVerticalScrollIndicator={false}
        >
          {snapshotRows.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="info" size={32} color="#ccc" />
              <Text style={styles.emptyText}>Waiting for detections...</Text>
            </View>
          )}
          {snapshotRows.map(row => (
            <View key={row.rowId} style={styles.snapshotRow}>
              <View style={styles.snapshotRowHeader}>
                <Text style={styles.snapshotTime}>
                  {new Date(row.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={styles.snapshotCount}>{row.items.length} obj</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {row.items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.snapshotItem}
                    onPress={() => setSelectedSnapshot(item)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: item.imageUri }}
                      style={styles.snapshotImage}
                    />
                    <Text style={styles.snapshotLabel} numberOfLines={1}>
                      {item.breedLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      </View>

      <Modal
        visible={!!selectedSnapshot}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSnapshot(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedSnapshot(null)}
            >
              <Icon name="x" size={24} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSave}
              onPress={handleSaveSnapshot}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="save" size={24} color="#fff" />
              )}
            </TouchableOpacity>

            {selectedSnapshot && (
              <>
                <Image
                  source={{ uri: selectedSnapshot.fullImageUri }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <Text style={styles.modalLabel}>
                  {selectedSnapshot.breedLabel}
                </Text>
                <Text style={styles.modalConfidence}>
                  Confidence: {Math.round(selectedSnapshot.confidence * 100)}%
                </Text>
                <Text style={styles.modalInfo}>
                  Image: {STANDARD_WIDTH}x{STANDARD_HEIGHT}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Hidden View for Snapshot Processing */}
      {snapshotProcessing && (
        <View
          style={{
            position: 'absolute',
            left: -10000,
            top: 0,
            width: STANDARD_WIDTH,
            height: STANDARD_HEIGHT,
          }}
        >
          <View
            ref={snapshotViewRef}
            collapsable={false}
            style={{
              width: STANDARD_WIDTH,
              height: STANDARD_HEIGHT,
              backgroundColor: 'black',
            }}
          >
            <Svg
              style={StyleSheet.absoluteFill}
              width={STANDARD_WIDTH}
              height={STANDARD_HEIGHT}
            >
              <Defs>
                <Filter id="brightness">
                  <FeColorMatrix
                    type="matrix"
                    values="1 0 0 0 0.2
                            0 1 0 0 0.2
                            0 0 1 0 0.2
                            0 0 0 1 0"
                  />
                </Filter>
              </Defs>
              <SvgImage
                x="0"
                y="0"
                width={STANDARD_WIDTH}
                height={STANDARD_HEIGHT}
                href={{ uri: snapshotProcessing.imageUri }}
                preserveAspectRatio="xMidYMid slice"
                filter="url(#brightness)"
              />
              {(() => {
                const det = snapshotProcessing.detection;
                const [x1, y1, x2, y2] = det.box;
                const width = x2 - x1;
                const height = y2 - y1;
                const color = det.confidence > 0.8 ? '#22c55e' : '#eab308';

                return (
                  <>
                    <Rect
                      x={x1}
                      y={y1}
                      width={width}
                      height={height}
                      stroke={color}
                      strokeWidth={3}
                      fill="transparent"
                    />
                    <Rect
                      x={x1}
                      y={Math.max(0, y1 - 25)}
                      width={Math.min(width, 150)}
                      height={25}
                      fill={color}
                      opacity={0.9}
                    />
                    <SvgText
                      x={x1 + 5}
                      y={Math.max(15, y1 - 8)}
                      fill="#fff"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {det.class} {Math.round(det.confidence * 100)}%
                    </SvgText>
                  </>
                );
              })()}
            </Svg>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 8,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
  },
  noPermissionText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonStop: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tipsAccordion: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  tipsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipsHeaderText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#000',
    marginLeft: 8,
  },
  tipsContainer: {
    padding: 12,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 300,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlayText: {
    color: '#999',
    marginTop: 16,
    fontSize: 14,
  },
  sidebar: {
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  sidebarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sidebarHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  snapshotList: {
    flex: 1,
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
  snapshotRow: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  snapshotRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  snapshotTime: {
    fontSize: 10,
    color: '#666',
  },
  snapshotCount: {
    fontSize: 10,
    color: '#3b82f6',
    fontWeight: '600',
  },
  snapshotItem: {
    marginRight: 8,
    width: 64,
  },
  snapshotImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  snapshotLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  modalSave: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 16,
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginTop: 24,
  },
  modalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#000',
  },
  modalConfidence: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  modalInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});