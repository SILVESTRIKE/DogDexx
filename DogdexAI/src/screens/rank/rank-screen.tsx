import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Image,
    TextInput,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { MapPin, Search, Globe, Building2, Trophy, Crown, User } from 'lucide-react-native';
import { useI18n } from '../../lib/i18n-context';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

const { width } = Dimensions.get('window');

// --- Custom Debounce Hook ---
function useDebounce(value: any, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// --- User Avatar Component ---
const UserAvatar = ({ src, alt, name }: { src: string; alt: string; name: string }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [src]);

    if (src && !hasError) {
        return (
            <Image
                source={{ uri: src }}
                style={styles.avatarImage}
                onError={() => setHasError(true)}
            />
        );
    }

    return (
        <View style={styles.avatarFallback}>
            {name ? (
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            ) : (
                <User size={16} color="#888" />
            )}
        </View>
    );
};

// --- Tab Button Component ---
const TabButton = ({ label, isActive, onPress, icon: Icon }: { label: string; isActive: boolean; onPress: () => void; icon: any }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[
            styles.tabButton,
            isActive && styles.tabButtonActive,
        ]}
    >
        <Icon size={16} color={isActive ? '#3b82f6' : '#999'} />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

// --- Rank Badge Component ---
const RankBadge = ({ rank, style }: { rank: number; style: any }) => {
    if (rank <= 3) {
        return (
            <Crown
                size={24}
                color={style.iconColor}
                fill={style.iconColor}
            />
        );
    }
    return <Text style={styles.rankNumber}>#{rank}</Text>;
};

