"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useCollection } from "@/lib/collection-context"
import { ProtectedRoute } from "@/components/protected-route"
import { User, Mail, Lock, Trophy, Dog, ArrowLeft } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { apiClient } from "@/lib/api-client"

function ProfileContent() {
  const { user, logout } = useAuth()
  const { collectionCount, unlockedAchievements } = useCollection()
  const [isEditing, setIsEditing] = useState(false)
  const [totalBreeds, setTotalBreeds] = useState(0)
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const unlockedCount = unlockedAchievements.filter((a) => a.unlocked).length

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const response = await apiClient.getPokedex({ limit: 1 })
        setTotalBreeds(response.total || 0)
      } catch (error) {
        console.error("[v0] Failed to fetch total count:", error)
      }
    }

    fetchTotalCount()
  }, [])

  const handleSave = () => {
    // Update user data in localStorage
    const storedUsers = localStorage.getItem("dogdex_users")
    if (storedUsers && user) {
      const users = JSON.parse(storedUsers)
      const userIndex = users.findIndex((u: any) => u.id === user.id)

      if (userIndex !== -1) {
        users[userIndex] = {
          ...users[userIndex],
          name: formData.name,
          email: formData.email,
        }

        // Update password if provided
        if (formData.newPassword && formData.newPassword === formData.confirmPassword) {
          users[userIndex].password = formData.newPassword
        }

        localStorage.setItem("dogdex_users", JSON.stringify(users))

        // Update current user session
        const updatedUser = {
          id: user.id,
          name: formData.name,
          email: formData.email,
          isAdmin: user.isAdmin,
        }
        localStorage.setItem("dogdex_user", JSON.stringify(updatedUser))
      }
    }

    setIsEditing(false)
    setFormData({ ...formData, currentPassword: "", newPassword: "", confirmPassword: "" })
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
            Back to Home
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account information and preferences</p>
        </div>

        <div className="grid gap-6">
          {/* Profile Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle>{user?.name}</CardTitle>
                  <CardDescription>{user?.email}</CardDescription>
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
                    <p className="text-2xl font-bold">{collectionCount}</p>
                    <p className="text-sm text-muted-foreground">Dogs Collected</p>
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
                    <p className="text-2xl font-bold">{unlockedCount}</p>
                    <p className="text-sm text-muted-foreground">Achievements</p>
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
                      {totalBreeds > 0 ? Math.round((collectionCount / totalBreeds) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">Completion</p>
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
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </div>
                {!isEditing && <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  <User className="h-4 w-4 inline mr-2" />
                  Full Name
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
                  Email Address
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
                    <h4 className="font-semibold mb-4">Change Password</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">
                          <Lock className="h-4 w-4 inline mr-2" />
                          Current Password
                        </Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
                    <Button onClick={handleSave}>Save Changes</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setFormData({
                          name: user?.name || "",
                          email: user?.email || "",
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        })
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>Access your collections and achievements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/pokedex">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Dog className="h-4 w-4 mr-2" />
                  View My Collection
                </Button>
              </Link>
              <Link href="/achievements">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Trophy className="h-4 w-4 mr-2" />
                  View Achievements
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions for your account</CardDescription>
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
