"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useCollection } from "@/lib/collection-context"
import { ProtectedRoute } from "@/components/protected-route"
import { User, Mail, Lock, Trophy, Dog, ArrowLeft, Camera, CheckCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

function ProfileContent() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth()
  const { collectionStats, achievementStats } = useCollection()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newAvatar, setNewAvatar] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  })

  useEffect(() => {
    // Update form data when user object is available or changes
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username || "",
        email: user.email || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      }));
    }
  }, [user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return;

    const uploadToast = toast.loading("Đang tải lên ảnh đại diện mới...");

    try {
      // Gọi API để tải ảnh lên ngay lập tức
      const response = await apiClient.updateAvatar(file);

      // Cập nhật context với dữ liệu user mới từ server
      setUser(response.data.user);

      toast.success("Cập nhật ảnh đại diện thành công!", { id: uploadToast as string | number });
    } catch (error: any) {
      toast.error("Tải ảnh lên thất bại", {
        id: uploadToast as string | number,
        description: error.message,
      });
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const formDataToSend = new FormData()

      // Chỉ thêm những trường có thay đổi vào FormData
      if (user?.username !== formData.username) {
        formDataToSend.append('username', formData.username)
      }
      if (user?.firstName !== formData.firstName) {
        formDataToSend.append('firstName', formData.firstName)
      }
      if (user?.lastName !== formData.lastName) {
        formDataToSend.append('lastName', formData.lastName)
      }

      // Thêm avatar mới nếu có
      if (newAvatar) {
        formDataToSend.append('avatar', newAvatar)
      }

      // Chỉ gọi API nếu có gì đó để cập nhật
      if (formDataToSend.entries().next().value) {
        const response = await apiClient.updateProfile(formDataToSend)
        setUser(response.data.user) // Cập nhật user trong context với dữ liệu mới từ server
        toast.success(t("common.success"), { description: response.message })
      }

      setIsEditing(false)
      setNewAvatar(null) // Reset avatar mới sau khi lưu
    } catch (error: any) {
      toast.error(t("common.error"), { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  // Xử lý trường hợp user bị null trong quá trình logout để tránh lỗi render
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Đang đăng xuất...</p>
      </div>
    );
  }
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('profile.title')}</h1>
          <p className="text-muted-foreground">{t('profile.description')}</p>
        </div>

        <div className="grid gap-6">
          {/* Profile Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-20 w-20 cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <AvatarImage src={user?.avatarUrl} alt={user?.username} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-3xl" key={user?.username}>
                      {user?.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => avatarInputRef.current?.click()}>
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                  <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{user?.username}</CardTitle>
                  <CardDescription>{user?.email}</CardDescription>
                  <CardDescription>{user?.firstName} {user?.lastName}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Dog className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{collectionStats?.collectedBreeds ?? 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.collected')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-chart-4/10 rounded-lg">
                    <Trophy className="h-6 w-6 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{achievementStats?.unlockedAchievements ?? 0}</p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.achievements')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-chart-1/10 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-chart-1" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {achievementStats?.totalBreeds && achievementStats.totalBreeds > 0 ? Math.round((achievementStats.totalCollected / achievementStats.totalBreeds) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">{t('profile.stats.completion')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('profile.account.title')}</CardTitle>
                  <CardDescription>{t('profile.account.description')}</CardDescription>
                </div>
                {!isEditing && <Button onClick={() => setIsEditing(true)}>{t('profile.account.editButton')}</Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">
                  <User className="h-4 w-4 inline mr-2" />
                  {t('auth.username')}
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("auth.firstName")}</Label>
                  <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("auth.lastName")}</Label>
                  <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} disabled={!isEditing} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="h-4 w-4 inline mr-2" />
                  {t('profile.account.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              {isEditing && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-4">{t('profile.password.title')}</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">
                          <Lock className="h-4 w-4 inline mr-2" />
                          {t('profile.password.current')}
                        </Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">{t('profile.password.new')}</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('profile.password.confirm')}</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSave} disabled={isSaving}>{isSaving ? t('auth.processing') : t('common.save')}</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setFormData({
                          username: user?.username || "",
                          email: user?.email || "",
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                          firstName: user?.firstName || "",
                          lastName: user?.lastName || "",
                        })
                        setNewAvatar(null) // Hủy cả thay đổi avatar
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.links.title')}</CardTitle>
              <CardDescription>{t('profile.links.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/pokedex">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Dog className="h-4 w-4 mr-2" />
                  {t('profile.links.viewCollection')}
                </Button>
              </Link>
              <Link href="/achievements">
                <Button variant="outline" className="w-full justify-start bg-transparent mt-4">
                  <Trophy className="h-4 w-4 mr-2" />
                  {t('profile.links.viewAchievements')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">{t('profile.danger.title')}</CardTitle>
              <CardDescription>{t('profile.danger.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={logout}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  )
}
