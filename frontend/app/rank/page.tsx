"use client";

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { LeaderboardEntry } from '@/lib/types';
import { useI18n } from '@/lib/i18n-context';
import { MapPin, Search, Globe, Building2, Trophy, Crown, User } from 'lucide-react';
import { cn } from "@/lib/utils";

import { LocationPicker } from '@/components/location-picker';

// --- Hooks ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- Component Avatar Mới: Tự động bắt lỗi ảnh ---
const UserAvatar = ({ src, alt, name }: { src?: string | null, alt: string, name: string }) => {
  const [hasError, setHasError] = useState(false);

  // Reset lỗi khi src thay đổi (ví dụ khi user filter danh sách)
  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Nếu có link ảnh VÀ chưa bị lỗi load -> Hiển thị ảnh
  if (src && !hasError) {
    return (
      <img 
        src={src} 
        alt={alt} 
        className="w-full h-full object-cover"
        onError={() => setHasError(true)} // Quan trọng: Nếu ảnh lỗi -> setHasError(true)
      />
    );
  }

  // Fallback: Hiển thị chữ cái đầu hoặc Icon User
  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground font-bold text-sm bg-gradient-to-br from-secondary to-background select-none">
      {name ? name.charAt(0).toUpperCase() : <User size={16} />}
    </div>
  );
};

