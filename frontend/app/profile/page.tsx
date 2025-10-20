"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useCollection } from "@/lib/collection-context"
import { ProtectedRoute } from "@/components/protected-route"
import { User, Mail, Lock, Trophy, Dog, ArrowLeft, Camera } from "lucide-react"
import { useI18n } from "@/lib/i18n-context"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

function ProfileContent() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth()
  const { collectionStats, achievementStats } = useCollection()
  const { toast } = useToast()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [totalBreeds, setTotalBreeds] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [newAvatar, setNewAvatar] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    // Update form data when user object is available or changes
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.username || "",
        email: user.email || "",
      }));
    }
    const fetchTotalCount = async () => {
      try {
        const response = await apiClient.getPokedex({ limit: 1 })
        setTotalBreeds(response.total || 0)
      } catch (error) {
        console.error("[v0] Failed to fetch total count:", error)
      }
    }

    fetchTotalCount()
  }, [user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewAvatar(file)
    // Tạm thời hiển thị ảnh mới để người dùng thấy ngay lập tức
    const reader = new FileReader()
    reader.onloadend = () => {
      setUser(prevUser => prevUser ? { ...prevUser, avatarUrl: reader.result as string } : null)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const formDataToSend = new FormData()

      // Chỉ thêm những trường có thay đổi vào FormData
      if (user?.username !== formData.name) {
        formDataToSend.append('username', formData.name)
      }
      // Thêm firstName, lastName nếu có

      // Thêm avatar mới nếu có
      if (newAvatar) {
        formDataToSend.append('avatar', newAvatar)
      }

      // Chỉ gọi API nếu có gì đó để cập nhật
      if (formDataToSend.entries().next().value) {
        const response = await apiClient.updateProfile(formDataToSend)
        setUser(response.data) // Cập nhật user trong context với dữ liệu mới từ server
        toast({ title: t("common.success"), description: response.message })
      }

      setIsEditing(false)
      setNewAvatar(null) // Reset avatar mới sau khi lưu
    } catch (error: any) {
      toast({ variant: "destructive", title: t("common.error"), description: error.message })
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
      <header className="border-b-2 border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('profile.backToHome')}
          </Link>
        </div>
      </header>

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
                  <div className="p-3 bg-secondary/10 rounded-lg">
                    <Trophy className="h-6 w-6 text-secondary" />
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
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <Trophy className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {totalBreeds > 0 ? Math.round(((collectionStats?.collectedBreeds ?? 0) / totalBreeds) * 100) : 0}%
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
                <Label htmlFor="name">
                  <User className="h-4 w-4 inline mr-2" />
                  {t('profile.account.name')}
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                />
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
                          name: user?.username || "",
                          email: user?.email || "",
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
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
                <Button variant="outline" className="w-full justify-start bg-transparent">
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
