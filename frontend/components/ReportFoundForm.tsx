"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, MapPin, User, Phone, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

interface ReportFoundFormProps {
    dogId: string;
    dogName: string;
    dogBreed: string;
    isLost: boolean;
    onSuccess?: () => void;
}

export function ReportFoundForm({ dogId, dogName, dogBreed, isLost, onSuccess }: ReportFoundFormProps) {
    const { t } = useI18n();
    const [sending, setSending] = useState(false);

    const [formData, setFormData] = useState({
        finderName: "",
        finderPhone: "",
        message: "",
        locationAddress: "",
        lat: 0,
        lng: 0,
        postTitle: "",
        postContent: ""
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (formData.lat === 0 && formData.lng === 0) {
            toast.error(t("publicDog.selectLocation") || "Vui lòng chọn vị trí trên bản đồ");
            return;
        }

        setSending(true);
        try {
            // 1. Create community FOUND post (if dog is lost) so it shows on owner's radar
            if (isLost) {
                try {
                    await apiClient.createQrFoundPost({
                        dog_id: dogId,
                        title: formData.postTitle || `Đã tìm thấy ${dogName} - ${dogBreed}`,
                        content: formData.postContent || formData.message || `Tôi đã tìm thấy chú chó này tại ${formData.locationAddress}`,
                        location: {
                            lat: formData.lat,
                            lng: formData.lng,
                            address: formData.locationAddress
                        },
                        contact_info: {
                            name: formData.finderName,
                            phone: formData.finderPhone
                        }
                    });
                } catch (postError) {
                    console.error("Failed to create FOUND post:", postError);
                    // Continue with direct notification even if post creation fails
                }
            }

            // 2. Send direct notification to owner
            await apiClient.contactOwner({
                dogId: dogId,
                finderName: formData.finderName,
                finderPhone: formData.finderPhone,
                message: formData.message,
                location: {
                    address: formData.locationAddress,
                    lat: formData.lat,
                    lng: formData.lng
                }
            });

            toast.success(t("publicDog.messageSent"));
            setFormData({ finderName: "", finderPhone: "", message: "", locationAddress: "", lat: 0, lng: 0, postTitle: "", postContent: "" });
            onSuccess?.();
        } catch (error) {
            toast.error(t("publicDog.sendFailed"));
        } finally {
            setSending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                    <Label className="font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t("publicDog.yourName")}
                    </Label>
                    <Input
                        required
                        value={formData.finderName}
                        onChange={e => setFormData({ ...formData, finderName: e.target.value })}
                        placeholder="John Doe"
                        className="h-11 bg-muted/30"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {t("publicDog.yourPhone")}
                    </Label>
                    <Input
                        required
                        type="tel"
                        value={formData.finderPhone}
                        onChange={e => setFormData({ ...formData, finderPhone: e.target.value })}
                        placeholder="0912..."
                        className="h-11 bg-muted/30"
                    />
                </div>
            </div>

            {/* Location Picker */}
            <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {t("publicDog.currentLocation")}
                </Label>
                <MapLocationPicker
                    onLocationSelect={(lat, lng, address) => {
                        setFormData(prev => ({
                            ...prev,
                            locationAddress: address || "",
                            lat: lat,
                            lng: lng
                        }));
                    }}
                />
            </div>

            {/* Post Title & Content - only show if dog is lost */}
            {isLost && (
                <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {t("publicDog.postWillBeCreated") || "Thông tin này sẽ được đăng lên cộng đồng để chủ nhân dễ tìm thấy bạn"}
                    </p>
                    <div className="space-y-2">
                        <Label className="font-semibold">{t("publicDog.postTitle") || "Tiêu đề bài đăng"}</Label>
                        <Input
                            value={formData.postTitle || `Đã tìm thấy ${dogName} - ${dogBreed}`}
                            onChange={e => setFormData({ ...formData, postTitle: e.target.value })}
                            placeholder={`Đã tìm thấy ${dogName}`}
                            className="h-11 bg-white dark:bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="font-semibold">{t("publicDog.postContent") || "Mô tả chi tiết"}</Label>
                        <Textarea
                            value={formData.postContent}
                            onChange={e => setFormData({ ...formData, postContent: e.target.value })}
                            placeholder={t("publicDog.postContentPlaceholder") || "Mô tả thêm về tình trạng chó, nơi bạn tìm thấy..."}
                            className="min-h-[80px] resize-none bg-white dark:bg-background"
                        />
                    </div>
                </div>
            )}

            {/* Message to owner */}
            <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {t("publicDog.message")}
                </Label>
                <Textarea
                    required
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t("publicDog.messagePlaceholder") || "Tôi đã tìm thấy chú chó này..."}
                    className="min-h-[120px] resize-none bg-muted/30"
                />
            </div>

            {/* Submit Button */}
            <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-xl shadow-red-600/20 rounded-xl transition-all hover:scale-[1.01]"
                disabled={sending}
            >
                {sending ? (
                    <><Loader2 className="animate-spin mr-2 h-5 w-5" /> {t("publicDog.sending")}</>
                ) : (
                    <><AlertTriangle className="mr-2 h-5 w-5" /> {t("publicDog.sendAlert")}</>
                )}
            </Button>
        </form>
    );
}
