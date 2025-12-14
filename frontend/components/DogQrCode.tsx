"use client";

import React, { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n-context";

interface DogQrCodeProps {
    shortCode: string;
    dogName: string;
}

export function DogQrCode({ shortCode, dogName }: DogQrCodeProps) {
    const { t } = useI18n();
    const [baseUrl, setBaseUrl] = React.useState("http://localhost:3001");

    React.useEffect(function () {
        if (typeof window !== "undefined") {
            setBaseUrl(window.location.origin);
        }
    }, []);

    // Link đích: Dẫn tới trang Public Profile
    const qrValue = `${baseUrl}/public/${shortCode}`;

    function downloadQR() {
        const canvas = document.getElementById("dog-qr-canvas") as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `DogDex_ID_${dogName}_${shortCode}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <Card className="p-6 bg-white border-2 border-primary/20 shadow-xl rounded-xl flex flex-col items-center gap-2 w-fit">
                <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-1">
                    {t("dogQrCode.petId")}
                </h3>

                {/* QR CODE GENERATOR with Logo */}
                <div className="p-2 border border-black/10 rounded-lg">
                    <QRCodeCanvas
                        id="dog-qr-canvas"
                        value={qrValue}
                        size={200}
                        level={"H"} // High error correction để QR vẫn scan được với logo
                        includeMargin={true}
                        imageSettings={{
                            src: "/LogoWebBlack.png", // Logo app (black cho nền trắng QR)
                            x: undefined,
                            y: undefined,
                            height: 40,
                            width: 40,
                            excavate: true, // Tạo vùng trống cho logo
                        }}
                    />
                </div>

                <div className="text-center mt-2">
                    <p className="font-extrabold text-xl text-foreground">{dogName}</p>
                    <p className="text-xs text-muted-foreground font-mono">ID: {shortCode}</p>
                </div>
            </Card>

            <div className="flex gap-3">
                <Button onClick={downloadQR} className="gap-2 bg-primary text-white">
                    <Download className="w-4 h-4" /> {t("dogQrCode.download")}
                </Button>
                <Button variant="outline" onClick={function () { window.print(); }} className="gap-2">
                    <Printer className="w-4 h-4" /> {t("dogQrCode.print")}
                </Button>
            </div>

            <p className="text-xs text-muted-foreground max-w-xs text-center">
                {t("dogQrCode.hint")}
            </p>
        </div>
    );
}

