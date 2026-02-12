import React, { useContext } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../navigation/ProfileStack';
import { useAuth } from '../lib/auth-context';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileScreen'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth(); // lấy user từ context
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header với thông tin user */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar} />
          <Text style={styles.username}>{user?.firstName}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1 / 371</Text>
            <Text style={styles.statLabel}>discovered breeds</Text>
          </View>
        </View>

        <View style={styles.treatsContainer}>
          <Text style={styles.treatsText}>100 treats</Text>
        </View>
      </View>

      {/* Thông báo đăng nhập */}
      <View style={styles.loginPrompt}>
        <Text style={styles.loginTitle}>
          Log in to share your images with the community and save your progress.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.signUpButton]}>
            <Text style={[styles.buttonText, styles.signUpButtonText]}>
              SIGN UP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.loginButton]}>
            <Text style={[styles.buttonText, styles.loginButtonText]}>
              LOG IN
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Phần bắt đầu posting */}
      <View style={styles.postingSection}>
        <Text style={styles.postingTitle}>
          Start by posting your first post on our social feed.
        </Text>

        <TouchableOpacity style={styles.startPostingButton}>
          <Text style={styles.startPostingText}>START POSTING</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
    marginBottom: 10,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  treatsContainer: {
    backgroundColor: '#ffeb3b',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  treatsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  loginPrompt: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  loginTitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  signUpButton: {
    backgroundColor: '#000',
  },
  loginButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  signUpButtonText: {
    color: '#fff',
  },
  loginButtonText: {
    color: '#000',
  },
  postingSection: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postingTitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  startPostingButton: {
    backgroundColor: '#000',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startPostingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  vietnameseSection: {
    padding: 20,
    alignItems: 'center',
  },
  vietnameseRow: {
    marginBottom: 8,
  },
  vietnameseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  vietnameseSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  vietnameseText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
