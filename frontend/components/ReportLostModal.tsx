"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, MapPin, Mail, Search, Navigation, FileText, PenLine, User, AlignLeft } from "lucide-react";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n-context";

interface ReportLostModalProps {
    dogId: string;
    dogName: string;
    dogBreed: string;
    dogAttributes: { color?: string; size?: string };
    onSuccess: () => void;
}

export function ReportLostModal({ dogId, dogName, dogBreed, dogAttributes, onSuccess }: ReportLostModalProps) {
    const { user } = useAuth();
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // State cho tìm kiếm địa điểm
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const [location, setLocation] = useState<{ lat: number; lng: number; address: string }>({
        lat: 0,
        lng: 0,
        address: ""
    });

    // State cho tiêu đề và nội dung bài viết
    const [postTitle, setPostTitle] = useState("");
    const [postContent, setPostContent] = useState("");

    const [contact, setContact] = useState({
        name: "",
        phone: "",
        email: ""
    });

    useEffect(() => {
        if (open && user) {
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";
            setContact({
                name: fullName,
                phone: user.phoneNumber || "",
                email: user.email || ""
            });
            // Reset location khi mở lại modal
            setLocation({ lat: 0, lng: 0, address: "" });
            setSearchQuery("");
            // Auto-fill tiêu đề và nội dung mặc định
            setPostTitle(t("report.postTitle", { name: dogName, breed: dogBreed }) || `[KHẨN CẤP] Tìm ${dogName} - ${dogBreed}`);
            setPostContent("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, user]);

    // Hàm xử lý tìm kiếm địa chỉ từ text sang tọa độ (Geocoding)
    const handleSearchLocation = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                const newLat = parseFloat(result.lat);
                const newLng = parseFloat(result.lon);

                setLocation({
                    lat: newLat,
                    lng: newLng,
                    address: result.display_name
                });

                toast.success(t("report.locationFound") || "Đã tìm thấy địa điểm!");
            } else {
                toast.error(t("report.locationNotFound") || "Không tìm thấy địa điểm này. Hãy thử từ khóa khác.");
            }
        } catch (error) {
            console.error("Search error:", error);
            toast.error(t("common.error") || "Lỗi khi tìm kiếm địa điểm");
        } finally {
            setIsSearching(false);
        }
    };

    const handleLocationSelect = (lat: number, lng: number, address?: string) => {
        setLocation({
            lat,
            lng,
            address: address || location.address || `Vị trí: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
        });
    };

    const buildPostContent = () => {
        const autoContent = t("report.postContent", {
            name: dogName,
            address: location.address || "Chưa xác định",
            color: dogAttributes.color || t("report.unknownColor") || "Không rõ",
            size: dogAttributes.size || t("report.unknownSize") || "Không rõ",
            breed: dogBreed
        }) || `${dogName} bị lạc tại khu vực ${location.address}.\nĐặc điểm: ${dogAttributes.color || "Không rõ"}, ${dogAttributes.size || "Không rõ"}.\nGiống: ${dogBreed}.\nXin hãy giúp đỡ!`;

        if (postContent.trim()) {
            return `${autoContent}\n\n📝 Chi tiết thêm: ${postContent.trim()}`;
        }
        return autoContent;
    };

    const handleSubmit = async () => {
        if (location.lat === 0 && location.lng === 0) {
            toast.error(t("report.errorLocation"));
            return;
        }
        if (!contact.name.trim()) {
            toast.error(t("report.errorName"));
            return;
        }

        setLoading(true);
        try {
            await apiClient.reportLost(dogId, {
                location: {
                    lat: location.lat,
                    lng: location.lng,
                    address: location.address
                },
                contact: {
                    name: contact.name.trim(),
                    email: contact.email.trim() || undefined
                },
                title: postTitle.trim(),
                content: buildPostContent()
            });

            toast.success(t("report.successMessage"), { duration: 5000 });
            setOpen(false);
            onSuccess();
        } catch (error: any) {
            console.error("Report lost error:", error);
            toast.error(error.message || t("report.errorGeneral"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="w-full shadow-md hover:shadow-lg transition-all font-semibold py-6 text-lg">
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    {t("report.button") || "BÁO MẤT KHẨN CẤP"}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto p-0 gap-0 border-none rounded-2xl">
                {/* HEADER */}
                <DialogHeader className="p-6 pb-4 bg-destructive/5 border-b border-destructive/10 rounded-t-2xl sticky top-0 z-10 backdrop-blur-sm">
                    <DialogTitle className="flex items-center gap-2 text-destructive text-xl font-bold uppercase tracking-tight">
                        <span className="bg-destructive text-white p-1.5 rounded-full"><AlertTriangle className="h-5 w-5" /></span>
                        {t("report.title", { name: dogName })}
                    </DialogTitle>
                    <DialogDescription className="text-destructive/80 font-medium">
                        {t("report.description") || "Cung cấp vị trí và thông tin để cộng đồng hỗ trợ tìm kiếm."}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-8">
                    {/* SECTION 1: LOCATION */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-2 text-base font-bold text-foreground">
                            <MapPin className="h-5 w-5 text-destructive" />
                            1. {t("report.locationLabel")}
                        </Label>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t("report.searchPlaceholder") || "Nhập địa chỉ (VD: Công viên Thống Nhất...)"}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
                                    className="pl-9 bg-muted/30 border-border focus:bg-background transition-all"
                                />
                            </div>
                            <Button
                                type="button"
                                onClick={handleSearchLocation}
                                disabled={isSearching || !searchQuery.trim()}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : t("common.search")}
                            </Button>
                        </div>

                        <div className="rounded-xl overflow-hidden border border-border shadow-sm relative z-0">
                            <MapLocationPicker
                                onLocationSelect={handleLocationSelect}
                                initialLat={location.lat !== 0 ? location.lat : undefined}
                                initialLng={location.lng !== 0 ? location.lng : undefined}
                            />
                        </div>

                        {location.address && (
                            <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg text-sm flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                                <Navigation className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                <div>
                                    <span className="text-primary text-xs font-semibold uppercase block mb-0.5">{t("report.selectedAddress")}</span>
                                    <span className="font-medium text-foreground leading-snug">{location.address}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-border" />

                    {/* SECTION 2: CONTENT */}
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-base font-bold text-foreground">
                            <FileText className="h-5 w-5 text-primary" />
                            2. {t("report.contentLabel")}
                        </Label>

                        <div className="grid gap-4 pl-1">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground font-semibold uppercase">{t("report.titleField")}</Label>
                                <Input
                                    value={postTitle}
                                    onChange={e => setPostTitle(e.target.value)}
                                    placeholder={t("report.titlePlaceholder")}
                                    className="font-semibold text-destructive bg-destructive/5 border-destructive/20 focus:border-destructive/40"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground font-semibold uppercase flex items-center gap-1">
                                    <AlignLeft className="h-3 w-3" /> {t("report.detailsField")}
                                </Label>
                                <Textarea
                                    value={postContent}
                                    onChange={e => setPostContent(e.target.value)}
                                    placeholder={t("report.detailsPlaceholder")}
                                    className="min-h-[100px] resize-none bg-muted/30 border-border focus:bg-background transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* SECTION 3: CONTACT */}
                    <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-base font-bold text-foreground">
                            <Mail className="h-5 w-5 text-primary" />
                            3. {t("report.contactLabel")}
                        </Label>

                        <div className="bg-muted/30 p-4 rounded-xl border border-border grid gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" /> {t("report.contactName")}
                                </Label>
                                <Input
                                    value={contact.name}
                                    onChange={e => setContact({ ...contact, name: e.target.value })}
                                    className="bg-background border-border"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> {t("report.contactEmail")}
                                </Label>
                                <Input
                                    type="email"
                                    value={contact.email}
                                    onChange={e => setContact({ ...contact, email: e.target.value })}
                                    placeholder={t("report.emailPlaceholder")}
                                    className="bg-background border-border font-medium"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-destructive/60" />
                                {t("report.contactHint")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <DialogFooter className="p-4 bg-muted/30 border-t sticky bottom-0 z-10 flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                        className="w-full sm:w-auto"
                    >
                        {t("common.cancel")}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full sm:flex-1 font-bold shadow-lg shadow-destructive/20 transition-all hover:translate-y-[-1px]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {t("report.processing")}
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                {t("report.confirmButton") || "XÁC NHẬN BÁO MẤT"}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent >
        </Dialog >
    );
}