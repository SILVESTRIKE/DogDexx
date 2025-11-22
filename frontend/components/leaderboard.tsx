"use client";

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { LeaderboardEntry } from '@/lib/types';
import { useI18n } from '@/lib/i18n-context';
import { Medal, MapPin, Search, Globe, Building2, User, Crown } from 'lucide-react';

// Hàm debounce giữ nguyên
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const Leaderboard = () => {
  const { t } = useI18n();
  const [scope, setScope] = useState<'global' | 'country' | 'city'>('global');
  const [filterValue, setFilterValue] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedFilter = useDebounce(filterValue, 500);

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
      setLeaderboard(res.data);
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

  // Helper xác định style cho từng thứ hạng
  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          rowBg: 'bg-yellow-500/10 hover:bg-yellow-500/20', // Nền Vàng nhạt
          iconColor: 'text-yellow-600',
          ringColor: 'ring-yellow-500',
          badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
      case 2:
        return {
          rowBg: 'bg-slate-400/10 hover:bg-slate-400/20', // Nền Bạc nhạt
          iconColor: 'text-slate-500',
          ringColor: 'ring-slate-400',
          badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
        };
      case 3:
        return {
          rowBg: 'bg-orange-600/10 hover:bg-orange-600/20', // Nền Đồng nhạt
          iconColor: 'text-orange-700',
          ringColor: 'ring-orange-600',
          badgeColor: 'bg-orange-100 text-orange-800 border-orange-200'
        };
      default:
        return {
          rowBg: 'hover:bg-muted/30', // Nền mặc định
          iconColor: 'text-muted-foreground',
          ringColor: 'ring-border',
          badgeColor: 'bg-primary/10 text-primary border-primary/20'
        };
    }
  };

  const renderRankIcon = (rank: number) => {
    const style = getRankStyle(rank);
    if (rank === 1) return <Medal className={`w-6 h-6 ${style.iconColor}`} />;
    if (rank === 2) return <Medal className={`w-6 h-6 ${style.iconColor}`} />;
    if (rank === 3) return <Medal className={`w-6 h-6 ${style.iconColor}`} />;
    return <span className="font-bold text-muted-foreground font-mono">#{rank}</span>;
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-8"> {/* Margin top bottom cân đối */}
      
      <div className="bg-card text-card-foreground rounded-xl shadow-sm overflow-hidden border border-border">
        {/* Header */}
        <div className="p-8 bg-primary text-primary-foreground text-center sm:text-left"> {/* Tăng padding lên p-8 */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{t('rankPage.headerTitle')}</h2>
              <p className="text-primary-foreground/80 mt-1 text-base">
                {t('rankPage.headerDescription')}
              </p>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-6 border-b border-border bg-card"> {/* Tăng padding lên p-6 */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Tabs */}
            <div className="flex bg-input p-1.5 rounded-xl w-full md:w-auto">
              {[
                { id: 'global', label: t('rankPage.scope.global'), icon: Globe },
                { id: 'country', label: t('rankPage.scope.country'), icon: MapPin },
                { id: 'city', label: t('rankPage.scope.city'), icon: Building2 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setScope(tab.id as any); setFilterValue(''); }}
                  className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    scope === tab.id 
                      ? 'bg-background shadow-sm text-primary ring-1 ring-black/5' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <tab.icon size={16} /> 
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            {scope !== 'global' && (
              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  placeholder={scope === 'country' ? t('rankPage.search.country') : t('rankPage.search.city')}
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/70"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Content Table */}
        <div className="min-h-[500px] bg-card">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-80 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">{t('rankPage.loading')}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-80 text-destructive px-4 text-center">
              <p>{error}</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
              <div className="w-16 h-16 bg-input rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 opacity-40" />
              </div>
              <p className="font-medium">{t('rankPage.empty.title')}</p>
              {scope !== 'global' && !filterValue && (
                <p className="text-sm mt-1 opacity-70">{t('rankPage.empty.description')}</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-xs font-bold tracking-wider">
                  <tr className="border-b border-border">
                    <th className="px-8 py-5 w-24 text-center">{t('rankPage.table.rank')}</th>
                    <th className="px-6 py-5">{t('rankPage.table.collector')}</th>
                    <th className="px-6 py-5">{t('rankPage.table.region')}</th>
                    <th className="px-8 py-5 text-right">{t('rankPage.table.achievement')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {leaderboard.map((user) => {
                    const style = getRankStyle(user.rank);
                    return (
                      <tr 
                        key={user.userId} 
                        className={`transition-colors duration-200 ${style.rowBg}`}
                      >
                        <td className="px-8 py-5 text-center">
                          <div className="flex justify-center items-center scale-110">
                            {renderRankIcon(user.rank)}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            {/* Avatar có Ring màu theo hạng */}
                            <div className={`relative w-12 h-12 rounded-full p-0.5 ${user.rank <= 3 ? style.ringColor + ' ring-2' : 'border border-border'}`}>
                              <div className="w-full h-full rounded-full overflow-hidden bg-input">
                                {user.avatarUrl ? (
                                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold text-lg bg-background">
                                    {user.displayName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              {/* Badge nhỏ góc dưới avatar cho top 3 */}
                              {user.rank <= 3 && (
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                  <Medal size={12} className={style.iconColor} />
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <div className="font-semibold text-foreground text-base">{user.displayName}</div>
                              <div className="text-xs text-muted-foreground font-medium">@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm text-muted-foreground flex flex-col gap-1">
                            {user.city && (
                              <span className="flex items-center gap-1.5">
                                <Building2 size={14} className="opacity-70"/> {user.city}
                              </span>
                            )}
                            {user.country && (
                              <span className="flex items-center gap-1.5">
                                <MapPin size={14} className="opacity-70"/> {user.country}
                              </span>
                            )}
                            {!user.city && !user.country && (
                              <span className="text-muted-foreground/50 italic text-xs">{t('rankPage.unupdated')}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border shadow-sm ${style.badgeColor}`}>
                            {user.totalCollected} 🐕
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;