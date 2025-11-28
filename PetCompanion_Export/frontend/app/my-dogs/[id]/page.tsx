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
import { ArrowLeft, AlertTriangle, Syringe, Stethoscope, Pill, Activity, Plus } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function DogDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [dog, setDog] = useState<DogProfile | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLostLoading, setIsLostLoading] = useState(false);
  
  // Health Form State
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [healthForm, setHealthForm] = useState({
    type: "vaccine",
    title: "",
    date: new Date().toISOString().split('T')[0],
    nextDueDate: "",
    notes: "",
    vetName: "",
  });

  const fetchData = async () => {
    try {
      const [dogRes, healthRes] = await Promise.all([
        apiClient.getDog(id),
        apiClient.getHealthRecords(id),
      ]);
      setDog(dogRes.data);
      setHealthRecords(healthRes.data);
    } catch (error) {
      console.error("Failed to fetch dog data:", error);
      toast.error("Failed to load dog details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const toggleLostStatus = async () => {
    if (!dog) return;
    setIsLostLoading(true);
    try {
      const newStatus = !dog.isLost;
      await apiClient.updateDog(dog.id, { isLost: newStatus });
      setDog({ ...dog, isLost: newStatus });
      toast.success(newStatus ? "Dog reported as LOST!" : "Dog marked as FOUND!");
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsLostLoading(false);
    }
  };

  const handleHealthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.addHealthRecord(id, healthForm);
      toast.success("Health record added");
      setIsHealthModalOpen(false);
      fetchData(); // Refresh list
      // Reset form
      setHealthForm({
        type: "vaccine",
        title: "",
        date: new Date().toISOString().split('T')[0],
        nextDueDate: "",
        notes: "",
        vetName: "",
      });
    } catch (error) {
      toast.error("Failed to add record");
    }
  };

  const deleteDog = async () => {
    if (!confirm("Are you sure you want to delete this profile? This cannot be undone.")) return;
    try {
      await apiClient.deleteDog(id);
      toast.success("Dog profile deleted");
      router.push("/my-dogs");
    } catch (error) {
      toast.error("Failed to delete profile");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!dog) return <div className="p-8 text-center">Dog not found</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link href="/my-dogs" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Dogs
      </Link>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Dog Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="overflow-hidden border-white/10 bg-white/5">
            <div className="h-64 bg-muted relative">
              {dog.avatarPath ? (
                <img src={dog.avatarPath} alt={dog.name} className="w-full h-full object-cover" />
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
                  <span className="text-muted-foreground block">Birthday</span>
                  {dog.birthday ? new Date(dog.birthday).toLocaleDateString() : "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground block">Color</span>
                  {dog.attributes.color || "N/A"}
                </div>
              </div>

              <Button 
                variant={dog.isLost ? "secondary" : "destructive"} 
                className="w-full"
                onClick={toggleLostStatus}
                disabled={isLostLoading}
              >
                {dog.isLost ? (
                  <>Mark as Found</>
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" /> Report Lost
                  </>
                )}
              </Button>
              
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive/90" onClick={deleteDog}>
                Delete Profile
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Health Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Health Timeline</h2>
            <Dialog open={isHealthModalOpen} onOpenChange={setIsHealthModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Add Record
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Health Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleHealthSubmit} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select 
                        value={healthForm.type} 
                        onValueChange={(val) => setHealthForm({...healthForm, type: val})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vaccine">Vaccine</SelectItem>
                          <SelectItem value="checkup">Checkup</SelectItem>
                          <SelectItem value="medicine">Medicine</SelectItem>
                          <SelectItem value="surgery">Surgery</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input 
                        type="date" 
                        required
                        value={healthForm.date}
                        onChange={(e) => setHealthForm({...healthForm, date: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      placeholder="e.g. Rabies Shot" 
                      required
                      value={healthForm.title}
                      onChange={(e) => setHealthForm({...healthForm, title: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Vet Name (Optional)</Label>
                    <Input 
                      placeholder="e.g. Dr. Smith"
                      value={healthForm.vetName}
                      onChange={(e) => setHealthForm({...healthForm, vetName: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Next Due Date (Optional)</Label>
                    <Input 
                      type="date"
                      value={healthForm.nextDueDate}
                      onChange={(e) => setHealthForm({...healthForm, nextDueDate: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea 
                      placeholder="Any side effects or instructions..."
                      value={healthForm.notes}
                      onChange={(e) => setHealthForm({...healthForm, notes: e.target.value})}
                    />
                  </div>

                  <Button type="submit" className="w-full">Save Record</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {healthRecords.length === 0 ? (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No health records yet. Keep track of vaccines and checkups here.
                </CardContent>
              </Card>
            ) : (
              healthRecords.map((record) => (
                <Card key={record.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-4 flex gap-4">
                    <div className={`p-3 rounded-full h-fit ${
                      record.type === 'vaccine' ? 'bg-blue-500/20 text-blue-500' :
                      record.type === 'checkup' ? 'bg-green-500/20 text-green-500' :
                      record.type === 'medicine' ? 'bg-purple-500/20 text-purple-500' :
                      'bg-gray-500/20 text-gray-500'
                    }`}>
                      {record.type === 'vaccine' && <Syringe className="h-5 w-5" />}
                      {record.type === 'checkup' && <Stethoscope className="h-5 w-5" />}
                      {record.type === 'medicine' && <Pill className="h-5 w-5" />}
                      {(record.type === 'surgery' || record.type === 'other') && <Activity className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-lg">{record.title}</h4>
                        <span className="text-sm text-muted-foreground">
                          {new Date(record.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {record.vetName && <span className="mr-3">👨‍⚕️ {record.vetName}</span>}
                        {record.nextDueDate && (
                          <span className="text-amber-500">
                            📅 Due: {new Date(record.nextDueDate).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                      {record.notes && (
                        <p className="text-sm mt-2 bg-black/20 p-2 rounded">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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
