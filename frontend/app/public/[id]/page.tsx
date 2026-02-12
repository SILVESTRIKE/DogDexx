"use client";

import { useEffect, useState, use } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, MessageSquare, ShieldCheck, Calendar, Palette, User, Loader2, Mail, Home, Settings, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ReportFoundForm } from "@/components/ReportFoundForm";

interface PublicDogProfile {
    id: string;
    name: string;
    breed: string;
    gender: string;
    avatarPath: string;
    avatarUrl?: string;
    birthday?: string;
    attributes: {
        color?: string;
    };
    isLost: boolean;
    showSystemForm?: boolean;
    ownerName?: string;
    ownerEmail?: string;
    ownerAvatar?: string;
    owner_id?: string;
}

export default function PublicDogPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { t } = useI18n();
    const { user } = useAuth();
    const router = useRouter();
    const [dog, setDog] = useState<PublicDogProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Check if current user is the owner
    const isOwner = user && dog && (dog.owner_id === user.id || dog.ownerEmail === user.email);

    useEffect(() => {
        async function fetchDog() {
            try {
                const data = await apiClient.getPublicDog(id);
                setDog(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        fetchDog();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
            <Loader2 className="animate-spin h-10 w-10 text-primary" />
            <p className="text-muted-foreground text-sm font-medium">{t("common.loading") || "Loading Profile..."}</p>
        </div>
    );

    if (!dog) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
            <div className="bg-muted p-4 rounded-full"><ShieldCheck className="h-10 w-10 opacity-20" /></div>
            <p className="font-medium">{t("publicDog.dogNotFound")}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8">

            {/* OWNER VIEW BANNER */}
            {isOwner && (
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-2xl mb-6 relative z-10"
                >
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 rounded-xl shadow-lg flex items-center gap-4 border border-primary/50">
                        <div className="p-2 bg-white/20 rounded-full">
                            <Home className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold">{t("publicDog.thisIsYourDog") || "Đây là chó của bạn!"}</h2>
                            <p className="text-sm text-white/80">{t("publicDog.ownerViewDescription") || "Bạn đang xem trang công khai của bé."}</p>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/my-dogs/${dog.id}`)}
                            className="bg-white/20 hover:bg-white/30 text-white border-0"
                        >
                            <Settings className="h-4 w-4 mr-1" />
                            {t("common.manage") || "Quản lý"}
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* LOST ALERT BANNER - Only show if NOT owner */}
            {dog.isLost && !isOwner && (
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-2xl mb-6 relative z-10"
                >
                    <div className="bg-red-500 text-white p-4 rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-4 border border-red-400">
                        <div className="p-2 bg-white/20 rounded-full animate-pulse">
                            <AlertTriangle className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold uppercase tracking-wide">{t("publicDog.dogIsLost") || "MISSING DOG"}</h2>
                            <p className="text-sm text-red-100 font-medium">{t("publicDog.helpContactOwner") || "Please help contact the owner immediately!"}</p>
                        </div>
                    </div>
                </motion.div>
            )}

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-2xl"
            >
                <Card className="overflow-hidden border-0 shadow-2xl bg-card rounded-3xl ring-1 ring-border/50">
                    {/* Header Image */}
                    <div className="h-96 md:h-[450px] bg-muted relative group overflow-hidden">
                        {dog.avatarPath ? (
                            <img
                                src={dog.avatarUrl || dog.avatarPath}
                                alt={dog.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 text-muted-foreground">
                                <span className="text-6xl mb-2">🐕</span>
                                <span className="text-sm font-medium">No Image Available</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                            <h1 className="text-5xl font-extrabold mb-3 tracking-tight">{dog.name}</h1>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-4 py-1.5 text-base font-medium">
                                    {dog.breed}
                                </Badge>
                                <Badge variant={dog.gender === "male" ? "default" : "secondary"} className={cn("px-4 py-1.5 text-base border-0 font-medium", dog.gender === "male" ? "bg-blue-500/80 text-white" : "bg-pink-500/80 text-white")}>
                                    {dog.gender === "male" ? "Male" : "Female"}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <CardContent className="p-8 space-y-10">
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
                                <div className="p-3 bg-background rounded-xl shadow-sm"><Palette className="w-5 h-5 text-primary" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">{t("publicDog.color")}</p>
                                    <p className="font-bold text-base">{dog.attributes.color || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
                                <div className="p-3 bg-background rounded-xl shadow-sm"><Calendar className="w-5 h-5 text-primary" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">{t("publicDog.birthday")}</p>
                                    <p className="font-bold text-base">{dog.birthday ? new Date(dog.birthday).toLocaleDateString() : "Unknown"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Owner Info */}
                        <div className="flex items-center gap-5 p-5 rounded-2xl bg-secondary/30 border border-secondary">
                            <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                                <AvatarImage src={dog.ownerAvatar} />
                                <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{t("publicDog.owner")}</p>
                                <div className="flex flex-col">
                                    <p className="font-bold text-xl">{dog.ownerName || "Anonymous Owner"}</p>
                                    {dog.ownerEmail && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <Mail className="w-3.5 h-3.5" />
                                            {dog.ownerEmail}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contact Section - Different for owner vs stranger */}
                        {isOwner ? (
                            /* OWNER VIEW: Show stats and manage options */
                            <div className="space-y-4 pt-4 border-t border-border/50">
                                <div className="text-center py-6 bg-primary/5 rounded-2xl border border-primary/20">
                                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Home className="h-7 w-7 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-bold text-primary mb-1">
                                        {t("publicDog.ownerViewTitle") || "Trang công khai của bé"}
                                    </h3>
                                    <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                                        {t("publicDog.ownerViewInfo") || "Đây là trang mà người khác sẽ thấy khi quét mã QR của bé."}
                                    </p>
                                    <Button
                                        onClick={() => router.push(`/my-dogs/${dog.id}`)}
                                        className="mt-2"
                                    >
                                        <Settings className="h-4 w-4 mr-2" />
                                        {t("publicDog.goToProfile") || "Quản lý hồ sơ"}
                                    </Button>
                                </div>
                            </div>
                        ) : dog.showSystemForm ? (
                            <div className="space-y-6 pt-4 border-t border-border/50">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-2xl flex items-center gap-3 text-foreground">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <MessageSquare className="h-6 w-6" />
                                        </div>
                                        {t("publicDog.contactOwner")}
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t("publicDog.phoneSecure") || "Your message will be sent directly to the owner via our secure system."}
                                    </p>
                                </div>
                                <ReportFoundForm
                                    dogId={dog.id}
                                    dogName={dog.name}
                                    dogBreed={dog.breed}
                                    isLost={dog.isLost}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="text-lg font-bold text-green-800 dark:text-green-400 mb-2">{t("publicDog.dogSafe")}</h3>
                                <p className="text-green-700/80 dark:text-green-500/80 max-w-md mx-auto">
                                    {t("publicDog.privacyHidden") || "This dog is safe with their owner. Contact information is hidden for privacy."}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-8 text-center space-y-2 pb-8">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                        {t("publicDog.poweredBy")} <span className="font-bold text-foreground">DogDex System</span>
                    </p>
                    <p className="text-xs text-muted-foreground/50">
                        Scan ID: {dog.id} • Verified Profile
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