// --- Main Page Component ---
export default function LeaderboardPage() {
  const { t } = useI18n();
  const [scope, setScope] = useState<'global' | 'country' | 'city'>('global');
  
  // Location state
  const [selectedCountryCode, setSelectedCountryCode] = useState("VN");
  const [selectedCountryName, setSelectedCountryName] = useState("Vietnam");
  const [selectedCityName, setSelectedCityName] = useState("");

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    let value = undefined;
    if (scope === 'country') {
        if (!selectedCountryName) {
            setLeaderboard([]);
            return;
        }
        value = selectedCountryName;
    } else if (scope === 'city') {
        if (!selectedCityName) {
            setLeaderboard([]);
            return;
        }
        value = selectedCityName;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getLeaderboard({
        type: scope,
        value: value,
        limit: 50,
      });
      // Lọc bỏ người dùng có vai trò 'admin' hoặc 'dev'
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
  }, [scope, selectedCountryName, selectedCityName]);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          rowBg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/5 border-l-4 border-yellow-500',
          iconColor: 'text-yellow-400',
          ringColor: 'ring-yellow-500',
          badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        };
      case 2:
        return {
          rowBg: 'bg-gradient-to-r from-slate-400/20 to-gray-400/5 border-l-4 border-slate-400',
          iconColor: 'text-slate-300',
          ringColor: 'ring-slate-400',
          badgeColor: 'bg-slate-400/20 text-slate-200 border-slate-400/30'
        };
      case 3:
        return {
          rowBg: 'bg-gradient-to-r from-orange-500/20 to-red-500/5 border-l-4 border-orange-500',
          iconColor: 'text-orange-400',
          ringColor: 'ring-orange-500',
          badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
        };
      default:
        return {
          rowBg: 'hover:bg-white/5 border-l-4 border-transparent',
          iconColor: 'text-muted-foreground',
          ringColor: 'ring-white/10',
          badgeColor: 'bg-secondary/50 text-secondary-foreground border-white/10'
        };
    }
  };

  const renderRankIcon = (rank: number) => {
    const style = getRankStyle(rank);
    if (rank <= 3) return <Crown className={`w-6 h-6 ${style.iconColor} fill-current`} />;
    return <span className="font-mono font-bold text-muted-foreground/70">#{rank}</span>;
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="container mx-auto px-4 py-8 md:py-12">
        
        {/* HERO HEADER */}
        <div className="text-center mb-10 md:mb-14 relative z-10">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight text-balance">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-ring">
              {t('rankPage.headerTitle')}
            </span>
          </h1>
          <p className="text-muted-foreground text-balance max-w-2xl mx-auto leading-relaxed">
            {t('rankPage.headerDescription')}
          </p>
        </div>

        {/* MAIN GLASS CONTAINER */}
        <div className="max-w-4xl mx-auto relative z-20">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-violet-600 rounded-[2rem] blur opacity-20 transition duration-500"></div>

          <div className="relative bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl md:rounded-[2rem] overflow-hidden">
            
            {/* Controls Bar */}
            <div className="p-6 border-b border-white/10 bg-white/5">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                
                {/* Custom Tabs */}
                <div className="flex bg-secondary/30 p-1.5 rounded-xl w-full md:w-auto backdrop-blur-md">
                  {[
                    { id: 'global', label: t('rankPage.scope.global'), icon: Globe },
                    { id: 'country', label: t('rankPage.scope.country'), icon: MapPin },
                    { id: 'city', label: t('rankPage.scope.city'), icon: Building2 },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { 
                        setScope(tab.id as any); 
                        // Reset selection when switching tabs if needed, or keep it?
                        // If switching from City to Country, maybe keep Country?
                        // For now, let's just keep the state as is, or reset if switching to Global.
                        if (tab.id === 'global') {
                            // No reset needed strictly as global ignores it, but good practice?
                        }
                      }}
                      className={cn(
                        "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                        scope === tab.id 
                          ? "bg-background shadow-lg text-primary ring-1 ring-black/5" 
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      <tab.icon size={15} /> 
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Location Picker */}
                {scope !== 'global' && (
                  <div className="w-full md:w-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    <LocationPicker
                      selectedCountryCode={selectedCountryCode}
                      onCountryChange={(code, name) => {
                        setSelectedCountryCode(code);
                        setSelectedCountryName(name);
                        setSelectedCityName("");
                      }}
                      selectedCityName={selectedCityName}
                      onCityChange={(name) => setSelectedCityName(name)}
                      showCity={scope === 'city'}
                      className={scope === 'country' ? "grid-cols-1 w-full md:w-64" : "grid-cols-2 w-full md:w-96"}
                      selectClassName="bg-secondary/30 border-white/10"
                      labels={{ country: undefined, city: undefined }} 
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content Table */}
            <div className="min-h-[400px]">
              {loading ? (
                <div className="flex flex-col justify-center items-center h-80 gap-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
                  </div>
                  <p className="text-sm text-muted-foreground animate-pulse">{t('rankPage.loading')}</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-80 text-destructive px-4 text-center">
                  <p className="bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">{error}</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
                  <div className="w-20 h-20 bg-secondary/30 rounded-full flex items-center justify-center mb-6 ring-4 ring-secondary/10">
                    <Trophy className="w-10 h-10 opacity-30" />
                  </div>
                  <p className="font-semibold text-lg">{t('rankPage.empty.title')}</p>
                  {scope !== 'global' && (
                    <p className="text-sm mt-2 opacity-60 max-w-xs text-center">{t('rankPage.empty.description')}</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] md:text-xs font-bold tracking-wider backdrop-blur-sm sticky top-0 z-10">
                      <tr>
                        <th className="px-4 md:px-8 py-4 text-center w-16 md:w-24">#</th>
                        <th className="px-4 md:px-6 py-4">{t('rankPage.table.collector')}</th>
                        <th className="px-4 md:px-6 py-4 hidden sm:table-cell">{t('rankPage.table.region')}</th>
                        <th className="px-4 md:px-8 py-4 text-right">{t('rankPage.table.achievement')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboard.map((user) => {
                        const style = getRankStyle(user.rank);
                        return (
                          <tr 
                            key={user.userId} 
                            className={`group transition-all duration-300 ${style.rowBg}`}
                          >
                            <td className="px-4 md:px-8 py-4 text-center">
                              <div className="flex justify-center items-center group-hover:scale-110 transition-transform">
                                {renderRankIcon(user.rank)}
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4">
                              <div className="flex items-center gap-3 md:gap-4">
                                
                                {/* AVATAR ĐÃ ĐƯỢC FIX Ở ĐÂY */}
                                <div className={`relative flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full p-0.5 ${user.rank <= 3 ? style.ringColor + ' ring-2' : 'ring-1 ring-white/10'}`}>
                                  <div className="w-full h-full rounded-full overflow-hidden bg-secondary">
                                    <UserAvatar 
                                      src={user.avatarUrl} 
                                      alt={user.username} 
                                      name={user.displayName} 
                                    />
                                  </div>
                                </div>
                                
                                <div className="min-w-0">
                                  <div className={`font-semibold text-sm md:text-base truncate ${user.rank <= 3 ? 'text-foreground' : 'text-foreground/90'}`}>
                                    {user.displayName}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate opacity-70">@{user.username}</div>
                                  <div className="flex sm:hidden items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                                    <MapPin size={10} />
                                    {user.city || user.country || t('rankPage.unupdated')}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-4 hidden sm:table-cell">
                              <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                {(user.city || user.country) ? (
                                  <>
                                    {user.city && (
                                      <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-default">
                                        <Building2 size={13} className="opacity-50"/> {user.city}
                                      </span>
                                    )}
                                    {user.country && (
                                      <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-default">
                                        <MapPin size={13} className="opacity-50"/> {user.country}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground/30 italic text-xs">{t('rankPage.unupdated')}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 md:px-8 py-4 text-right">
                              <span className={`inline-flex items-center px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-bold border shadow-sm backdrop-blur-md whitespace-nowrap ${style.badgeColor}`}>
                                {user.totalCollected} <span className="ml-1 text-[10px] md:text-xs font-normal opacity-80">DOGS</span>
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
      </div>
    </main>
  );
}
