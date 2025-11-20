import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,

} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/api-client';
import { useI18n } from '../../lib/i18n-context';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requiredCount: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface AchievementsData {
  stats: {
    totalAchievements: number;
    totalBreeds: number;
    unlockedAchievements: number;
    totalCollected: number;
  };
  nextAchievement: {
    name: string;
    requirement: number;
    progress: number;
  } | null;
  achievements: Achievement[];
}

export default function AchievementsScreen() {
    const { t, locale } = useI18n()
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      // Replace with your actual API call
       const response = await apiClient.getAchievements(locale);
      setData(response);
      
    
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
      setError('Could not load achievements. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const sortedAchievements = useMemo(() => {
    if (!data?.achievements) return [];
    return [...data.achievements].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      return a.requiredCount - b.requiredCount;
    });
  }, [data?.achievements]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FFA500" />
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const { stats, nextAchievement, achievements } = data;
  const completionPercentage = stats.totalBreeds > 0 
    ? Math.round((stats.totalCollected / stats.totalBreeds) * 100) 
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <MaterialCommunityIcons name="trophy" size={36} color="#FFA500" />
            <Text style={styles.title}>{t('achievements.title')}</Text>
          </View>
          <Text style={styles.subtitle}>{t('achievements.pageDescription')}</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCard1]}>
            <Text style={styles.statLabel}>{t('achievements.dogsCollected')}</Text>
            <Text style={styles.statValue}>
              {stats.totalCollected}/{stats.totalBreeds}
            </Text>
          </View>

          <View style={[styles.statCard, styles.statCard2]}>
            <Text style={styles.statLabel}>{t('achievements.achievementsUnlocked')}</Text>
            <Text style={styles.statValue}>
              {stats.unlockedAchievements}/{stats.totalAchievements}
            </Text>
          </View>

          <View style={[styles.statCard, styles.statCard3]}>
            <Text style={styles.statLabel}>{t('profile.stats.completion')}</Text>
            <Text style={styles.statValue}>{completionPercentage}%</Text>
          </View>
        </View>

        {/* Next Achievement */}
        {nextAchievement && (
          <View style={styles.nextAchievementContainer}>
            <View style={styles.nextAchievementHeader}>
              <MaterialCommunityIcons name="trophy" size={20} color="#FFA500" />
              <Text style={styles.nextAchievementTitle}>{t('achievements.nextAchievement')}</Text>
            </View>
            <Text style={styles.nextAchievementName}>{nextAchievement.name}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>{t('achievements.progress')}</Text>
                <Text style={styles.progressCount}>
                  {nextAchievement.progress}/{nextAchievement.requirement}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(nextAchievement.progress / nextAchievement.requirement) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* All Achievements */}
        <View style={styles.allAchievementsContainer}>
          <View style={styles.allAchievementsHeader}>
            <MaterialCommunityIcons name="trophy" size={24} color="#FFA500" />
            <Text style={styles.allAchievementsTitle}> {t('achievements.allAchievements')}</Text>
          </View>

          <View>
            {sortedAchievements.map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  achievement.unlocked
                    ? styles.achievementCardUnlocked
                    : styles.achievementCardLocked,
                ]}
              >
                <View style={styles.achievementIconContainer}>
                  <Text
                    style={[
                      styles.achievementIcon,
                      !achievement.unlocked && styles.achievementIconLocked,
                    ]}
                  >
                    {achievement.icon}
                  </Text>
                  <View
                    style={[
                      styles.achievementBadge,
                      achievement.unlocked
                        ? styles.badgeUnlocked
                        : styles.badgeLocked,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={achievement.unlocked ? 'check-circle' : 'lock'}
                      size={16}
                      color={achievement.unlocked ? '#FFA500' : '#666'}
                    />
                  </View>
                </View>

                <View style={styles.achievementContent}>
                  <View style={styles.achievementTitleRow}>
                    <Text style={styles.achievementTitle}>{achievement.title}</Text>
                    {achievement.unlocked && (
                      <View style={styles.unlockedBadge}>
                        <Text style={styles.unlockedBadgeText}>Unlocked</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.achievementDescription}>
                    {achievement.description}
                  </Text>
                  <View style={styles.achievementFooter}>
                    <MaterialCommunityIcons name="trophy" size={14} color="#FFA500" />
                    <Text style={styles.achievementRequirement}>
                      {achievement.unlocked
                        ? 'Completed'
                        : `Collect ${achievement.requiredCount}`}
                    </Text>
                  </View>
                  {achievement.unlocked && achievement.unlockedAt && (
                    <Text style={styles.unlockedDate}>
                      Unlocked: {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statsContainer: {
    paddingHorizontal: 12,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    borderRadius: 8,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCard1: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
    borderWidth: 2,
  },
  statCard2: {
    backgroundColor: '#7C2D12',
    borderColor: '#EA580C',
    borderWidth: 2,
  },
  statCard3: {
    backgroundColor: '#1E40AF',
    borderColor: '#1D4ED8',
    borderWidth: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#D1D5DB',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nextAchievementContainer: {
    marginHorizontal: 12,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  nextAchievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  nextAchievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nextAchievementName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  progressContainer: {
    gap: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  progressCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  allAchievementsContainer: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  allAchievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  allAchievementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  achievementCard: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 2,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  achievementCardUnlocked: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FBBF24',
  },
  achievementCardLocked: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
    opacity: 0.6,
  },
  achievementIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 40,
  },
  achievementIconLocked: {
    opacity: 0.4,
  },
  achievementBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeUnlocked: {
    backgroundColor: '#FCD34D',
  },
  badgeLocked: {
    backgroundColor: '#D1D5DB',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  unlockedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  unlockedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  achievementDescription: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 8,
  },
  achievementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  achievementRequirement: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  unlockedDate: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 6,
  },
  spacer: {
    height: 24,
  },
});
