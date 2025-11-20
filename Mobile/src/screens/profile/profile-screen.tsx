'use client';

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../lib/auth-context';
import { useCollection } from '../../lib/collection-context';
import { useI18n } from '../../lib/i18n-context';
import { ProfileStackParamList } from '../../navigation/ProfileStack';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
interface Stats {
  collectedBreeds: number;
  unlockedAchievements: number;
  totalBreeds: number;
  totalCollected: number;
}
type ProfileScreenProps = NativeStackScreenProps<
  ProfileStackParamList,
  'ProfileScreen'
>;
export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, setUser, logout } = useAuth();
  const [stats, setStats] = useState<Stats>({
    collectedBreeds: 0,
    unlockedAchievements: 0,
    totalBreeds: 100,
    totalCollected: 0,
  });
  const { t } = useI18n();
  const { collectionStats, achievementStats } = useCollection();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newAvatar, setNewAvatar] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      }));
    }
  }, [user]);

  const loadStats = async () => {
    try {
      setStats({
        collectedBreeds: 45,
        unlockedAchievements: 12,
        totalBreeds: 100,
        totalCollected: 45,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load stats');
    }
  };

  const handleAvatarPicker = () => {
    const options = {
      mediaType: 'photo' as const,
      includeBase64: false,
      maxHeight: 200,
      maxWidth: 200,
    };

    launchImageLibrary(options, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Failed to pick image');
      } else if (response.assets && response.assets[0].uri) {
        setNewAvatar(response.assets[0].uri);
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const formDataToSend = new FormData();

      if (user?.username !== formData.username) {
        formDataToSend.append('username', formData.username);
      }
      if (user?.firstName !== formData.firstName) {
        formDataToSend.append('firstName', formData.firstName);
      }
      if (user?.lastName !== formData.lastName) {
        formDataToSend.append('lastName', formData.lastName);
      }

      // const response = await fetch('YOUR_API/user/profile', {
      //   method: 'PATCH',
      //   body: formDataToSend,
      // });

      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
      setNewAvatar(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: () => {
          logout();
        },
        style: 'destructive',
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const completionPercentage =
    stats.totalBreeds > 0
      ? Math.round((stats.totalCollected / stats.totalBreeds) * 100)
      : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <Text style={styles.subtitle}>{t('profile.description')}</Text>
      </View>

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          onPress={handleAvatarPicker}
          disabled={!isEditing}
          style={styles.avatarContainer}
        >
          <Image
            source={{ uri: newAvatar || user.avatarUrl }}
            style={styles.avatar}
          />
          {isEditing && (
            <View style={styles.cameraOverlay}>
              <Icon name="camera" size={32} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.fullName}>
            {user.firstName} {user.lastName}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Icon name="paw" size={24} color="#000" />
          </View>
          <Text style={styles.statValue}>
            {collectionStats?.collectedBreeds ?? 0}
          </Text>
          <Text style={styles.statLabel}>{t('profile.stats.collected')}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Icon name="trophy" size={24} color="#d4af37" />
          </View>
          <Text style={styles.statValue}>
            {achievementStats?.unlockedAchievements ?? 0}
          </Text>
          <Text style={styles.statLabel}>
            {t('profile.stats.achievements')}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Icon name="checkmark-circle" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.statValue}>{completionPercentage}%</Text>
          <Text style={styles.statLabel}>{t('profile.stats.completion')}</Text>
        </View>
      </View>

      {/* Account Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('profile.account.description')}
          </Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={styles.editButton}>
                {t('profile.account.editButton')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput
            style={[styles.input, !isEditing && styles.inputDisabled]}
            value={formData.username}
            onChangeText={text => setFormData({ ...formData, username: text })}
            editable={isEditing}
            placeholder="Username"
          />
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>{t('auth.firstName')}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.firstName}
              onChangeText={text =>
                setFormData({ ...formData, firstName: text })
              }
              editable={isEditing}
              placeholder="First Name"
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>{t('auth.lastName')}</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={formData.lastName}
              onChangeText={text =>
                setFormData({ ...formData, lastName: text })
              }
              editable={isEditing}
              placeholder="Last Name"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{t('profile.account.email')}</Text>
          <TextInput
            style={[styles.input, !isEditing && styles.inputDisabled]}
            value={formData.email}
            onChangeText={text => setFormData({ ...formData, email: text })}
            editable={isEditing}
            placeholder="Email"
            keyboardType="email-address"
          />
        </View>

        {/* Password Section */}
        {isEditing && (
          <View style={styles.passwordSection}>
            <Text style={styles.passwordTitle}>Change Password</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={formData.currentPassword}
                onChangeText={text =>
                  setFormData({ ...formData, currentPassword: text })
                }
                placeholder="Current Password"
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={formData.newPassword}
                onChangeText={text =>
                  setFormData({ ...formData, newPassword: text })
                }
                placeholder="New Password"
                secureTextEntry
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={formData.confirmPassword}
                onChangeText={text =>
                  setFormData({ ...formData, confirmPassword: text })
                }
                placeholder="Confirm Password"
                secureTextEntry
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {isEditing && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsEditing(false);
                setFormData({
                  username: user?.username || '',
                  email: user?.email || '',
                  firstName: user?.firstName || '',
                  lastName: user?.lastName || '',
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
                setNewAvatar(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout Section */}
      <View style={styles.section}>
        {user.username !== 'Guest' ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutButtonText}>{t('nav.logout')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.authButtonGroup}>
            <TouchableOpacity
              style={[styles.authButton, { backgroundColor: '#000' }]}
              onPress={() => navigation.navigate('LoginScreen')}
            >
              <Text style={styles.authButtonText}>{t('nav.login')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.authButton, { backgroundColor: '#007AFF' }]}
              onPress={() => navigation.navigate('RegisterScreen')}
            >
              <Text style={styles.authButtonText}>{t('nav.register')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  authButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  authButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  avatarSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  fullName: {
    fontSize: 13,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  passwordSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    marginBottom: 16,
  },
  passwordTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonGroup: {
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 32,
  },
});
