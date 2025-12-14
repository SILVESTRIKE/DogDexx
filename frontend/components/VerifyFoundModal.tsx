"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { QrCode, Camera, Loader2, CheckCircle, ScanFace, AlertCircle, Sparkles, Smartphone, Upload, MapPin, User, Mail, Phone, ArrowLeft } from "lucide-react";
// @ts-ignore
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { apiClient } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

import { MapLocationPicker } from "@/components/MapLocationPicker";

// Cấu hình ảnh gửi đi
const SEND_WIDTH = 480;
const COMPRESSION_QUALITY = 0.6;

interface VerifyFoundModalProps {
    dogId: string;
    dogName: string;
    targetBreed: string; // Display name for UI
    targetBreedSlug: string; // Slug for AI comparison
    onSuccess: () => void;
}

// Visual Component: Khung ngắm Camera
const ScannerOverlay = ({ isScanning }: { isScanning: boolean }) => (
    <div className="absolute inset-0 pointer-events-none z-10 p-6">
        {/* Corners */}
        <div className="absolute top-4 left-4 w-12 h-12 border-l-4 border-t-4 border-primary/70 rounded-tl-xl" />
        <div className="absolute top-4 right-4 w-12 h-12 border-r-4 border-t-4 border-primary/70 rounded-tr-xl" />
        <div className="absolute bottom-4 left-4 w-12 h-12 border-l-4 border-b-4 border-primary/70 rounded-bl-xl" />
        <div className="absolute bottom-4 right-4 w-12 h-12 border-r-4 border-b-4 border-primary/70 rounded-br-xl" />

        {/* Scanning Line */}
        {isScanning && (
            <motion.div
                initial={{ top: "10%" }}
                animate={{ top: "90%" }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-4 right-4 h-0.5 bg-primary/80 shadow-[0_0_15px_rgba(var(--primary),0.8)]"
            />
        )}
    </div>
);

export function VerifyFoundModal({ dogId, dogName, targetBreed, targetBreedSlug, onSuccess }: VerifyFoundModalProps) {
    const { t } = useI18n();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<"scan" | "contact">("scan");
    const [scanMethod, setScanMethod] = useState<"camera" | "qr">("camera");

    // --- CAMERA & AI STATE ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const sendCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const isWaitingResponseRef = useRef(false);
    // Logic: Nếu confidence thấp (ví dụ <75%) nhưng ổn định trong X giây thì vẫn chấp nhận
    const consistencyRef = useRef<{ label: string | null; startTime: number | null }>({ label: null, startTime: null });

    const [isStreaming, setIsStreaming] = useState(false);
    const [aiStatus, setAiStatus] = useState<"searching" | "detected" | "wrong_breed">("searching");
    const [detectedLabel, setDetectedLabel] = useState<string>("");

    // --- RESULT STATE ---
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
    const [capturedConfidence, setCapturedConfidence] = useState<number>(0); // AI confidence at match time
    const [qrResult, setQrResult] = useState<string | null>(null);

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
        finderName: "",
        finderPhone: "",
        finderEmail: "",
        locationAddress: "",
        lat: 0,
        lng: 0,
        message: `Tôi đã tìm thấy ${dogName} (${targetBreed})!`
    });
    const [submitting, setSubmitting] = useState(false);

    // Auto-fill
    useEffect(() => {
        if (user && step === "contact") {
            setFormData(prev => ({
                ...prev,
                finderName: user.username || prev.finderName,
                finderPhone: user.phoneNumber || prev.finderPhone,
                finderEmail: user.email || prev.finderEmail,
            }));
        }
    }, [user, step]);

    // --- LOGIC WEBSOCKET AI ---
    const cleanupResources = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsStreaming(false);
        isWaitingResponseRef.current = false;
        consistencyRef.current = { label: null, startTime: null };
    }, []);

    const sendNextFrame = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN ||
            !videoRef.current || videoRef.current.paused || isWaitingResponseRef.current) return;

        const video = videoRef.current;
        if (!sendCanvasRef.current) sendCanvasRef.current = document.createElement("canvas");
        const cvs = sendCanvasRef.current;

        const ratio = video.videoHeight / video.videoWidth;
        cvs.width = SEND_WIDTH;
        cvs.height = SEND_WIDTH * ratio;

        const ctx = cvs.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, cvs.width, cvs.height);

        cvs.toBlob(blob => {
            if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
                isWaitingResponseRef.current = true;
                wsRef.current.send(blob);
            }
        }, "image/webp", COMPRESSION_QUALITY);
    }, []);

    const handleAiResult = useCallback((data: any) => {
        const detections = data.detections || (Array.isArray(data) ? data : []);

        // Convert AI detection class to slug format for comparison
        const toSlug = (str: string) => str.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').trim();

        console.log("========= [AI DEBUG] =========");
        console.log("[AI] Target Breed:", targetBreed, "| Slug:", targetBreedSlug);
        console.log("[AI] All Detections:", detections.map((d: any) => `${d.class}: ${(d.confidence * 100).toFixed(1)}%`).join(", ") || "NONE");

        const detection = detections.find((d: any) => {
            const detectionSlug = toSlug(d.class);
            const isMatch = detectionSlug === targetBreedSlug;
            if (isMatch) console.log(`[AI] ✅ Slug match: "${detectionSlug}" === "${targetBreedSlug}"`);
            return isMatch;
        });

        let isMatch = false;

        if (detection) {
            console.log(`[AI] ✅ Match Candidate: ${detection.class} (${(detection.confidence * 100).toFixed(1)}%)`);

            // Case 1: High Confidence -> Instant
            if (detection.confidence > 0.75) {
                console.log("[AI] 🎯 High confidence match! -> INSTANT MATCH");
                isMatch = true;
            }
            // Case 2: Lower Confidence (> 35%) but Consistent -> Adaptive
            else if (detection.confidence > 0.35) {
                const now = Date.now();
                const currentLabel = detection.class.trim().toLowerCase();
                const storedLabel = consistencyRef.current.label?.trim().toLowerCase();

                console.log(`[AI] 🔄 Consistency Check: Current="${currentLabel}", Stored="${storedLabel}"`);

                if (storedLabel === currentLabel) {
                    const diff = now - (consistencyRef.current.startTime || 0);
                    console.log(`[AI] ⏱️ Holding for ${diff}ms / 3000ms required`);

                    if (consistencyRef.current.startTime && diff > 3000) { // 3 seconds
                        console.log("[AI] ✅ Adaptive match confirmed!");
                        isMatch = true;
                        toast.info(t("verifyFound.camera.adaptiveMatch", { label: detection.class }));
                    } else {
                        // Still holding - show as "detected" state but don't match yet
                        setAiStatus("detected");
                        setDetectedLabel(`${detection.class} (${((diff / 3000) * 100).toFixed(0)}%)`);
                    }
                } else {
                    console.log("[AI] 🔄 Starting NEW consistency check for:", detection.class);
                    // Reset consistency timer for new candidate
                    consistencyRef.current = { label: detection.class, startTime: now };
                    // Show as detected (holding) state
                    setAiStatus("detected");
                    setDetectedLabel(detection.class);
                }
            } else {
                // Too low, reset and show as low confidence detection
                console.log(`[AI] ❌ Confidence too low (${(detection.confidence * 100).toFixed(1)}%), need >35% for consistency check`);
                consistencyRef.current = { label: null, startTime: null };
                // Show the detection but indicate it's weak
                setAiStatus("wrong_breed");
                setDetectedLabel(`${detection.class} (${(detection.confidence * 100).toFixed(0)}% - weak)`);
            }
        } else {
            if (consistencyRef.current.label) console.log("[AI] ❌ No matching detection found, resetting.");
            consistencyRef.current = { label: null, startTime: null };
        }

        if (isMatch && detection) {
            console.log("[AI] 🎉 FINAL MATCH! Transitioning to contact step...");
            setAiStatus("detected");
            setDetectedLabel(detection.class);

            if (videoRef.current) {
                const canvas = document.createElement("canvas");
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);

                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                setCapturedImage(dataUrl);
                setCapturedConfidence(detection.confidence); // Save actual AI confidence
                canvas.toBlob(blob => setCapturedBlob(blob), "image/jpeg", 0.8);

                // Ensure success toast is shown only once or appropriately
                if (detection.confidence > 0.75) {
                    toast.success(t("verifyFound.camera.success", { label: detection.class }));
                } else {
                    toast.success(t("verifyFound.camera.successAdaptive", { label: detection.class }) || t("verifyFound.camera.success", { label: detection.class }));
                }

                cleanupResources();
                setStep("contact");
            }
        } else if (!detection && detections.length > 0) {
            // Has detections but none match target breed -> wrong breed
            console.log(`[AI] 🚫 Wrong breed detected: ${detections[0].class}`);
            setAiStatus("wrong_breed");
            setDetectedLabel(detections[0].class);
        } else if (detections.length === 0) {
            setAiStatus("searching");
            setDetectedLabel("");
        }

        isWaitingResponseRef.current = false;
        requestAnimationFrame(sendNextFrame);
    }, [targetBreed, cleanupResources, sendNextFrame]);

    const startLiveStream = useCallback(async () => {
        try {
            cleanupResources();
            const ws = await apiClient.connectStreamPrediction();
            wsRef.current = ws;

            ws.onopen = async () => {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 1280 } }
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play();
                        setIsStreaming(true);
                        sendNextFrame();
                    };
                }
            };

            ws.onmessage = (e) => {
                try {
                    handleAiResult(JSON.parse(e.data));
                } catch (err) { isWaitingResponseRef.current = false; requestAnimationFrame(sendNextFrame); }
            };

            ws.onerror = () => { toast.error(t("verifyFound.camera.serverError")); cleanupResources(); };

        } catch (e) {
            console.error(e);
            toast.error(t("verifyFound.camera.error"));
        }
    }, [cleanupResources, handleAiResult, sendNextFrame, t]);

    const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                const html5QrCode = new Html5Qrcode("qr-file-reader");
                const decodedText = await html5QrCode.scanFile(file, true);
                if (decodedText.includes(dogId)) {
                    setQrResult(decodedText);
                    toast.success(t("verifyFound.qr.fileMatch"));
                    setStep("contact");
                } else {
                    toast.error(t("verifyFound.qr.mismatch"));
                }
                html5QrCode.clear();
            } catch (err) {
                console.error("Error scanning file", err);
                toast.error(t("verifyFound.qr.notFound"));
            }
        }
    };

    // --- QR LOGIC ---
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (open && scanMethod === "qr" && step === "scan") {
            setTimeout(() => {
                if (document.getElementById("qr-reader")) {
                    scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
                    scanner.render((decodedText: string) => {
                        if (decodedText.includes(dogId)) {
                            setQrResult(decodedText);
                            toast.success(t("verifyFound.qr.match"));
                            scanner?.clear();
                            setStep("contact");
                        } else {
                            toast.error(t("verifyFound.qr.mismatch"));
                        }
                    }, () => { });
                }
            }, 200);
        }
        return () => { scanner?.clear().catch(console.error); };
    }, [open, scanMethod, step, dogId]);

    useEffect(() => {
        if (!open) {
            cleanupResources();
            setStep("scan");
            setAiStatus("searching");
            setCapturedImage(null);
        }
    }, [open, cleanupResources]);

    const handleSubmit = async () => {
        if (!formData.finderName || !formData.finderPhone) {
            toast.error(t("verifyFound.contact.errorMissing"));
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                dogId: dogId,
                verificationType: scanMethod,
                verificationData: scanMethod === 'qr' ? qrResult : "AI_VERIFIED_MATCH",
                aiConfidence: scanMethod === 'qr' ? 1.0 : capturedConfidence, // QR = 100%, Camera = actual AI confidence
                contact: {
                    name: formData.finderName,
                    phone: formData.finderPhone,
                    email: formData.finderEmail,
                    address: formData.locationAddress,
                    message: formData.message
                },
                location: { address: formData.locationAddress, lat: formData.lat, lng: formData.lng }
            };

            if (scanMethod === "camera" && capturedBlob) {
                const file = new File([capturedBlob], "verification.jpg", { type: "image/jpeg" });
                await apiClient.reportFoundWithVerification(payload, file);
            } else {
                await apiClient.reportFoundWithVerification(payload);
            }

            toast.success(t("publicDog.messageSent"));
            onSuccess();
            setOpen(false);
        } catch (error: any) {
            toast.error(error.message || t("common.error"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full h-12 text-base bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white gap-2 shadow-lg shadow-primary/25 rounded-xl font-bold transition-all hover:scale-[1.02]">
                    <CheckCircle className="h-5 w-5" />
                    {t("verifyFound.button") || "Xác nhận tìm thấy"}
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md md:max-w-lg max-h-[95vh] overflow-y-auto p-0 gap-0 rounded-2xl border-0 ring-1 ring-white/10 shadow-2xl bg-background/95 backdrop-blur-xl">
                {/* Header */}
                <div className="bg-muted/30 p-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t("verifyFound.title") || "Verify Match"}
                    </DialogTitle>
                    <DialogDescription className="text-sm mt-1">
                        {t("verifyFound.description", { name: dogName, breed: targetBreed })}
                    </DialogDescription>
                </div>

                {step === "scan" && (
                    <Tabs defaultValue="camera" className="w-full" onValueChange={(v: any) => { setScanMethod(v); if (v === 'camera') startLiveStream(); else cleanupResources(); }}>
                        <div className="px-4 pt-4">
                            <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-lg p-1">
                                <TabsTrigger value="camera" className="rounded-md data-[state=active]:shadow-sm"><ScanFace className="h-4 w-4 mr-2" /> AI Camera</TabsTrigger>
                                <TabsTrigger value="qr" className="rounded-md data-[state=active]:shadow-sm"><QrCode className="h-4 w-4 mr-2" /> QR Scan</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="p-4">
                            <TabsContent value="camera" className="mt-0 relative aspect-[3/4] md:aspect-[4/3] w-full bg-black rounded-xl overflow-hidden shadow-inner group isolate">
                                <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />

                                <ScannerOverlay isScanning={isStreaming} />

                                {/* Status Overlay */}
                                <div className="absolute top-4 left-0 right-0 flex justify-center z-20 px-4">
                                    <div className={cn(
                                        "px-4 py-2.5 rounded-full backdrop-blur-md border shadow-xl flex items-center gap-2 transition-all duration-300 font-medium text-sm",
                                        aiStatus === "detected" ? "bg-green-500/90 border-green-400 text-white animate-bounce" :
                                            aiStatus === "wrong_breed" ? "bg-yellow-500/90 border-yellow-400 text-white" :
                                                "bg-black/60 border-white/10 text-white"
                                    )}>
                                        {aiStatus === "searching" && <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> <span>Scanning for <b className="text-primary-foreground">{targetBreed}</b>...</span></>}
                                        {aiStatus === "wrong_breed" && <><AlertCircle className="w-4 h-4 shrink-0" /> <span>Detected: <b>{detectedLabel}</b></span></>}
                                        {aiStatus === "detected" && <><CheckCircle className="w-4 h-4 shrink-0" /> <span>Match Found: <b>{detectedLabel}</b></span></>}
                                    </div>
                                </div>

                                {!isStreaming && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30 backdrop-blur-sm">
                                        <Button onClick={startLiveStream} size="lg" className="rounded-full font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                                            <Camera className="mr-2 h-5 w-5" /> {t("verifyFound.camera.start") || "Start Camera"}
                                        </Button>
                                    </div>
                                )}

                                <div className="absolute bottom-4 left-0 right-0 text-center px-6 z-20">
                                    <p className="text-xs text-white/80 bg-black/40 backdrop-blur-sm p-2 rounded-lg inline-block">
                                        {t("verifyFound.camera.hint") || "Keep the dog in the center of the frame for analysis"}
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="qr" className="mt-0 min-h-[300px] flex flex-col gap-4">
                                <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 border-2 border-dashed border-muted rounded-xl p-6">
                                    <div id="qr-reader" className="w-full max-w-[250px] overflow-hidden rounded-lg shadow-sm"></div>
                                    <div id="qr-file-reader" className="hidden"></div>
                                    <p className="text-sm text-muted-foreground mt-4 text-center max-w-xs">{t("verifyFound.qr.scan") || "Point camera at the QR code on the dog's tag"}</p>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or upload image</span></div>
                                </div>

                                <Button variant="outline" className="w-full relative" onClick={() => document.getElementById('qr-upload-input')?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> {t("verifyFound.qr.upload") || "Select QR Image"}
                                    <Input id="qr-upload-input" type="file" accept="image/*" onChange={handleQrFileUpload} className="hidden" />
                                </Button>
                            </TabsContent>
                        </div>
                    </Tabs>
                )}

                {step === "contact" && (
                    <div className="p-4 md:p-6 space-y-6 animate-in slide-in-from-right-5 fade-in duration-300">
                        {/* Success Banner */}
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl p-4 flex items-start gap-4 shadow-sm">
                            <div className="relative shrink-0">
                                {capturedImage ? (
                                    <img src={capturedImage} className="w-14 h-14 rounded-lg object-cover border-2 border-white shadow-md" alt="Captured" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="w-8 h-8 text-green-600" /></div>
                                )}
                                <div className="absolute -bottom-1 -right-1 bg-green-600 rounded-full p-0.5 border-2 border-white">
                                    <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-green-800 dark:text-green-300 text-sm mb-1">{t("verifyFound.contact.successTitle") || "Verification Successful!"}</h4>
                                <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
                                    {scanMethod === 'camera' ? t("verifyFound.contact.aiSuccess", { label: detectedLabel }) : t("verifyFound.contact.qrSuccess")}.
                                    {t("verifyFound.contact.autoFill")}
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5"><User className="w-3 h-3" /> {t("verifyFound.contact.nameLabel")}</Label>
                                    <Input
                                        value={formData.finderName}
                                        onChange={e => setFormData({ ...formData, finderName: e.target.value })}
                                        className="bg-muted/30"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5"><Phone className="w-3 h-3" /> {t("verifyFound.contact.phoneLabel")}</Label>
                                    <Input
                                        value={formData.finderPhone}
                                        onChange={e => setFormData({ ...formData, finderPhone: e.target.value })}
                                        className="bg-muted/30"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold flex items-center gap-1.5"><Mail className="w-3 h-3" /> {t("verifyFound.contact.emailLabel")}</Label>
                                <Input
                                    value={formData.finderEmail}
                                    onChange={e => setFormData({ ...formData, finderEmail: e.target.value })}
                                    className="bg-muted/30"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {t("verifyFound.contact.locationLabel")}</Label>
                                <div className="rounded-lg overflow-hidden border bg-muted/30 p-1">
                                    <MapLocationPicker
                                        onLocationSelect={(lat, lng, address) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                locationAddress: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                                                lat,
                                                lng
                                            }));
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">{t("verifyFound.contact.messageLabel")}</Label>
                                <Textarea
                                    className="h-24 bg-muted/30 resize-none"
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setStep("scan")}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> {t("verifyFound.contact.back")}
                            </Button>
                            <Button
                                className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold shadow-md shadow-green-600/20"
                                onClick={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                {t("verifyFound.contact.submit")}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}