'use client';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../navigation/ScanStack';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,

  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
// import { Progress } from "react-native-progress"
import * as Progress from 'react-native-progress';
import { useAuth } from '../lib/auth-context';
import { useAnalytics } from '../lib/analytics-context';
import { useI18n } from '../lib/i18n-context';
import { apiClient } from '../lib/api-client';
type Props = NativeStackScreenProps<ScanStackParamList, 'HomeScreen'>;
const HomeScreen = ({ navigation }: Props) => {
  const { user, isAuthenticated, refetchUser } = useAuth();
  const { trackVisit } = useAnalytics();
  const { t } = useI18n();

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    //trackVisit('home');
  }, []);

  const handleSelectFromLibrary = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: false,
      },
      response => {
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setSelectedFile(asset);
          setFileType('image');
        }
      },
    );
  };

  const handleSelectVideo = () => {
    launchImageLibrary(
      {
        mediaType: 'video',
        includeBase64: false,
      },
      response => {
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setSelectedFile(asset);
          setFileType('video');
        }
      },
    );
  };

  const handleTakePhoto = () => {
    launchCamera(
      {
        mediaType: 'photo',
        includeBase64: false,
      },
      response => {
        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setSelectedFile(asset);
          setFileType('image');
        }
      },
    );
  };

  const handleDetect = async () => {
    if (!selectedFile) return;

    setIsDetecting(true);
    setUploadProgress(0);
    setIsProcessing(false);

    try {
      let response;
      // const file = new File([selectedFile.uri], selectedFile.fileName || 'image.jpg', {
      //   type: selectedFile.type,
      //   lastModified: Date.now()
      // });
      console.log(selectedFile.uri, selectedFile.fileName);
      const formData = new FormData();

      formData.append('file', {
        uri: selectedFile.uri, // bắt buộc: đường dẫn local (file://...)
        type: selectedFile.type || 'image/jpeg',
        name: selectedFile.fileName || 'image.jpg',
      });

      const onProgress = (progress: number) => {
        setUploadProgress(progress);
        if (progress === 100) {
          setIsProcessing(true);
        }
      };
      console.log('Starting upload for prediction',formData);

      if (fileType === 'image') {
        response = await apiClient.predictImage(formData, onProgress);
      } else if (fileType === 'video') {
        console.log('Uploading video for prediction');
        response = await apiClient.predictVideo(formData, onProgress);
        console.log('Video prediction response received:', response);
      }


      if (isAuthenticated) {
        await refetchUser();
      }
   //   console.log('Prediction response:', response);

      navigation.navigate('ResulteScreen', { id: response.predictionId });
    } catch (error: any) {
      Alert.alert(
        t('home.detectionFailed'),
        error.message || 'An error occurred',
      );
    } finally {
      setIsDetecting(false);
      setUploadProgress(0);
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setFileType(null);
    setUploadProgress(0);
    setIsProcessing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
          <Text style={styles.heroDescription}>
            {t('home.heroDescription')}
          </Text>
        </View>

        {/* Upload Section */}
        <View style={styles.uploadCard}>
          {!selectedFile ? (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadTitle}>{t('home.dragDropTitle')}</Text>
              <Text style={styles.uploadDescription}>
                {t('home.dragDropDescription')}
              </Text>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleSelectFromLibrary}
                >
                  <Text style={styles.buttonText}>{t('home.selectImage')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleSelectVideo}
                >
                  <Text style={styles.buttonText}>{t('home.selectVideo')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleTakePhoto}
                >
                  <Text style={styles.buttonText}>Take Photo</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.supportedFormats}>
                {t('home.supportedFormats')}
              </Text>
            </View>
          ) : (
            <View style={styles.previewSection}>
              {/* Preview */}
              {fileType === 'image' && selectedFile.uri && (
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={styles.preview}
                  resizeMode="contain"
                />
              )}

              {fileType === 'video' && selectedFile.uri && (
                <View style={styles.videoPlaceholder}>
                  <Text style={styles.videoText}>Video Selected</Text>
                  <Text style={styles.videoFileName}>
                    {selectedFile.fileName || 'video.mp4'}
                  </Text>
                </View>
              )}

              {/* File Info */}
              <View style={styles.fileInfo}>
                <View>
                  <Text style={styles.fileName}>
                    {selectedFile.fileName || 'File'}
                  </Text>
                  <Text style={styles.fileSize}>
                    {(selectedFile.fileSize / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
                <TouchableOpacity onPress={resetUpload} disabled={isDetecting}>
                  <Text style={styles.selectAnother}>
                    {t('home.selectAnother')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.detectButton,
                  isDetecting && styles.detectButtonDisabled,
                ]}
                onPress={handleDetect}
                disabled={isDetecting}
              >
                {isDetecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.detectButtonText}>
                    {t('home.detectButton')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Progress */}
              {isDetecting && (
                <View style={styles.progressSection}>
                  <Progress.Bar
                    progress={isProcessing ? 1 : uploadProgress / 100}
                    width={null}
                    height={4}
                    color="#3b82f6"
                  />
                  <Text style={styles.progressText}>
                    {isProcessing
                      ? t('home.processingFile')
                      : `${t('home.uploading')} ${Math.round(uploadProgress)}%`}
                  </Text>
                </View>
              )}

              {!user && (
                <Text style={styles.loginPrompt}>{t('home.loginToSave')}</Text>
              )}
            </View>
          )}
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>{t('home.feature1Title')}</Text>
            <Text style={styles.featureDescription}>
              {t('home.feature1Description')}
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>{t('home.feature2Title')}</Text>
            <Text style={styles.featureDescription}>
              {t('home.feature2Description')}
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>{t('home.feature3Title')}</Text>
            <Text style={styles.featureDescription}>
              {t('home.feature3Description')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    padding: 16,
  },
  heroSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  uploadCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#e5e5e5',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  supportedFormats: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  previewSection: {
    width: '100%',
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  videoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoFileName: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 4,
  },
  fileInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  selectAnother: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
  },
  detectButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  detectButtonDisabled: {
    opacity: 0.6,
  },
  detectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  loginPrompt: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  featuresSection: {
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
  },
});

export default HomeScreen;
