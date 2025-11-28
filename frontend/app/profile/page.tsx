"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/collection-context";
import { ProtectedRoute } from "@/components/protected-route";
import {
  User,
  Mail,
  Lock,
  Trophy,
  Dog,
  ArrowLeft,
  Camera,
  CheckCircle,
  ShieldAlert,
  Sparkles,
  MapPin,
  Settings,
} from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useState, useEffect, useRef, use, useMemo } from "react";
import Link from "next/link";
import { Country } from 'country-state-city';
import { LocationPicker } from "@/components/location-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function ProfileContent() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth();
  const { collectionStats, achievementStats } = useCollection();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC MỚI ĐỂ XỬ LÝ SAU KHI THANH TOÁN ---
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Country/City dropdown state
  const [selectedCountryCode, setSelectedCountryCode] = useState("VN");
  const [selectedCityName, setSelectedCityName] = useState("");

  const allCountries = useMemo(() => Country.getAllCountries(), []);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    country: "",
    city: "",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        username: user.username || "",
        email: user.email || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        country: user.country || "",
        city: user.city || "",
      }));
      
      // Set country code from country name
      if (user.country) {
        const country = allCountries.find(c => c.name === user.country);
        if (country) {
          setSelectedCountryCode(country.isoCode);
        }
      }
      if (user.city) {
        setSelectedCityName(user.city);
      }
    }
  }, [user, allCountries]);

  useEffect(() => {
    const upgradeStatus = searchParams.get("upgrade_status");
    const resultCode = searchParams.get("resultCode");

    if (upgradeStatus === "success" && resultCode === "0") {
      toast.success(t("profile.upgradeSuccessTitle") || "Upgrade Successful!", {
        description:
          t("profile.upgradeSuccessDesc") ||
          "Your account has been upgraded. Please wait a moment for the changes to apply.",
      });
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router, t]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadToast = toast.loading("Đang tải lên ảnh đại diện mới...");

    try {
      const response = await apiClient.updateAvatar(file);
      setUser(response.data.user);
      toast.success("Cập nhật ảnh đại diện thành công!", {
        id: uploadToast as string | number,
      });
    } catch (error: any) {
      toast.error("Tải ảnh lên thất bại", {
        id: uploadToast as string | number,
        description: error.message,
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const formDataToSend = new FormData();

      if (user?.username !== formData.username)
        formDataToSend.append("username", formData.username);
      if (user?.firstName !== formData.firstName)
        formDataToSend.append("firstName", formData.firstName);
      if (user?.lastName !== formData.lastName)
        formDataToSend.append("lastName", formData.lastName);
      if (user?.country !== formData.country)
        formDataToSend.append("country", formData.country);
      if (user?.city !== formData.city)
        formDataToSend.append("city", formData.city);
      if (newAvatar) formDataToSend.append("avatar", newAvatar);

      if (formDataToSend.entries().next().value) {
        const response = await apiClient.updateProfile(formDataToSend);
        setUser(response.data.user);
        toast.success(t("common.success"), { description: response.message });
      }

      setIsEditing(false);
      setNewAvatar(null);
    } catch (error: any) {
      toast.error(t("common.error"), { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error(t("profile.danger.passwordRequired"));
      return;
    }
    setIsDeleting(true);
    try {
      const response = await apiClient.deleteCurrentUser(deletePassword);
      toast.success(response.message);
      setIsDeleteDialogOpen(false);
      logout();
    } catch (error: any) {
      toast.error(t("common.error"), { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden bg-background">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl relative z-10">
        {/* Header Section */}
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            {t("profile.title")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("profile.description")}
          </p>
        </div>

        {/* Main Glass Card Wrapper */}
        <div className="relative group">
          {/* Glow effect behind card */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-[2rem] blur opacity-30 transition duration-500 group-hover:opacity-50"></div>

          {/* Card chính: Đã gộp style vào đây, bỏ div con bên trong để mất khung vuông */}
          <Card className="relative border border-white/10 bg-background/40 backdrop-blur-xl shadow-2xl rounded-3xl md:rounded-[2rem] overflow-hidden p-6 md:p-10">
            {/* Profile Header & Avatar */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-10 border-b border-white/10 pb-10">
              <div className="relative group/avatar">
                <Avatar
                  className="h-32 w-32 md:h-40 md:w-40 cursor-pointer border-4 border-background/50 shadow-xl ring-2 ring-primary/20"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <AvatarImage
                    src={user?.avatarUrl}
                    alt={user?.username}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-5xl font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-[2px]"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera className="h-10 w-10 text-white drop-shadow-md" />
                </div>
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div className="text-center md:text-left space-y-2 flex-1">
                <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                  {user?.username}
                </h2>
                <div className="flex flex-col md:flex-row items-center md:items-start gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {user?.email}
                  </span>
                </div>
                <div className="text-lg font-medium">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
                </div>
                {!isEditing && (user?.city || user?.country) && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/50 text-secondary-foreground text-sm border border-white/10">
                    <MapPin className="h-3.5 w-3.5" />
                    {[user.city, user.country].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 min-w-[200px]">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="w-full bg-secondary/80 hover:bg-secondary text-foreground font-semibold shadow-sm backdrop-blur-md"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {t("profile.account.editButton")}
                  </Button>
                ) : (
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 hover:bg-white/5"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          username: user?.username || "",
                          email: user?.email || "",
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                          firstName: user?.firstName || "",
                          lastName: user?.lastName || "",
                          country: user?.country || "",
                          city: user?.city || "",
                        });
                        setNewAvatar(null);
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-bold shadow-md"
                    >
                      {isSaving ? t("auth.processing") : t("common.save")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3 mb-10">
              {[
                {
                  icon: Dog,
                  label: t("profile.stats.collected"),
                  value: collectionStats?.collectedBreeds ?? 0,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                },
                {
                  icon: Trophy,
                  label: t("profile.stats.achievements"),
                  value: achievementStats?.unlockedAchievements ?? 0,
                  color: "text-amber-500",
                  bg: "bg-amber-500/10",
                },
                {
                  icon: CheckCircle,
                  label: t("profile.stats.completion"),
                  value: `${
                    achievementStats?.totalBreeds &&
                    achievementStats.totalBreeds > 0
                      ? Math.round(
                          (achievementStats.totalCollected /
                            achievementStats.totalBreeds) *
                            100
                        )
                      : 0
                  }%`,
                  color: "text-green-500",
                  bg: "bg-green-500/10",
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/20 transition-all duration-300 flex items-center gap-4"
                >
                  <div
                    className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}
                  >
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Form Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">
                  {t("profile.account.title")}
                </h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">
                    {t("auth.username")}
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    disabled={!isEditing}
                    className="bg-white/5 border-white/10 focus:bg-background/50 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t("profile.account.email")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={!isEditing}
                    className="bg-white/5 border-white/10 focus:bg-background/50 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    {t("auth.firstName")}
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    disabled={!isEditing}
                    className="bg-white/5 border-white/10 focus:bg-background/50 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    {t("auth.lastName")}
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    disabled={!isEditing}
                    className="bg-white/5 border-white/10 focus:bg-background/50 h-11"
                  />
                </div>
                <LocationPicker
                  selectedCountryCode={selectedCountryCode}
                  onCountryChange={(code, name) => {
                    setSelectedCountryCode(code);
                    setFormData(prev => ({ ...prev, country: name, city: "" }));
                    setSelectedCityName("");
                  }}
                  selectedCityName={selectedCityName}
                  onCityChange={(name) => {
                    setSelectedCityName(name);
                    setFormData(prev => ({ ...prev, city: name }));
                  }}
                  disabled={!isEditing}
                  labels={{
                    country: t("profile.account.country"),
                    city: t("profile.account.city")
                  }}
                  selectClassName="flex h-11 w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Password Change Section (Only visible when editing) */}
              {isEditing && (
                <div className="mt-8 pt-8 border-t border-white/10 animate-in fade-in slide-in-from-top-4">
                  <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    {t("profile.password.title")}
                  </h4>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">
                        {t("profile.password.current")}
                      </Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            currentPassword: e.target.value,
                          })
                        }
                        className="bg-white/5 border-white/10 h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">
                        {t("profile.password.new")}
                      </Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            newPassword: e.target.value,
                          })
                        }
                        className="bg-white/5 border-white/10 h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        {t("profile.password.confirm")}
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                        className="bg-white/5 border-white/10 h-11"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Bottom Actions Section */}
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {/* Quick Links */}
          <Card className="bg-background/40 border-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {t("profile.links.title")}
              </CardTitle>
              <CardDescription>
                {t("profile.links.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/dogdex" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 bg-white/5 hover:bg-primary/10 border-white/10 hover:border-primary/50 transition-all group"
                >
                  <Dog className="h-5 w-5 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  {t("profile.links.viewCollection")}
                </Button>
              </Link>
              <Link href="/achievements" className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 bg-white/5 hover:bg-primary/10 border-white/10 hover:border-primary/50 transition-all group"
                >
                  <Trophy className="h-5 w-5 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  {t("profile.links.viewAchievements")}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-destructive/5 border-destructive/20 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-destructive">
                {t("profile.danger.title")}
              </CardTitle>
              <CardDescription>
                {t("profile.danger.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  onClick={logout}
                  className="w-full justify-start h-12 bg-white/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 border-white/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("nav.logout")}
                </Button>
                <Dialog
                  open={isDeleteDialogOpen}
                  onOpenChange={setIsDeleteDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full justify-start h-12 shadow-md hover:shadow-lg transition-all"
                    >
                      <ShieldAlert className="mr-2 h-5 w-5" />
                      {t("profile.danger.deleteAccountButton")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {t("profile.danger.deleteConfirmTitle")}
                      </DialogTitle>
                      <DialogDescription>
                        {t("profile.danger.deleteConfirmDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Label htmlFor="delete-password">
                        {t("profile.danger.passwordConfirmation")}
                      </Label>
                      <Input
                        id="delete-password"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-secondary/50"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteDialogOpen(false)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? t("auth.processing")
                          : t("profile.danger.confirmDeleteButton")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
