'use client';

import type React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme } from '../styles/theme';
import { useI18n } from '../lib/i18n-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface PokedexHeaderProps {
  collectionStats: { collectedBreeds: number } | null;
  totalCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterBy: string;
  onFilterChange: (value: string) => void;
  groups: string[];
  onAchievement: () => void;
}

const PokedexHeader: React.FC<PokedexHeaderProps> = ({
  collectionStats,
  totalCount,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filterBy,
  onFilterChange,
  groups,
  onAchievement
}) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const sortOptions = [
    { label: 'Tên (A-Z)', value: 'name-asc' },
    { label: 'Tên (Z-A)', value: 'name-desc' },
    { label: 'Độ hiếm (Cao)', value: 'rarity_level-desc' },
    { label: 'Độ hiếm (Thấp)', value: 'rarity_level-asc' },
    ...(filterBy === 'collected'
      ? [
        { label: 'Collected (New)', value: 'collectedAt-desc' },
        { label: 'Collected (Old)', value: 'collectedAt-asc' },
      ]
      : []),
  ];

  const filterOptions = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Đã sưu tầm', value: 'collected' },
    { label: 'Chưa sưu tầm', value: 'uncollected' },
    ...groups.map(group => ({ label: group, value: group })),
  ];

  const currentSort = sortOptions.find(opt => opt.value === sortBy);
  const currentFilter = filterOptions.find(opt => opt.value === filterBy);

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {isExpanded && (
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statsBadge}>
                <Text style={styles.statsText}>
                  {t('dogdex.collected')}{' '}
                  {collectionStats?.collectedBreeds ?? 0}/{totalCount}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.achievementButton}
              onPress={onAchievement}
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={16}
                color="#2563eb"
              />
              <Text style={styles.buttonText}>{t('nav.achievements')}</Text>
            </TouchableOpacity>

            <View style={styles.searchContainer}>
              <Icon name="magnify" size={20} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('dogdex.searchPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={onSearchChange}
              />
            </View>

            <View style={styles.controlsContainer}>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowSortMenu(!showSortMenu)}
              >
                <Icon
                  name="arrow-up-down"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.filterButtonText}>
                  {currentSort?.label || 'Sort'}
                </Text>
              </TouchableOpacity>

              {showSortMenu && (
                <View style={styles.dropdownMenu}>
                  {sortOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.menuItem,
                        sortBy === option.value && styles.activeMenuItem,
                      ]}
                      onPress={() => {
                        onSortChange(option.value);
                        setShowSortMenu(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.menuItemText,
                          sortBy === option.value && styles.activeMenuItemText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterMenu(!showFilterMenu)}
              >
                <Icon name="filter" size={16} color={theme.colors.primary} />
                <Text style={styles.filterButtonText}>
                  {currentFilter?.label || 'Filter'}
                </Text>
              </TouchableOpacity>

              {showFilterMenu && (
                <View style={[styles.dropdownMenu, { minWidth: 180 }]}>
                  {filterOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.menuItem,
                        filterBy === option.value && styles.activeMenuItem,
                      ]}
                      onPress={() => {
                        onFilterChange(option.value);
                        setShowFilterMenu(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.menuItemText,
                          filterBy === option.value &&
                          styles.activeMenuItemText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Icon
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({

  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 100,
  },
  headerContent: {
    gap: 16,
  },
  statsContainer: {
    marginBottom: 4,
  },
  statsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3F2FF',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: -0.2,
  },
  achievementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1E7FF',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: -0.2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    paddingVertical: 12,
    fontWeight: '500',
  },
  controlsContainer: {
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
    zIndex: 200,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    minWidth: 160,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  activeMenuItem: {
    backgroundColor: '#F0F7FF',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  activeMenuItemText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  toggleButton: {
    alignSelf: 'center',
    marginTop: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default PokedexHeader;
