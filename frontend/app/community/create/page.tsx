"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { MapPin, Upload, Loader2, AlertTriangle, CheckCircle, Camera, QrCode, Image as ImageIcon, Sparkles, RefreshCcw } from "lucide-react";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n-context";

// Cấu hình AI Stream
const SEND_WIDTH = 500;
const COMPRESSION_QUALITY = 0.6;

export default function CreatePostPage() {
    const { t } = useI18n();
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Form State
    const [postType, setPostType] = useState<"LOST" | "FOUND">("FOUND");
    const [inputMethod, setInputMethod] = useState<"camera" | "upload" | "qr">("camera");

    // Media State
    const [photos, setPhotos] = useState<File[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [aiDetectedBreed, setAiDetectedBreed] = useState<string | null>(null);

    // Camera & WebSocket State
    const videoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const sendCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isWaitingResponseRef = useRef(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [liveBreedLabel, setLiveBreedLabel] = useState<string>("");

    const [formData, setFormData] = useState({
        title: "",
        content: "",
        location: { lat: 0, lng: 0, address: "" },
        contact_info: { name: "", phone: "", email: "" }
    });

    // Auto-fill contact info
    useEffect(function () {
        if (user) {
            setFormData(function (prev) {
                return {
                    ...prev,
                    contact_info: {
                        name: user.username || "",
                        phone: user.phoneNumber || "",
                        email: user.email || ""
                    }
                };
            });
        }
    }, [user]);

    // Chuyển mode mặc định dựa trên loại bài viết
    useEffect(function () {
        if (postType === "LOST") setInputMethod("upload");
        else setInputMethod("camera");
    }, [postType]);

    // --- LIVE CAMERA LOGIC ---
    const cleanupCamera = useCallback(function () {
        if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(function (t) { t.stop(); });
            videoRef.current.srcObject = null;
        }
        setIsStreaming(false);
        isWaitingResponseRef.current = false;
        setLiveBreedLabel("");
    }, []);

    const sendNextFrame = useCallback(function () {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN ||
            !videoRef.current || videoRef.current.paused || isWaitingResponseRef.current) return;

        const video = videoRef.current;
        if (!sendCanvasRef.current) sendCanvasRef.current = document.createElement("canvas");
        const cvs = sendCanvasRef.current;
        const ratio = video.videoHeight / video.videoWidth;

        cvs.width = SEND_WIDTH;
        cvs.height = SEND_WIDTH * ratio;
        cvs.getContext("2d")?.drawImage(video, 0, 0, cvs.width, cvs.height);

        cvs.toBlob(function (blob) {
            if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
                isWaitingResponseRef.current = true;
                wsRef.current.send(blob);
            }
        }, "image/webp", COMPRESSION_QUALITY);
    }, []);

    async function startCamera() {
        try {
            cleanupCamera();
            const ws = await apiClient.connectStreamPrediction();
            wsRef.current = ws;

            ws.onopen = async function () {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 1280 } }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = function () {
                        videoRef.current?.play();
                        setIsStreaming(true);
                        sendNextFrame();
                    };
                }
            };

            ws.onmessage = function (e) {
                try {
                    const data = JSON.parse(e.data);
                    const dets = data.detections || (Array.isArray(data) ? data : []);
                    const best = dets.find(function (d: any) { return d.confidence > 0.6; });

                    if (best) {
                        setLiveBreedLabel(`${best.class} (${Math.round(best.confidence * 100)}%)`);
                        setAiDetectedBreed(best.class);
                    } else {
                        setLiveBreedLabel("");
                    }
                } catch (err) { }
                finally {
                    isWaitingResponseRef.current = false;
                    requestAnimationFrame(sendNextFrame);
                }
            };
        } catch (err) {
            toast.error(t("createPost.cameraError"));
            cleanupCamera();
        }
    }

    function capturePhoto() {
        if (videoRef.current) {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);

            canvas.toBlob(function (blob) {
                if (blob) {
                    const file = new File([blob], "captured_dog.jpg", { type: "image/jpeg" });
                    setPhotos([file]);
                    setPreviewImage(canvas.toDataURL('image/jpeg', 0.8));

                    if (aiDetectedBreed && !formData.title) {
                        const prefix = postType === "LOST" ? t("createPost.lostPrefix") : t("createPost.foundPrefix");
                        setFormData(function (prev) {
                            return {
                                ...prev,
                                title: `${prefix}${aiDetectedBreed}`,
                                content: prev.content || t("createPost.featurePrefix", { breed: aiDetectedBreed })
                            };
                        });
                        toast.success(t("createPost.autoFilledBreed", { breed: aiDetectedBreed }));
                    } else {
                        toast.success(t("createPost.photoTaken"));
                    }
                    cleanupCamera();
                }
            }, 'image/jpeg', 0.9);
        }
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setPhotos([file]);
            setPreviewImage(URL.createObjectURL(file));
        }
    }

    // --- QR LOGIC ---
    useEffect(function () {
        let scanner: any = null;
        if (inputMethod === "qr") {
            import("html5-qrcode").then(function ({ Html5QrcodeScanner }) {
                setTimeout(function () {
                    if (document.getElementById("qr-reader-create")) {
                        scanner = new Html5QrcodeScanner("qr-reader-create", { fps: 10, qrbox: 250 }, false);
                        scanner.render(function (decodedText: string) {
                            toast.success(t("createPost.qrMatched") + ": " + decodedText);
                            setFormData(function (prev) {
                                return {
                                    ...prev,
                                    title: t("createPost.foundDogWithTag", { id: decodedText.substring(0, 6) }),
                                    content: t("createPost.qrScannedContent", { id: decodedText })
                                };
                            });
                            scanner.clear();
                        }, function () { });
                    }
                }, 100);
            });
        }
        return function () { scanner?.clear().catch(function () { }); cleanupCamera(); };
    }, [inputMethod, cleanupCamera, t]);

    // Cleanup khi unmount
    useEffect(function () { return function () { cleanupCamera(); }; }, [cleanupCamera]);


    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (photos.length === 0 && inputMethod !== 'qr') {
            toast.error(t("createPost.needPhoto"));
            return;
        }

        setLoading(true);
        try {
            await apiClient.createCommunityPost({
                type: postType,
                title: formData.title,
                content: formData.content,
                photos: photos,
                location: formData.location,
                contact_info: formData.contact_info
            });
            toast.success(t("createPost.postSuccess"));
            router.push("/community");
        } catch (error: any) {
            toast.error(error.message || t("createPost.postError"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="container mx-auto px-4 py-6 max-w-3xl">
            <Card className="border-t-4 border-t-primary shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                        {postType === "LOST" ? <AlertTriangle className="text-red-500" /> : <CheckCircle className="text-green-500" />}
                        {postType === "LOST" ? t("createPost.lostTitle") : t("createPost.foundTitle")}
                    </CardTitle>
                    <CardDescription>
                        {t("createPost.aiHint")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* TYPE SELECTION */}
                        <div className="flex justify-center mb-4">
                            <RadioGroup
                                defaultValue="FOUND"
                                value={postType}
                                onValueChange={function (v: "LOST" | "FOUND") { setPostType(v); }}
                                className="grid grid-cols-2 w-full max-w-md gap-4"
                            >
                                <div>
                                    <RadioGroupItem value="FOUND" id="found" className="peer sr-only" />
                                    <Label htmlFor="found" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-green-500 peer-data-[state=checked]:text-green-600 cursor-pointer">
                                        <CheckCircle className="mb-2 h-6 w-6" />
                                        <span className="font-bold">{t("createPost.iFoundDog")}</span>
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="LOST" id="lost" className="peer sr-only" />
                                    <Label htmlFor="lost" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-red-500 peer-data-[state=checked]:text-red-600 cursor-pointer">
                                        <AlertTriangle className="mb-2 h-6 w-6" />
                                        <span className="font-bold">{t("createPost.iLostDog")}</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* MEDIA INPUT */}
                        <div className="space-y-2">
                            <Label className="font-semibold flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> {t("createPost.verificationImage")}
                            </Label>

                            <Tabs value={inputMethod} onValueChange={function (v: any) { setInputMethod(v); }} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="camera" onClick={function () { if (!isStreaming && !previewImage) startCamera(); }}>
                                        <Camera className="h-4 w-4 mr-2" /> {t("createPost.liveCamera")}
                                    </TabsTrigger>
                                    <TabsTrigger value="upload" onClick={cleanupCamera}>
                                        <Upload className="h-4 w-4 mr-2" /> {t("createPost.upload")}
                                    </TabsTrigger>
                                    <TabsTrigger value="qr" onClick={cleanupCamera}>
                                        <QrCode className="h-4 w-4 mr-2" /> {t("createPost.scanQr")}
                                    </TabsTrigger>
                                </TabsList>

                                <div className="mt-4 border rounded-xl overflow-hidden bg-black/5 min-h-[300px] relative flex flex-col items-center justify-center">

                                    {/* PREVIEW IMAGE */}
                                    {previewImage && (
                                        <div className="w-full h-full relative group">
                                            <img src={previewImage} alt="Preview" className="w-full h-full object-contain max-h-[400px] bg-black" />
                                            <Button
                                                variant="destructive" size="icon"
                                                className="absolute top-2 right-2 rounded-full"
                                                onClick={function () { setPreviewImage(null); setPhotos([]); if (inputMethod === 'camera') startCamera(); }}
                                            >
                                                <RefreshCcw className="w-4 h-4" />
                                            </Button>
                                            {aiDetectedBreed && (
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm flex items-center gap-2">
                                                    <Sparkles className="w-3 h-3 text-yellow-400" /> {t("createPost.aiDetected")}: {aiDetectedBreed}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* LIVE CAMERA */}
                                    {!previewImage && inputMethod === "camera" && (
                                        <div className="w-full h-full relative aspect-[3/4] md:aspect-video bg-black">
                                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                                            {isStreaming && liveBreedLabel && (
                                                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500/90 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg animate-in fade-in zoom-in duration-300 flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                                                    {liveBreedLabel}
                                                </div>
                                            )}

                                            {!isStreaming ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 gap-4">
                                                    <Camera className="w-12 h-12 opacity-50" />
                                                    <Button onClick={startCamera} variant="outline" className="text-black border-white bg-white/90">
                                                        {t("createPost.enableCamera")}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                                                    <Button onClick={capturePhoto} size="lg" className="rounded-full w-16 h-16 border-4 border-white bg-transparent hover:bg-white/20 p-1">
                                                        <div className="w-full h-full bg-red-500 rounded-full animate-pulse" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* UPLOAD MODE */}
                                    {!previewImage && inputMethod === "upload" && (
                                        <div className="flex flex-col items-center justify-center p-8 text-center w-full h-full">
                                            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                                            <Label htmlFor="file-upload" className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
                                                {t("createPost.selectFromLibrary")}
                                            </Label>
                                            <Input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                            <p className="text-xs text-muted-foreground mt-2">{t("createPost.fileSupport")}</p>
                                        </div>
                                    )}

                                    {/* QR MODE */}
                                    {!previewImage && inputMethod === "qr" && (
                                        <div className="w-full p-4 flex flex-col items-center">
                                            <div id="qr-reader-create" className="w-full max-w-sm border rounded-lg overflow-hidden"></div>
                                            <p className="text-xs text-muted-foreground mt-2 text-center">{t("createPost.scanQrHint")}</p>
                                        </div>
                                    )}
                                </div>
                            </Tabs>
                        </div>

                        {/* INFO FIELDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label>{t("createPost.postTitle")}</Label>
                                <Input
                                    placeholder={postType === 'LOST' ? t("createPost.lostPlaceholder") : t("createPost.foundPlaceholder")}
                                    value={formData.title}
                                    onChange={function (e) { setFormData({ ...formData, title: e.target.value }); }}
                                    required
                                />
                                {aiDetectedBreed && !formData.title.includes(aiDetectedBreed) && (
                                    <div className="text-xs text-blue-600 cursor-pointer hover:underline flex items-center gap-1"
                                        onClick={function () { setFormData(function (prev) { return { ...prev, title: `${prev.title} ${aiDetectedBreed}`.trim() }; }); }}>
                                        <Sparkles className="w-3 h-3" /> {t("createPost.addBreedHint", { breed: aiDetectedBreed })}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label>{t("createPost.description")}</Label>
                                <Textarea
                                    placeholder={t("createPost.descriptionPlaceholder")}
                                    className="h-24"
                                    value={formData.content}
                                    onChange={function (e) { setFormData({ ...formData, content: e.target.value }); }}
                                />
                            </div>

                            {/* Location */}
                            <div className="space-y-2 md:col-span-2 p-4 bg-muted/20 rounded-lg border">
                                <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {postType === 'LOST' ? t("createPost.locationLost") : t("createPost.locationFound")}</Label>
                                <MapLocationPicker
                                    onLocationSelect={function (lat, lng, addr) {
                                        setFormData(function (prev) {
                                            return {
                                                ...prev,
                                                location: { lat, lng, address: addr || prev.location.address }
                                            };
                                        });
                                    }}
                                />
                                <Input
                                    placeholder={t("createPost.addressPlaceholder")}
                                    value={formData.location.address}
                                    onChange={function (e) { setFormData(function (prev) { return { ...prev, location: { ...prev.location, address: e.target.value } }; }); }}
                                    className="mt-2"
                                />
                            </div>

                            {/* Contact */}
                            <div className="space-y-2">
                                <Label>{t("createPost.contactName")}</Label>
                                <Input
                                    value={formData.contact_info.name}
                                    onChange={function (e) { setFormData({ ...formData, contact_info: { ...formData.contact_info, name: e.target.value } }); }}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("createPost.phone")}</Label>
                                <Input
                                    value={formData.contact_info.phone}
                                    onChange={function (e) { setFormData({ ...formData, contact_info: { ...formData.contact_info, phone: e.target.value } }); }}
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" size="lg" className="w-full font-bold" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin mr-2" /> : (postType === 'LOST' ? <AlertTriangle className="mr-2 h-5 w-5" /> : <CheckCircle className="mr-2 h-5 w-5" />)}
                            {loading ? t("createPost.processing") : t("createPost.postNow")}
                        </Button>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}