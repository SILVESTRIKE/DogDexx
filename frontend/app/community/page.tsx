"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Share2, Calendar, Filter, AlertTriangle, CheckCircle2, Cpu, MapPin } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CommunityHeader } from "@/components/community-header";

// Helper timeAgo - i18n version
const useTimeAgo = () => {
    const { t, locale } = useI18n();
    return (date: string | Date) => {
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + (locale === 'vi' ? " năm trước" : " years ago");
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + (locale === 'vi' ? " tháng trước" : " months ago");
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + (locale === 'vi' ? " ngày trước" : " days ago");
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + (locale === 'vi' ? " giờ trước" : " hours ago");
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + (locale === 'vi' ? " phút trước" : " minutes ago");
        return locale === 'vi' ? "Vừa xong" : "Just now";
    };
};

// Types giữ nguyên
interface Post {
    _id: string;
    type: "LOST" | "FOUND";
    title: string;
    content: string;
    photos: string[];
    location?: {
        address: string;
    };
    ai_metadata: {
        breed: string;
        confidence: number;
    };
    contact_info: {
        name: string;
        phone: string;
    };
    createdAt: string;
    status: string;
    author: {
        username: string;
        avatarUrl?: string;
    };
    views?: number;
    shares?: number;
}

export default function LostFoundPage() {
    const { isAuthenticated } = useAuth();
    const { t, locale } = useI18n();
    const timeAgo = useTimeAgo();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [activeTab, setActiveTab] = useState<"all" | "lost" | "found">("all");
    const [breedFilter, setBreedFilter] = useState("");
    const [sortByDistance, setSortByDistance] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [ref, inView] = useInView();

    const fetchPosts = useCallback(async (isFresh = false) => {
        try {
            const currentPage = isFresh ? 1 : page;
            const typeFilter = activeTab === "all" ? undefined : (activeTab.toUpperCase() as "LOST" | "FOUND");

            // @ts-ignore
            const response = await apiClient.getCommunityPosts({
                page: currentPage,
                limit: 10,
                type: typeFilter,
                breed: breedFilter || undefined,
                lat: sortByDistance && userLocation ? userLocation.lat : undefined,
                lng: sortByDistance && userLocation ? userLocation.lng : undefined,
                radius: sortByDistance && userLocation ? 50 : undefined,
            });

            if (isFresh) {
                setPosts(response.data);
            } else {
                setPosts(prev => [...prev, ...response.data]);
            }

            setHasMore(response.data.length === 10);
            if (!isFresh) setPage(p => p + 1);
            else setPage(2);

        } catch (error) {
            console.error("Failed to fetch posts:", error);
        } finally {
            setLoading(false);
        }
    }, [activeTab, page, breedFilter, sortByDistance, userLocation]);

    useEffect(() => {
        setLoading(true);
        fetchPosts(true);
    }, [activeTab, breedFilter, sortByDistance, userLocation]);

    useEffect(() => {
        if (inView && hasMore && !loading) {
            fetchPosts(false);
        }
    }, [inView, hasMore, loading, fetchPosts]);

    return (
        <div className="min-h-screen relative selection:bg-primary/20">

            <CommunityHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                breedFilter={breedFilter}
                onBreedFilterChange={setBreedFilter}
                sortByDistance={sortByDistance}
                onSortByDistanceChange={() => {
                    if (sortByDistance) {
                        setSortByDistance(false);
                        setUserLocation(null);
                    } else {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    setUserLocation({
                                        lat: position.coords.latitude,
                                        lng: position.coords.longitude
                                    });
                                    setSortByDistance(true);
                                },
                                (error) => alert(t("community.header.location.permissionError"))
                            );
                        } else {
                            alert(t("community.header.location.unsupportedError"));
                        }
                    }
                }}
                userLocation={userLocation}
                setUserLocation={setUserLocation}
            />
            <div className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
                {/* POSTS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {posts.map((post, index) => (
                        <motion.div
                            key={post._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                            <PostCard post={post} timeAgo={timeAgo} />
                        </motion.div>
                    ))}
                </div>

                {/* LOADING / EMPTY STATES */}
                <div ref={ref} className="py-12 flex flex-col items-center justify-center">
                    {loading && (
                        <div className="flex items-center gap-2 text-primary font-medium">
                            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                            {t("lostFound.loading") || "Đang tải thêm tin..."}
                        </div>
                    )}

                    {!loading && !hasMore && posts.length > 0 && (
                        <div className="text-muted-foreground text-sm flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
                            <CheckCircle2 className="h-4 w-4" /> {t("lostFound.noMore") || "Bạn đã xem hết tin"}
                        </div>
                    )}

                    {!loading && posts.length === 0 && (
                        <div className="text-center py-12 px-6 rounded-3xl bg-muted/20 border border-dashed border-muted-foreground/20 max-w-md mx-auto">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                <Filter className="h-8 w-8 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">{t("lostFound.noResults") || "Không tìm thấy kết quả"}</h3>
                            <p className="text-muted-foreground text-sm mb-4">
                                {t("lostFound.noResultsHint") || "Chưa có tin đăng nào phù hợp với bộ lọc hiện tại. Hãy thử thay đổi từ khóa hoặc bộ lọc."}
                            </p>
                            <Button variant="outline" onClick={() => { setBreedFilter(""); setActiveTab("all"); setSortByDistance(false); }}>
                                {t("lostFound.clearFilters") || "Xóa bộ lọc"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- REDESIGNED POST CARD ---
function PostCard({ post, timeAgo }: { post: Post; timeAgo: (date: string | Date) => string }) {
    const { t } = useI18n();
    const isLost = post.type === "LOST";

    return (
        <Card className="group overflow-hidden border-0 shadow-lg bg-card hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 rounded-2xl h-full flex flex-col ring-1 ring-border/50">
            {/* Image Section (Top Half) */}
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {post.photos && post.photos.length > 0 ? (
                    <img
                        src={post.photos[0]}
                        alt={post.title}
                        className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                        <span className="text-muted-foreground text-xs">{t("community.noImage")}</span>
                    </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                {/* Floating Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                    <Badge variant={isLost ? "destructive" : "default"} className={cn(
                        "shadow-lg backdrop-blur-sm border-0 px-2.5 py-1",
                        !isLost && "bg-green-600 hover:bg-green-700"
                    )}>
                        {isLost ? <AlertTriangle className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {isLost ? t("community.lostStatus") : t("community.foundStatus")}
                    </Badge>
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">
                        <Cpu className="h-3 w-3" /> AI Identify
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="font-bold text-lg leading-tight truncate pr-2">{post.ai_metadata.breed}</span>
                        <span className="text-xs bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-white/90">
                            {(post.ai_metadata.confidence * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <CardContent className="p-4 flex-1 flex flex-col gap-3">
                {/* Author & Time */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Avatar className="h-5 w-5 border border-border">
                        <AvatarImage src={post.author?.avatarUrl} />
                        <AvatarFallback className="text-[9px]">U</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{post.contact_info.name}</span>
                    <span>•</span>
                    <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {timeAgo(post.createdAt)}
                    </span>
                </div>

                {/* Title & Desc */}
                <div className="space-y-1">
                    <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
                        {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.content}
                    </p>
                </div>

                {/* Location Badge */}
                <div className="mt-auto pt-2">
                    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-lg max-w-full">
                        <MapPin className="h-3 w-3 shrink-0 text-red-500" />
                        <span className="truncate">{post.location?.address || t("community.unknownLocation")}</span>
                    </div>
                </div>
            </CardContent>

            {/* Footer Actions */}
            <CardFooter className="p-3 bg-muted/10 border-t border-border/50 grid grid-cols-2 gap-2">
                <Link href={`/community/${post._id}`} className="w-full">
                    <Button variant="ghost" size="sm" className="w-full h-9 hover:bg-primary/10 hover:text-primary">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        {t("community.details")}
                    </Button>
                </Link>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-9 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                    onClick={() => {
                        if (navigator.share) {
                            navigator.share({
                                title: post.title,
                                text: post.content,
                                url: window.location.href + "/" + post._id
                            }).catch(console.error);
                        } else {
                            navigator.clipboard.writeText(window.location.href + "/" + post._id);
                            alert(t("community.linkCopied"));
                        }
                    }}
                >
                    <Share2 className="h-4 w-4 mr-2" />
                    {t("lostFound.share") || "Chia sẻ"}
                </Button>
            </CardFooter>
        </Card>
    );
}
