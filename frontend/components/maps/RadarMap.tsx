"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fixLeafletIcons, getMarkerIcons, MarkerIcons } from "./leaflet-utils";

interface RadarMapProps {
    center: [number, number];
    radius: number;
    foundPosts: any[];
}

export default function RadarMap({ center, radius, foundPosts }: RadarMapProps) {
    const [icons, setIcons] = useState<MarkerIcons | null>(null);

    useEffect(() => {
        fixLeafletIcons();
        setIcons(getMarkerIcons());
    }, []);

    if (!icons) return null;

    return (
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            <Circle
                center={center}
                radius={radius * 1000}
                pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.1, weight: 1, dashArray: '5, 10' }}
            />

            <Marker position={center} icon={icons.redIcon}>
                <Popup>
                    <div className="text-center font-bold">Vị trí báo mất</div>
                </Popup>
            </Marker>

            {foundPosts.map((post: any) => {
                if (!post.location || !post.location.coordinates) return null;

                // Determine icon based on verification type
                let icon = icons.greenIcon; // Default Found
                const vType = post.ai_metadata?.verificationType;

                if (vType === 'camera') icon = icons.yellowIcon;
                else if (vType === 'qr') icon = icons.greenIcon;

                return (
                    <Marker
                        key={post._id}
                        position={[post.location.coordinates[1], post.location.coordinates[0]]}
                        icon={icon}
                    >
                        <Popup>
                            <div className="text-center">
                                <div className={`font-bold ${vType === 'camera' ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {vType === 'camera' ? '📷 AI Phát hiện' : '✅ Tìm thấy (QR)'}
                                </div>
                                <div className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</div>
                                {post.photos?.[0] && <img src={post.photos[0]} className="w-24 h-24 object-cover rounded mt-1 mx-auto" />}
                                <a href={`/community/${post._id}`} target="_blank" rel="noreferrer" className="mt-2 text-xs bg-black text-white px-2 py-1 rounded inline-block">Xem chi tiết</a>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MapContainer>
    );
}
