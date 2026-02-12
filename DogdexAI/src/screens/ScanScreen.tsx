import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../navigation/ScanStack';

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  type Camera as CameraType,
} from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import VideoPreview from '../components/VideoPreview';
type Props = NativeStackScreenProps<ScanStackParamList, 'ScanScreen'>;
const { width, height } = Dimensions.get('window');

type CameraMode = 'photo' | 'video';

export default function ScanScreen({ navigation }: Props) {
  const [cameraMode, setCameraMode] = useState<CameraMode>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>(
    'back',
  );
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const camera = useRef<Camera>(null);
  // const camera = useRef<CameraType>(null);
  const isFocused = useIsFocused();

  const device = useCameraDevice(cameraPosition);
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } },
    { fps: 30 },
  ]);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const cameraPermission = await Camera.getCameraPermissionStatus();
    const microphonePermission = await Camera.getMicrophonePermissionStatus();

    if (cameraPermission !== 'granted') {
      const newCameraPermission = await Camera.requestCameraPermission();
      setHasCameraPermission(newCameraPermission === 'granted');
    } else {
      setHasCameraPermission(true);
    }

    if (microphonePermission !== 'granted') {
      const newMicrophonePermission =
        await Camera.requestMicrophonePermission();
      setHasMicrophonePermission(newMicrophonePermission === 'granted');
    } else {
      setHasMicrophonePermission(true);
    }
  };

  const takePhoto = async () => {
    if (camera.current) {
      try {
        const photo = await camera.current.takePhoto({
          flash: flash,
          enableShutterSound: true,
        });
        setCapturedPhoto(`file://${photo.path}`);
        console.log('Photo captured:', photo);
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Lỗi', 'Không thể chụp ảnh');
      }
    }
  };

  const startRecording = async () => {
    if (camera.current) {
      try {
        setIsRecording(true);
        await camera.current.startRecording({
          flash: flash,
          onRecordingFinished: video => {
            console.log('Video recorded:', video);

            setIsRecording(false);
            setRecordedVideo(video.path);
          },
          onRecordingError: error => {
            console.error('Recording error:', error);
            setIsRecording(false);
            Alert.alert('Lỗi', 'Không thể quay video');
          },
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = async () => {
    if (camera.current) {
      try {
        await camera.current.stopRecording();
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  const toggleCamera = () => {
    setCameraPosition(prev => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(prev => (prev === 'off' ? 'on' : 'off'));
  };

  const toggleCameraMode = () => {
    setCameraMode(prev => (prev === 'photo' ? 'video' : 'photo'));
  };

  const selectFromGallery = () => {
    const mediaType = cameraMode === 'photo' ? 'photo' : 'video';

    launchImageLibrary(
      {
        mediaType: mediaType,
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
      },
      response => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorMessage) {
          Alert.alert('Lỗi', 'Không thể chọn ảnh/video');
        } else if (response.assets && response.assets.length > 0) {
          const uri = response.assets[0].uri;
          if (uri) {
            if (cameraMode === 'photo') {
              setCapturedPhoto(uri);
            }
            console.log('Selected media:', uri);
          }
        }
      },
    );
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  if (!hasCameraPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Cần cấp quyền truy cập camera để sử dụng tính năng này
        </Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera không khả dụng</Text>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.previewButton} onPress={retakePhoto}>
            <Icon name="camera-alt" size={24} color="white" />
            <Text style={styles.previewButtonText}>Chụp lại</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => setCapturedPhoto(null)}
          >
            <Icon name="check" size={24} color="white" />
            <Text style={styles.previewButtonText}>Xong</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  if (recordedVideo) {
    return (
      <VideoPreview
        videoUri={recordedVideo}
        onRetake={() => setRecordedVideo(null)}
        onFinish={() => {
          setRecordedVideo(null);
          // Có thể thêm xử lý khi hoàn thành: upload, lưu, etc.
        }}
      />
    );
  }
  return (
    <View style={styles.container}>
      {device && isFocused && (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={isFocused}
          photo={true}
          video={true}
          audio={hasMicrophonePermission}
          //orientation="portrait"
        />
      )}

      {/* Overlay controls */}
      <View style={styles.overlay}>
        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
            <Icon
              name={flash === 'on' ? 'flash-on' : 'flash-off'}
              size={28}
              color="white"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={toggleCamera}>
            <Icon name="flip-camera-ios" size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {/* Gallery button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={selectFromGallery}
          >
            <Icon name="photo-library" size={28} color="white" />
          </TouchableOpacity>

          {/* Capture button */}
          <View style={styles.captureContainer}>
            {cameraMode === 'photo' ? (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordingButton,
                ]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <View style={styles.recordButtonInner} />
              </TouchableOpacity>
            )}
          </View>

          {/* Toggle mode button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleCameraMode}
          >
            <Text style={styles.modeText}>
              {cameraMode === 'photo' ? 'ẢNH' : 'VIDEO'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recordingButton: {
    backgroundColor: 'red',
  },
  recordButtonInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'red',
  },
  modeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  permissionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  previewButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
