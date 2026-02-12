"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fixLeafletIcons } from "./leaflet-utils";

// Helper component to auto-center map
function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, 15);
    }, [center, map]);
    return null;
}

interface LocationPickMapProps {
    position: [number, number];
    onPositionChange: (lat: number, lng: number) => void;
}

export default function LocationPickMap({ position, onPositionChange }: LocationPickMapProps) {
    useEffect(() => {
        fixLeafletIcons();
    }, []);

    function handleMarkerDragEnd(event: any) {
        const marker = event.target;
        const pos = marker.getLatLng();
        if (pos) {
            onPositionChange(pos.lat, pos.lng);
        }
    }

    return (
        <MapContainer center={position} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapUpdater center={position} />
            <Marker
                position={position}
                draggable={true}
                eventHandlers={{ dragend: handleMarkerDragEnd }}
            >
                <Popup>Vị trí của bạn. Kéo thả để điều chỉnh.</Popup>
            </Marker>
        </MapContainer>
    );
}
