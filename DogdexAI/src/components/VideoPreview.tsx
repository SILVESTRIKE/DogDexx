// src/components/VideoPreview.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

interface VideoPreviewProps {
  videoUri: string;
  onRetake: () => void;
  onFinish: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ 
  videoUri, 
  onRetake, 
  onFinish 
}) => {
  //const videoRef = useRef<Video>(null);
  const videoRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRetake = () => {
    if (videoRef.current) {
      videoRef.current.seek(0);
    }
    setIsPlaying(false);
    onRetake();
  };

  const handleFinish = () => {
    if (videoRef.current) {
      videoRef.current.seek(0);
    }
    setIsPlaying(false);
    onFinish();
  };

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <Video
        ref={videoRef}
        source={{ uri: videoUri }}
        style={styles.video}
        paused={!isPlaying}
        resizeMode="cover"
        repeat={true}
        onLoad={(data) => setVideoDuration(data.duration)}
        onProgress={(data) => setCurrentTime(data.currentTime)}
      />
      
      {/* Overlay controls */}
      <View style={styles.overlay}>
        
        {/* Top controls - Play/Pause */}
        <View style={styles.topControls}>
          <TouchableOpacity 
            style={styles.playButton} 
            onPress={togglePlayPause}
          >
            <Icon 
              name={isPlaying ? "pause" : "play-arrow"} 
              size={36} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        {/* Bottom controls - Action buttons */}
        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.previewButton} onPress={handleRetake}>
            <Icon name="videocam" size={24} color="white" />
            <Text style={styles.previewButtonText}>Quay lại</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.previewButton} onPress={handleFinish}>
            <Icon name="check" size={24} color="white" />
            <Text style={styles.previewButtonText}>Xong</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(currentTime / videoDuration) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  topControls: {
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewControls: {
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
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  timeText: {
    color: 'white',
    fontSize: 12,
  },
});

export default VideoPreview;