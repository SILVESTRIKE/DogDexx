"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Navigation } from "lucide-react";
import dynamic from "next/dynamic";

import { useI18n } from "@/lib/i18n-context";

// Component loading map
const MapLoading = () => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/20">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      <p className="text-sm text-muted-foreground">{t("locationPicker.loadingMap")}</p>
    </div>
  );
};

// Dynamically import the Map component
const LocationPickMap = dynamic(() => import("@/components/maps/LocationPickMap"), {
  ssr: false,
  loading: () => <MapLoading />
});

interface MapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLat?: number;
  initialLng?: number;
}

// Reverse Geocoding using OpenStreetMap Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Nominatim có thể bị 403 nếu User-Agent không đúng hoặc rate limit
    // Sử dụng cache-control và đơn giản hóa request
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`,
      {
        method: 'GET',
        // Không gửi custom headers để tránh preflight CORS request
      }
    );

    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();

    if (data.display_name) {
      const address = data.address;
      if (address) {
        const parts = [];
        if (address.house_number) parts.push(address.house_number);
        if (address.road) parts.push(address.road);
        if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
        if (address.city || address.town || address.county) parts.push(address.city || address.town || address.county);
        if (address.state) parts.push(address.state);

        if (parts.length > 0) return parts.join(', ');
      }
      return data.display_name;
    }

    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export function MapLocationPicker({ onLocationSelect, initialLat, initialLng }: MapLocationPickerProps) {
  const { t } = useI18n();
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced geocoding
  const geocodePosition = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    const addr = await reverseGeocode(lat, lng);
    setAddress(addr);
    setGeocoding(false);
    return addr;
  }, []);

  // 1. Effect khi Mount: Nếu chưa có tọa độ ban đầu thì Auto Locate
  useEffect(() => {
    if (!initialLat && !initialLng) {
      handleAutoLocate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Effect QUAN TRỌNG: Lắng nghe thay đổi từ Props (Search từ Modal cha)
  useEffect(() => {
    if (initialLat && initialLng) {
      // Kiểm tra xem vị trí mới có khác vị trí hiện tại không để tránh render lặp
      if (!position || Math.abs(position[0] - initialLat) > 0.00001 || Math.abs(position[1] - initialLng) > 0.00001) {
        setPosition([initialLat, initialLng]);
        // Gọi geocode để lấy tên đường hiển thị vào ô xám
        geocodePosition(initialLat, initialLng);
      }
    }
  }, [initialLat, initialLng, geocodePosition]); // Thêm dependencies này để kích hoạt khi props đổi

  const handleAutoLocate = async () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError(t("locationPicker.errors.unsupported"));
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setLoading(false);
        const addr = await geocodePosition(latitude, longitude);
        onLocationSelect(latitude, longitude, addr);
      },
      async (err) => {
        setError(t("locationPicker.errors.permission"));
        setLoading(false);
        // Default HCM
        const defaultPos: [number, number] = [10.7769, 106.7009];
        setPosition(defaultPos);
        const addr = await geocodePosition(defaultPos[0], defaultPos[1]);
        onLocationSelect(defaultPos[0], defaultPos[1], addr);
      }
    );
  };

  const handlePositionChange = async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    const addr = await geocodePosition(lat, lng);
    onLocationSelect(lat, lng, addr);
  };

  if (!position && loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/20 h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">{t("locationPicker.locating")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Address Display */}
      <div className="bg-muted/30 rounded-lg p-3 border">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{t("locationPicker.addressLabel")}</p>
            {geocoding ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-muted-foreground">{t("locationPicker.resolvingAddress")}</span>
              </div>
            ) : (
              <p className="text-sm font-medium break-words">
                {address || t("locationPicker.noLocation")}
              </p>
            )}
            {position && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("locationPicker.gpsLabel")} {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Map Controls */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" type="button" onClick={handleAutoLocate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Navigation className="mr-2 h-3 w-3" />}
          {t("locationPicker.getLocation")}
        </Button>
      </div>

      {/* Map */}
      <div className="border rounded-lg overflow-hidden h-[280px] relative z-0 shadow-inner">
        {position && (
          <LocationPickMap position={position} onPositionChange={handlePositionChange} />
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center italic">
        {t("locationPicker.hint")}
      </p>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}