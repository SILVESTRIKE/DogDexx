"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { adminUpdateUser } from "@/lib/admin-api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EnrichedUser } from "@/lib/admin-api"
import { Switch } from "@/components/ui/switch"

interface EditUserDialogProps {
  user: EnrichedUser | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onUserUpdated: () => void
}

export function EditUserDialog({ user, isOpen, onOpenChange, onUserUpdated }: EditUserDialogProps) {
  const [formData, setFormData] = useState({ username: "", email: "", role: "user", status: "pending" })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      })
    }
  }, [user])

  if (!user) return null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    let processedValue = value;
    if (id === 'username') {
      processedValue = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    setFormData((prev) => ({ ...prev, [id]: processedValue }))
  }

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role: value }))
  }

  const handleStatusChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, status: checked ? "active" : "pending" }))
  }

  const handleUpdateUser = async () => {
    setIsSaving(true)
    try {
      await adminUpdateUser(user.id, formData)
      toast.success(`User "${formData.username}" updated successfully.`)
      onUserUpdated()
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to update user.", { description: (error as Error).message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User: {user.name}</DialogTitle>
          <DialogDescription>Update the user's details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">Username</Label>            
            <Input id="username" value={formData.username} onChange={handleInputChange} className="col-span-3" />
            <p className="col-start-2 col-span-3 text-xs text-muted-foreground mt-1">Chỉ chữ thường, số và dấu gạch dưới (_).</p>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">Role</Label>
            <Select value={formData.role} onValueChange={handleRoleChange}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="de">Data Engineer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Đã xác thực
            </Label>
            <Switch id="status" checked={formData.status === "active"} onCheckedChange={handleStatusChange} />
            <span className="col-span-2 text-sm text-muted-foreground">{formData.status === "active" ? "Tài khoản đã được xác thực." : "Tài khoản đang chờ xác thực."}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleUpdateUser} disabled={isSaving}>
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}