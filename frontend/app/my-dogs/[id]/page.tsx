"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { DogProfile, HealthRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/protected-route";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, QrCode } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DogQrCode } from "@/components/DogQrCode";
import { HealthRecordList } from "@/components/HealthRecordList";
import { ReportLostModal } from "@/components/ReportLostModal";
import { DogRadar } from "@/components/DogRadar";
import { useI18n } from "@/lib/i18n-context";

function DogDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n();
  const router = useRouter();
  const { id } = use(params);
  const [dog, setDog] = useState<DogProfile | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMarkingFound, setIsMarkingFound] = useState(false);

  async function fetchData() {
    try {
      const [dogRes, healthRes] = await Promise.all([
        apiClient.getDog(id),
        apiClient.getHealthRecords(id),
      ]);
      setDog(dogRes);
      setHealthRecords(Array.isArray(healthRes) ? healthRes : []);
    } catch (error) {
      console.error("Failed to fetch dog data:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [id]);

  async function handleMarkAsFound() {
    if (!dog) return;
    setIsMarkingFound(true);
    try {
      await apiClient.updateDog(dog.id, { isLost: false });
      setDog({ ...dog, isLost: false });
      toast.success(t("publicDog.messageSent"));
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setIsMarkingFound(false);
    }
  }

  async function deleteDog() {
    if (!confirm(t("common.delete") + "?")) return;
    try {
      await apiClient.deleteDog(id);
      toast.success(t("common.success"));
      router.push("/my-dogs");
    } catch (error) {
      toast.error(t("common.error"));
    }
  }

  if (loading) return <div className="p-8 text-center">{t("common.loading")}</div>;
  if (!dog) return <div className="p-8 text-center">{t("publicDog.dogNotFound")}</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Dog Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="overflow-hidden border-white/10 bg-white/5 sticky top-24">
            <div className="h-64 bg-muted relative">
              {dog.avatarPath ? (
                <img src={dog.avatarUrl || dog.avatarPath} alt={dog.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                  <span className="text-4xl">🐕</span>
                </div>
              )}
            </div>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl">{dog.name}</CardTitle>
                <Badge variant={dog.gender === "male" ? "default" : "secondary"}>
                  {dog.gender}
                </Badge>
              </div>
              <p className="text-muted-foreground">{dog.breed}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground block">{t("publicDog.birthday")}</span>
                  {dog.birthday ? new Date(dog.birthday).toLocaleDateString() : "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block">{t("publicDog.color")}</span>
                  {dog.attributes.color || "N/A"}
                </div>
              </div>

              {/* Lost Status Indicator */}
              {dog.isLost && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2 text-center animate-pulse">
                  <p className="text-red-500 font-bold text-sm flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t("publicDog.dogIsLost").toUpperCase()}
                  </p>
                </div>
              )}

              {/* Report Lost / Mark as Found */}
              {dog.isLost ? (
                <Button
                  variant="secondary"
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleMarkAsFound}
                  disabled={isMarkingFound}
                >
                  {isMarkingFound ? t("common.loading") : "✓ " + t("myDogs.markAsFound")}
                </Button>
              ) : (
                <ReportLostModal
                  dogId={dog.id}
                  dogName={dog.name}
                  dogBreed={dog.breed}
                  dogAttributes={dog.attributes}
                  onSuccess={fetchData}
                />
              )}

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <QrCode className="mr-2 h-4 w-4" /> {t("myDogs.getPetId")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-center">{t("myDogs.petIdCard")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex justify-center py-4">
                    {dog && <DogQrCode shortCode={dog.id} dogName={dog.name} />}
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="ghost" className="w-full text-destructive hover:text-destructive/90" onClick={deleteDog}>
                {t("common.delete")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Health Timeline & More */}
        <div className="lg:col-span-2 space-y-6">
          {/* Radar Section - Only show when dog is lost */}
          {dog.isLost && dog.lastSeenLocation && (
            <DogRadar
              center={[dog.lastSeenLocation.lat, dog.lastSeenLocation.lng]}
              breed={dog.breed}
              sourceType="LOST"
              variant="full"
              showRadiusControls={true}
              showResultsGrid={true}
            />
          )}

          <HealthRecordList dogId={dog.id} records={healthRecords} onUpdate={fetchData} />
        </div>
      </div>
    </div>
  );
}

export default function DogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProtectedRoute>
      <DogDetailContent params={params} />
    </ProtectedRoute>
  );
}
