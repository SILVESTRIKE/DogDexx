"use client";

import L from "leaflet";

/**
 * Fix Leaflet default icon URLs (required for Next.js)
 * Call this once when component mounts
 */
export function fixLeafletIcons(): void {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
}

export interface MarkerIcons {
    redIcon: L.Icon;
    greenIcon: L.Icon;
    blueIcon: L.Icon;
    yellowIcon: L.Icon;
}

/**
 * Get colored marker icons for map usage
 * Must be called client-side only (after window is available)
 */
export function getMarkerIcons(): MarkerIcons | null {
    if (typeof window === "undefined") return null;

    const createIcon = (color: string): L.Icon => {
        return new L.Icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
            shadowUrl:
                "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
        });
    };

    return {
        redIcon: createIcon("red"),
        greenIcon: createIcon("green"),
        blueIcon: createIcon("blue"),
        yellowIcon: createIcon("gold"), // Gold/Yellow for AI matches
    };
}
