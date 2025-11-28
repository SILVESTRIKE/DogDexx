"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { DogProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Camera, Filter, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function LostFoundContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [dogs, setDogs] = useState<DogProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [breed, setBreed] = useState(searchParams.get("breed") || "");
  const [color, setColor] = useState(searchParams.get("color") || "");

  const fetchDogs = async () => {
    setLoading(true);
    try {
      const params: any = { isLost: "true" };
      if (breed) params.breed = breed;
      if (color) params.color = color;

      const response = await apiClient.searchLostDogs(params);
      setDogs(response.data);
    } catch (error) {
      console.error("Failed to search dogs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDogs();
  }, [breed, color]); // Re-fetch when filters change

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (breed) params.set("breed", breed);
    if (color) params.set("color", color);
    router.replace(`/community/lost-found?${params.toString()}`, { scroll: false });
  }, [breed, color, router]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <AlertTriangle className="text-destructive h-8 w-8" />
            Lost & Found
          </h1>
          <p className="text-muted-foreground">
            Help reunite lost dogs with their owners. Use the AI Scanner to identify breeds.
          </p>
        </div>
        <Link href="/live">
          <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg">
            <Camera className="mr-2 h-5 w-5" />
            Scan Found Dog
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <Card className="mb-8 bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by breed..." 
                className="pl-9"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Filter by color..." 
                className="pl-9"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={fetchDogs}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : dogs.length === 0 ? (
        <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed">
          <p className="text-muted-foreground text-lg">No lost dogs found matching your criteria.</p>
          <Button variant="link" onClick={() => { setBreed(""); setColor(""); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {dogs.map((dog) => (
            <Card key={dog.id} className="overflow-hidden hover:shadow-xl transition-all border-white/10 bg-white/5 group">
              <div className="relative h-56 bg-muted">
                {dog.avatarPath ? (
                  <img
                    src={dog.avatarPath}
                    alt={dog.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                    <span className="text-4xl">🐕</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant="destructive" className="animate-pulse shadow-lg">
                    LOST
                  </Badge>
                </div>
                {dog.lastSeenLocation?.address && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-2 text-xs text-white truncate flex items-center">
                    <MapPin className="h-3 w-3 mr-1 shrink-0" />
                    {dog.lastSeenLocation.address}
                  </div>
                )}
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{dog.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">{dog.breed}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Gender: <span className="capitalize">{dog.gender}</span></p>
                  <p>Color: {dog.attributes.color || "Unknown"}</p>
                  <p className="text-xs mt-2 pt-2 border-t border-white/10">
                    Last seen: {new Date(dog.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button className="w-full mt-4" variant="secondary">
                  Contact Owner
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LostFoundPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LostFoundContent />
    </Suspense>
  );
}
