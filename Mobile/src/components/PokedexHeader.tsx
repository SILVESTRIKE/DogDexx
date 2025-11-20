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
    onAchievement:()=>void;
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
                    {t('pokedex.collected')}{' '}
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
                  placeholder={t('pokedex.searchPlaceholder')}
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
    achievementButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: '#2563eb',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: 'transparent',
      marginTop: 8,
    },
    buttonText: {
      color: '#2563eb',
      fontWeight: '500',
      fontSize: 14,
    },
    header: {
      backgroundColor: theme.colors.card,
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingTop: 8,
      position: 'relative',
    },
    headerContent: {
      paddingBottom: 12,
    },
    statsContainer: {
      marginBottom: 12,
    },
    statsBadge: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    statsText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontSize: 14,
      color: theme.colors.text,
    },
    controlsContainer: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderRadius: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      gap: 6,
      flex: 1,
      minWidth: 140,
    },
    filterButtonText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    dropdownMenu: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 6,
      marginTop: 4,
      maxHeight: 420,
      overflow: 'hidden',
      position: 'absolute',
      top: 50,
      right: 8,
      zIndex: 100,
    },
    menuItem: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    activeMenuItem: {
      backgroundColor: theme.colors.primary + '20',
    },
    menuItemText: {
      color: theme.colors.text,
      fontSize: 12,
    },
    activeMenuItemText: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    toggleButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
  });

  export default PokedexHeader;
