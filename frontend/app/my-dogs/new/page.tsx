"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProtectedRoute } from "@/components/protected-route";
import { toast } from "sonner";
import { ArrowLeft, Upload, Dog, Palette, Calendar, Ruler, Sparkles, CheckCircle2, ImagePlus, Loader2, ScanFace, Dna } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n-context";

// --- Background Component ---
function BackgroundGrid() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute right-0 top-0 -z-10 m-auto h-[500px] w-[500px] rounded-full bg-primary/5 opacity-50 blur-[100px]"></div>
    </div>
  );
}

function NewDogContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    breed: "",
    birthday: "",
    gender: "male",
    color: "",
    pattern: "",
    size: "Medium",
    sterilized: false,
    avatarPath: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [isCustomColor, setIsCustomColor] = useState(false);

  useEffect(function () {
    async function fetchBreedColors() {
      if (!formData.breed) return;

      const slug = formData.breed.trim().replace(/[\s-]+/g, '_');
      try {
        const response = await apiClient.getBreedBySlug(slug, locale as 'vi' | 'en');
        const breedObj = response?.breed;

        if (breedObj && breedObj.coat_colors && breedObj.coat_colors.length > 0) {
          setAvailableColors(breedObj.coat_colors);
        } else {
          setAvailableColors([]);
        }
      } catch (err) {
        setAvailableColors([]);
      }
    }

    const timeout = setTimeout(fetchBreedColors, 500);
    return function () { clearTimeout(timeout); };
  }, [formData.breed, locale]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setFormData(function (prev) { return { ...prev, avatarPath: objectUrl }; });

    setAnalyzing(true);
    try {
      const result = await apiClient.analyzeDogImage(file);
      if (result && result.predictions && result.predictions.length > 0) {
        const topPrediction = result.predictions[0];
        const slug = topPrediction.class;

        let breedDisplayName = slug.replace(/_/g, ' ');

        try {
          const response = await apiClient.getBreedBySlug(slug, locale as 'vi' | 'en');
          const breedObj = response?.breed;

          if (breedObj) {
            if (breedObj.coat_colors && breedObj.coat_colors.length > 0) {
              setAvailableColors(breedObj.coat_colors);
            }
          }
        } catch (e) {
          console.warn("Could not fetch breed details for slug:", slug);
        }

        setFormData(function (prev) {
          return {
            ...prev,
            breed: breedDisplayName,
          };
        });
        toast.success(t("newDog.identifiedAs", { breed: breedDisplayName, confidence: (topPrediction.confidence * 100).toFixed(1) }));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("newDog.analysisFailed"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      if (selectedFile) formDataToSend.append("file", selectedFile);
      formDataToSend.append("name", formData.name);
      formDataToSend.append("breed", formData.breed);
      formDataToSend.append("gender", formData.gender);
      if (formData.birthday) formDataToSend.append("birthday", new Date(formData.birthday).toISOString());
      formDataToSend.append("sterilized", String(formData.sterilized));
      formDataToSend.append("attributes[color]", formData.color || "");
      formDataToSend.append("attributes[pattern]", formData.pattern || "");
      formDataToSend.append("attributes[size]", formData.size || "");

      await apiClient.createDog(formDataToSend);
      toast.success(t("newDog.successMessage"));
      router.push("/my-dogs");
    } catch (error: any) {
      toast.error(t("newDog.failedMessage"), {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative bg-background selection:bg-primary/20">
      <BackgroundGrid />

      <div className="container mx-auto px-4 py-8 max-w-3xl relative z-10">
        {/* Navigation */}
        <Link
          href="/my-dogs"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-6 group"
        >
          <div className="bg-muted group-hover:bg-primary/10 p-2 rounded-full mr-2 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </div>
          {t("newDog.backToMyDogs")}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
            {t("newDog.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("newDog.subtitle")}
          </p>
        </div>

        <Card className="border-0 shadow-2xl bg-card/60 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Dog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t("newDog.basicInfo")}</CardTitle>
                <CardDescription>{t("newDog.uploadToDetect")}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* AI SCANNER SECTION */}
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="dog-photo"
                  onChange={handleFileChange}
                  disabled={analyzing}
                />
                <Label
                  htmlFor="dog-photo"
                  className={cn(
                    "relative flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden bg-muted/20 hover:bg-muted/40",
                    analyzing ? "border-primary/50 cursor-wait" : "border-muted-foreground/20 hover:border-primary/50"
                  )}
                >
                  {/* Image Preview or Placeholder */}
                  {formData.avatarPath ? (
                    <div className="absolute inset-0 w-full h-full">
                      <img src={formData.avatarPath} alt="Preview" className="w-full h-full object-cover" />
                      {analyzing && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground group-hover:text-primary transition-colors z-10">
                      <div className="p-4 bg-background rounded-full shadow-lg group-hover:scale-110 transition-transform">
                        <ImagePlus className="h-8 w-8" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-lg">{t("newDog.clickToUpload")}</p>
                        <p className="text-xs text-muted-foreground/70">{t("newDog.fileSupport")}</p>
                      </div>
                    </div>
                  )}

                  {/* Analyzing Overlay */}
                  {analyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20">
                      <div className="relative">
                        <ScanFace className="h-12 w-12 animate-pulse text-primary" />
                        <motion.div
                          className="absolute -inset-4 border border-primary/50 rounded-full"
                          animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </div>
                      <p className="mt-4 font-bold tracking-widest text-sm animate-pulse">{t("newDog.analyzing")}</p>
                    </div>
                  )}

                  {/* Change Button (hover) */}
                  {formData.avatarPath && !analyzing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full flex items-center gap-2 font-medium">
                        <Upload className="h-4 w-4" /> {t("newDog.changePhoto")}
                      </div>
                    </div>
                  )}
                </Label>
              </div>

              {/* FORM FIELDS */}
              <div className="grid md:grid-cols-2 gap-6">

                {/* NAME */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Dog className="h-3 w-3" /> {t("newDog.name")}
                  </Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={function (e) { setFormData({ ...formData, name: e.target.value }); }}
                    placeholder={t("newDog.namePlaceholder")}
                    className="h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background transition-all"
                  />
                </div>

                {/* GENDER */}
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    {t("newDog.gender")}
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={function (value: string) { setFormData({ ...formData, gender: value }); }}
                  >
                    <SelectTrigger className="h-11 bg-muted/30 border-muted-foreground/20">
                      <SelectValue placeholder={t("newDog.selectGender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("newDog.male")}</SelectItem>
                      <SelectItem value="female">{t("newDog.female")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* BREED (AI Powered) */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="breed" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1.5"><Dna className="h-3 w-3" /> {t("newDog.breed")}</span>
                    {formData.breed && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Sparkles className="h-2 w-2" /> {t("newDog.aiSuggestion")}</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id="breed"
                      required
                      value={formData.breed}
                      onChange={function (e) { setFormData({ ...formData, breed: e.target.value }); }}
                      placeholder={t("newDog.breedPlaceholder")}
                      className={cn(
                        "h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background transition-all",
                        formData.breed && "border-green-500/30 bg-green-50/30"
                      )}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("newDog.breedHint")}
                  </p>
                </div>

                {/* BIRTHDAY */}
                <div className="space-y-2">
                  <Label htmlFor="birthday" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> {t("newDog.birthday")}
                  </Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={function (e) { setFormData({ ...formData, birthday: e.target.value }); }}
                    className="h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background"
                  />
                </div>

                {/* SIZE */}
                <div className="space-y-2">
                  <Label htmlFor="size" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Ruler className="h-3 w-3" /> {t("newDog.size")}
                  </Label>
                  <Select
                    value={formData.size}
                    onValueChange={function (value: string) { setFormData({ ...formData, size: value }); }}
                  >
                    <SelectTrigger className="h-11 bg-muted/30 border-muted-foreground/20">
                      <SelectValue placeholder={t("newDog.selectSize")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Small">{t("newDog.sizeSmall")}</SelectItem>
                      <SelectItem value="Medium">{t("newDog.sizeMedium")}</SelectItem>
                      <SelectItem value="Large">{t("newDog.sizeLarge")}</SelectItem>
                      <SelectItem value="Giant">{t("newDog.sizeGiant")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* COLOR */}
                <div className="space-y-2">
                  <Label htmlFor="color" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Palette className="h-3 w-3" /> {t("newDog.color")}
                  </Label>
                  {availableColors.length > 0 && !isCustomColor ? (
                    <Select
                      value={formData.color}
                      onValueChange={function (value: string) {
                        if (value === "other_custom") {
                          setIsCustomColor(true);
                          setFormData({ ...formData, color: "" });
                        } else {
                          setFormData({ ...formData, color: value });
                        }
                      }}
                    >
                      <SelectTrigger className="h-11 bg-muted/30 border-muted-foreground/20">
                        <SelectValue placeholder={t("newDog.selectColor")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColors.map(function (c) {
                          return <SelectItem key={c} value={c}>{c}</SelectItem>;
                        })}
                        <SelectItem value="other_custom" className="font-semibold text-primary">
                          {t("newDog.otherColor")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="color"
                        value={formData.color}
                        onChange={function (e) { setFormData({ ...formData, color: e.target.value }); }}
                        placeholder={t("newDog.colorPlaceholder")}
                        className="h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background"
                      />
                      {availableColors.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={function () {
                            setIsCustomColor(false);
                            setFormData({ ...formData, color: "" });
                          }}
                          className="h-11 w-11"
                          title={t("newDog.backToList")}
                        >
                          <span className="text-xl">×</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* PATTERN */}
                <div className="space-y-2">
                  <Label htmlFor="pattern" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    {t("newDog.pattern")}
                  </Label>
                  <Input
                    id="pattern"
                    value={formData.pattern}
                    onChange={function (e) { setFormData({ ...formData, pattern: e.target.value }); }}
                    placeholder={t("newDog.patternPlaceholder")}
                    className="h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background"
                  />
                </div>

              </div>

              {/* STERILIZED CHECKBOX */}
              <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 flex items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={function () { setFormData({ ...formData, sterilized: !formData.sterilized }); }}>
                <div className={cn("h-5 w-5 rounded border flex items-center justify-center transition-colors", formData.sterilized ? "bg-primary border-primary" : "border-gray-400 bg-transparent")}>
                  {formData.sterilized && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                </div>
                <input
                  type="checkbox"
                  id="sterilized"
                  checked={formData.sterilized}
                  onChange={function (e) { setFormData({ ...formData, sterilized: e.target.checked }); }}
                  className="hidden"
                />
                <div className="flex-1">
                  <Label htmlFor="sterilized" className="font-semibold cursor-pointer">{t("newDog.sterilized")}</Label>
                  <p className="text-xs text-muted-foreground">{t("newDog.sterilizedHint")}</p>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 rounded-xl transition-all hover:scale-[1.01]"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("newDog.creatingProfile")}</>
                ) : (
                  t("newDog.createProfile")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NewDogPage() {
  return (
    <ProtectedRoute>
      <NewDogContent />
    </ProtectedRoute>
  );
}
