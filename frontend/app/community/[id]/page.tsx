"use client";

import { useEffect, useState, use } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DogRadar } from "@/components/DogRadar";
import { VerifyFoundModal } from "@/components/VerifyFoundModal";
import { Loader2, Calendar, MapPin, Share2, AlertTriangle, CheckCircle, ImageIcon, Info, ShieldCheck, Cpu, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion"; // Thêm animation

// Interface giữ nguyên
interface CommunityPost {
    id: string;
    _id?: string;
    type: "LOST" | "FOUND";
    author_id?: string;
    title: string;
    content: string;
    photos: string[];
    location?: {
        coordinates: [number, number];
        address?: string;
    };
    ai_metadata: {
        breed: string;
        breed_slug: string;
        confidence: number;
        verificationType?: 'camera' | 'qr';
    };
    contact_info: {
        name: string;
        phone: string;
        email?: string;
    };
    createdAt: string;
    status: string;
    dog_id?: string | { _id: string; name: string };
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { t } = useI18n();
    const router = useRouter();
    const [post, setPost] = useState<CommunityPost | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPost() {
            try {
                // @ts-ignore
                const data = await apiClient.getCommunityPost(id);
                setPost(data);
            } catch (error) {
                console.error(error);
                toast.error(t("community.loadFailed"));
            } finally {
                setLoading(false);
            }
        }
        fetchPost();
    }, [id, t]);

    // Loading State đẹp hơn
    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Cpu className="h-6 w-6 text-primary/50" />
                    </div>
                </div>
                <p className="text-muted-foreground animate-pulse font-medium">{t("community.analyzing")}</p>
            </div>
        </div>
    );

    if (!post) return (
        <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground gap-4 bg-background">
            <Info className="h-12 w-12 opacity-20" />
            <p>{t("community.postNotFound")}</p>
            <Button variant="link" onClick={() => router.back()}>{t("community.back")}</Button>
        </div>
    );

    const isLost = post.type === "LOST";
    const dogName = typeof post.dog_id === 'object' ? post.dog_id.name : "Dog";
    const dogId = typeof post.dog_id === 'object' ? post.dog_id._id : post.dog_id || "";

    // Theme Config
    const bgTheme = isLost ? "bg-red-50 dark:bg-red-950/10" : "bg-green-50 dark:bg-green-950/10";
    const borderTheme = isLost ? "border-red-200 dark:border-red-900/50" : "border-green-200 dark:border-green-900/50";
    const iconTheme = isLost ? "text-red-600" : "text-green-600";

    return (
        <div className="min-h-screen relative selection:bg-primary/20">
            <div className="container mx-auto px-4 py-2 md:py-2 max-w-6xl relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
                    {/* --- LEFT COLUMN: IMAGES (5 cols) --- */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="lg:col-span-5 space-y-2 lg:sticky lg:top-24 h-fit"
                    >
                        {/* Main Image Card */}
                        <div className="relative rounded-[2rem] overflow-hidden shadow-2xl bg-muted border border-border group aspect-[4/5] lg:aspect-[1/1]">
                            {post.photos && post.photos.length > 0 && post.photos[0] ? (
                                <img
                                    src={post.photos[0]}
                                    alt="Dog"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 text-muted-foreground backdrop-blur-sm">
                                    <ImageIcon className="h-20 w-20 mb-4 opacity-20" />
                                    <span className="font-medium">{t("community.noImage")}</span>
                                </div>
                            )}

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />

                            {/* Floating Badge */}
                            <div className="absolute top-4 left-4">
                                <Badge variant={isLost ? "destructive" : "default"} className={cn(
                                    "text-sm font-bold px-3 py-1 shadow-lg uppercase tracking-wide backdrop-blur-md",
                                    !isLost && "bg-green-600 hover:bg-green-700"
                                )}>
                                    {post.type === "LOST" ? t("community.lostStatus") : t("community.foundStatus")}
                                </Badge>
                            </div>

                            {/* Info Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                                <div className="flex items-end justify-between">
                                    <div>
                                        <h3 className="text-3xl font-bold leading-none mb-2 tracking-tight">{post.ai_metadata.breed}</h3>
                                        <div className="flex items-center gap-2 text-sm text-white/90">
                                            {post.ai_metadata.verificationType === 'qr' ? (
                                                <span className="flex items-center gap-1.5 text-green-400 font-medium bg-green-950/30 px-2 py-1 rounded-lg border border-green-500/30">
                                                    <ShieldCheck className="h-4 w-4" /> QR Verified
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary" style={{ width: `${post.ai_metadata.confidence * 100}%` }}></div>
                                                    </div>
                                                    <span className="font-mono">{(post.ai_metadata.confidence * 100).toFixed(0)}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 p-0">
                            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                                <CardContent className="py-0 flex flex-col items-center justify-center text-center">
                                    <span className="text-muted-foreground text-md uppercase font-bold tracking-wider mb-1">{t("community.breed")}</span>
                                    <span className="font-bold text-primary">{post.ai_metadata.breed}</span>
                                </CardContent>
                            </Card>
                            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                                <CardContent className="py-0 flex flex-col items-center justify-center text-center">
                                    <span className="text-muted-foreground text-md uppercase font-bold tracking-wider mb-1">{t("community.status")}</span>
                                    <Badge variant="outline" className={cn("mt-0.5", isLost ? "text-red-600 border-red-200" : "text-green-600 border-green-200")}>
                                        {post.status}
                                    </Badge>
                                </CardContent>
                            </Card>
                        </div>
                        {isLost && post.status === "OPEN" && dogId && (
                            <VerifyFoundModal
                                dogId={dogId}
                                dogName={dogName}
                                targetBreed={post.ai_metadata.breed}
                                targetBreedSlug={post.ai_metadata.breed_slug}
                                onSuccess={() => {
                                    toast.success(t("community.verifySuccess"));
                                    router.refresh();
                                }}
                            />
                        )}
                    </motion.div>

                    {/* --- RIGHT COLUMN: INFO & ACTIONS (7 cols) --- */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="lg:col-span-7 space-y-2"
                    >
                        {/* Header & Title */}
                        <div>
                            <div className="flex items-start justify-between gap-4">
                                <h1 className="text-xl md:text-3xl font-extrabold tracking-tight text-foreground leading-tight text-balance">
                                    {post.title}
                                </h1>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-full shrink-0 h-10 w-10 border-border/60 hover:bg-secondary"
                                    onClick={() => {
                                        if (navigator.share) {
                                            navigator.share({
                                                title: t("community.shareTitle", { title: post.title }),
                                                text: t("community.shareTextPrefix", { breed: post.ai_metadata.breed }),
                                                url: window.location.href
                                            });
                                        } else {
                                            toast.info(t("community.linkCopied"));
                                            navigator.clipboard.writeText(window.location.href);
                                        }
                                    }}
                                >
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                                <Calendar className="h-4 w-4" />
                                <span>{t("community.datePosted")} {new Date(post.createdAt).toLocaleDateString()}</span>
                                <span className="text-border">|</span>
                                <MapPin className="h-4 w-4" />
                                <span>{post.location?.address || t("community.unknownLocation")}</span>
                            </div>
                        </div>
                        <div className={cn("p-5 rounded-2xl border flex items-start gap-4", bgTheme, borderTheme)}>
                            <div className={cn("p-2 rounded-full bg-white/50 dark:bg-black/10 shrink-0", iconTheme)}>
                                {isLost ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
                            </div>
                            <div>
                                <h4 className={cn("font-bold text-base", iconTheme)}>
                                    {isLost ? t("community.urgentAlert") : t("community.goodNews")}
                                </h4>
                                <p className={cn("text-sm mt-1 opacity-90 leading-relaxed", isLost ? "text-red-900/80 dark:text-red-200/80" : "text-green-900/80 dark:text-green-200/80")}>
                                    {isLost
                                        ? t("community.lostMessage")
                                        : t("community.foundMessage")}
                                </p>
                            </div>
                        </div>
                        {/* Rescue Radar (Updated Container) */}
                        {isLost && post.location && (
                            <Card className="border-border/60 shadow-lg rounded-2xl overflow-hidden bg-card/40 backdrop-blur-sm">
                                <CardHeader className="bg-secondary/30 pb-4 border-b border-border/40">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-2">
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-red-500" /> {t("community.searchArea")}
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                {t("community.searchAreaDesc")}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="animate-pulse bg-red-50/50 text-red-600 border-red-200/50">
                                            {t("community.liveRadar")}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 h-[320px] relative">
                                    {/* Sử dụng component Minimal Variant */}
                                    <DogRadar
                                        center={[post.location.coordinates[1], post.location.coordinates[0]]}
                                        radius={5}
                                        breed={post.ai_metadata.breed}
                                        sourceType="LOST"
                                        variant="minimal"
                                        excludePostId={post.id || post._id}
                                    />
                                </CardContent>
                            </Card>
                        )}
                        <Separator className="bg-border/50" />

                        {/* Description */}
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Info className="h-5 w-5 text-primary" /> {t("community.details")}
                            </h3>
                            <div className="prose prose-zinc dark:prose-invert max-w-none bg-secondary/20 p-6 rounded-2xl border border-border/50">
                                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{post.content}</p>
                            </div>
                        </div>

                    </motion.div>
                </div>
            </div >
        </div >
    );
}