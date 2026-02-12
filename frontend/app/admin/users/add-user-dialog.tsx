"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"
import { adminCreateUser } from "@/lib/admin-api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface AddUserDialogProps {
  onUserAdded: () => void
}

export function AddUserDialog({ onUserAdded }: AddUserDialogProps) {
  const initialFormState = {
    username: "",
    email: "",
    password: "",
    role: "user",
    verify: "pending",
  }
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState(initialFormState)
  const [isSaving, setIsSaving] = useState(false)

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
    setFormData((prev) => ({ ...prev, verify: checked ? "active" : "pending" }))
  }

  const resetForm = () => {
    setFormData(initialFormState)
  }

  const handleAddUser = async () => {
    const { username, email, password, role, verify } = formData
    if (!username || !email || !password || !role) {
      toast.error("Please fill in all fields.")
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email address.")
      return
    }

    setIsSaving(true)
    try {
      await adminCreateUser({ username, email, password, role, verify })
      toast.success(`User "${username}" created successfully.`)
      onUserAdded() 
      setIsOpen(false) 
    } catch (error) {
      toast.error("Failed to create user.", { description: (error as Error).message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm() }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Thêm người dùng
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thêm người dùng mới</DialogTitle>
          <DialogDescription>Điền thông tin để tạo tài khoản mới.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">Username</Label>
            <div className="col-span-3">
              <Input id="username" value={formData.username} onChange={handleInputChange} />
              <p className="text-xs text-muted-foreground mt-1">Chỉ chữ thường, số và dấu gạch dưới (_).</p>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={handleInputChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">Password</Label>
            <Input id="password" type="password" value={formData.password} onChange={handleInputChange} className="col-span-3" />
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
            <Switch id="status" checked={formData.verify === "active"} onCheckedChange={handleStatusChange} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleAddUser} disabled={isSaving}>
            {isSaving ? "Đang tạo..." : "Tạo người dùng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}