// --- Main Leaderboard Screen ---
export default function LeaderboardScreen() {
    // const { user } = useAuth();
    const { t } = useI18n();
    const [scope, setScope] = useState('global');
    const [filterValue, setFilterValue] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const debouncedFilter = useDebounce(filterValue, 500);

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1:
                return {
                    rowBg: '#FEF3C7',
                    iconColor: '#FBBF24',
                    badgeBg: '#FCD34D',
                    badgeText: '#78350F',
                };
            case 2:
                return {
                    rowBg: '#E2E8F0',
                    iconColor: '#CBD5E1',
                    badgeBg: '#CBD5E1',
                    badgeText: '#0F172A',
                };
            case 3:
                return {
                    rowBg: '#FEDBA8',
                    iconColor: '#F97316',
                    badgeBg: '#FB923C',
                    badgeText: '#7C2D12',
                };
            default:
                return {
                    rowBg: '#F5F5F5',
                    iconColor: '#999',
                    badgeBg: '#E5E5E5',
                    badgeText: '#333',
                };
        }
    };

    const fetchLeaderboard = async () => {
        if ((scope === 'country' || scope === 'city') && !debouncedFilter) return;

        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.getLeaderboard({
                type: scope,
                value: scope === 'global' ? undefined : debouncedFilter,
                limit: 50,
            });
            const filteredData = res.data.filter(
                (user: any) => user.role !== 'admin' && user.role !== 'dev'
            );
            setLeaderboard(filteredData);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('rankPage.error'));
            setLeaderboard([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, [scope, debouncedFilter]);

    const renderLeaderboardRow = ({ item: user }: { item: any }) => {
        const style = getRankStyle(user.rank);
        return (
            <View style={[styles.tableRow, { backgroundColor: style.rowBg }]}>
                {/* Rank */}
                <View style={styles.rankCell}>
                    <RankBadge rank={user.rank} style={style} />
                </View>

                {/* User Info */}
                <View style={styles.userCell}>
                    <View style={styles.userInfoContainer}>
                        <View style={[styles.avatarContainer, { borderColor: style.iconColor }]}>
                            <UserAvatar
                                src={user.avatarUrl}
                                alt={user.username}
                                name={user.displayName}
                            />
                        </View>
                        <View style={styles.userDetails}>
                            <Text style={styles.displayName}>{user.displayName}</Text>
                            <Text style={styles.username}>@{user.username}</Text>
                            <View style={styles.locationMobile}>
                                <MapPin size={10} color="#888" />
                                <Text style={styles.locationText}>
                                    {user.city || user.country || t('rankPage.unupdated')}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Region (Desktop-like) */}
                <View style={styles.regionCell}>
                    <View>
                        {user.city && (
                            <View style={styles.locationRow}>
                                <Building2 size={12} color="#888" />
                                <Text style={styles.locationValue}>{user.city}</Text>
                            </View>
                        )}
                        {user.country && (
                            <View style={styles.locationRow}>
                                <MapPin size={12} color="#888" />
                                <Text style={styles.locationValue}>{user.country}</Text>
                            </View>
                        )}
                        {!user.city && !user.country && (
                            <Text style={styles.locationUnupdated}>
                                {t('rankPage.unupdated')}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Achievement Badge */}
                <View style={styles.badgeCell}>
                    <View
                        style={[
                            styles.badge,
                            { backgroundColor: style.badgeBg },
                        ]}
                    >
                        <Text style={[styles.badgeText, { color: style.badgeText }]}>
                            {user.totalCollected}
                        </Text>
                        <Text style={[styles.badgeUnit, { color: style.badgeText }]}>
                            DOGS
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{t('rankPage.headerTitle')}</Text>
                <Text style={styles.description}>
                    {t('rankPage.headerDescription')}
                </Text>
            </View>

            {/* Controls */}
            <View style={styles.controlsContainer}>
                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TabButton
                        label={t('rankPage.scope.global')}
                        isActive={scope === 'global'}
                        onPress={() => {
                            setScope('global');
                            setFilterValue('');
                        }}
                        icon={Globe}
                    />
                    <TabButton
                        label={t('rankPage.scope.country')}
                        isActive={scope === 'country'}
                        onPress={() => {
                            setScope('country');
                            setFilterValue('');
                        }}
                        icon={MapPin}
                    />
                    <TabButton
                        label={t('rankPage.scope.city')}
                        isActive={scope === 'city'}
                        onPress={() => {
                            setScope('city');
                            setFilterValue('');
                        }}
                        icon={Building2}
                    />
                </View>

                {/* Search Input */}
                {scope !== 'global' && (
                    <View style={styles.searchContainer}>
                        <Search size={16} color="#888" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={
                                scope === 'country'
                                    ? t('rankPage.search.country')
                                    : t('rankPage.search.city')
                            }
                            value={filterValue}
                            onChangeText={setFilterValue}
                            placeholderTextColor="#888"
                        />
                    </View>
                )}
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text style={styles.loadingText}>{t('rankPage.loading')}</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : leaderboard.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Trophy size={40} color="#ccc" />
                        <Text style={styles.emptyTitle}>{t('rankPage.empty.title')}</Text>
                        {scope !== 'global' && !filterValue && (
                            <Text style={styles.emptyDescription}>
                                {t('rankPage.empty.description')}
                            </Text>
                        )}
                    </View>
                ) : (
                    <FlatList
                        data={leaderboard}
                        renderItem={renderLeaderboardRow}
                        keyExtractor={(item) => item.userId}
                        scrollEnabled={false}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                )}
            </View>
        </ScrollView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
        color: '#3b82f6',
    },
    description: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        maxWidth: width - 40,
    },
    controlsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        padding: 6,
        gap: 6,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        gap: 4,
    },
    tabButtonActive: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
    },
    tabLabelActive: {
        color: '#3b82f6',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
        color: '#333',
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: '#999',
    },
    errorContainer: {
        minHeight: 300,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    errorText: {
        fontSize: 14,
        color: '#dc2626',
        textAlign: 'center',
        backgroundColor: '#fee2e2',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    emptyContainer: {
        minHeight: 300,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    emptyDescription: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        maxWidth: width - 60,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    rankCell: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    userCell: {
        flex: 1,
        marginLeft: 8,
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#666',
    },
    userDetails: {
        flex: 1,
    },
    displayName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
    },
    username: {
        fontSize: 11,
        color: '#999',
        marginTop: 2,
    },
    locationMobile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    locationText: {
        fontSize: 10,
        color: '#888',
    },
    regionCell: {
        width: width * 0.2,
        marginHorizontal: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    locationValue: {
        fontSize: 12,
        color: '#666',
    },
    locationUnupdated: {
        fontSize: 11,
        color: '#ccc',
        fontStyle: 'italic',
    },
    badgeCell: {
        marginLeft: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    badgeUnit: {
        fontSize: 9,
        fontWeight: '400',
    },
    separator: {
        height: 1,
        backgroundColor: '#f0f0f0',
    },
});