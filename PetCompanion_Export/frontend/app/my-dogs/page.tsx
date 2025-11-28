"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DogProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Dog, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-context";
import { ProtectedRoute } from "@/components/protected-route";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function MyDogsContent() {
  const { t } = useI18n();
  const [dogs, setDogs] = useState<DogProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDogs = async () => {
      try {
        const response = await apiClient.getMyDogs();
        setDogs(response.data);
      } catch (error) {
        console.error("Failed to fetch dogs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDogs();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">My Dogs</h1>
          <p className="text-muted-foreground">Manage your pets and their health records.</p>
        </div>
        <Link href="/my-dogs/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Dog
          </Button>
        </Link>
      </div>

      {dogs.length === 0 ? (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-background p-4 rounded-full mb-4">
              <Dog className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No dogs added yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create a profile for your dog to track their health, vaccines, and keep them safe.
            </p>
            <Link href="/my-dogs/new">
              <Button>Add Your First Dog</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dogs.map((dog) => (
            <Link href={`/my-dogs/${dog.id}`} key={dog.id}>
              <Card className="hover:shadow-lg transition-all cursor-pointer border-white/10 bg-white/5 overflow-hidden group">
                <div className="relative h-48 bg-muted">
                  {dog.avatarPath ? (
                    <img
                      src={dog.avatarPath}
                      alt={dog.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                      <Dog className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                  {dog.isLost && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="destructive" className="animate-pulse">
                        <AlertTriangle className="w-3 h-3 mr-1" /> LOST
                      </Badge>
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl mb-1">{dog.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{dog.breed}</p>
                    </div>
                    {dog.gender === "male" ? (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">Male</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-pink-500/10 text-pink-500 hover:bg-pink-500/20">Female</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {dog.birthday ? new Date(dog.birthday).toLocaleDateString() : "No birthday"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyDogsPage() {
  return (
    <ProtectedRoute>
      <MyDogsContent />
    </ProtectedRoute>
  );
}
