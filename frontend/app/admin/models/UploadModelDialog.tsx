"use client"

import { useState, ChangeEvent, FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner" 
import { adminUploadModel } from "@/lib/admin-api"

interface UploadModelDialogProps {
  isOpen: boolean
  onClose: () => void
  onUploadSuccess: () => void
}

export function UploadModelDialog({ isOpen, onClose, onUploadSuccess }: UploadModelDialogProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    version: "1.0.0",
    description: "",
    path: "",
    taskType: "DOG_BREED_CLASSIFICATION",
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      // Auto-fill path based on filename
      if (!formData.path) {
        setFormData((prev) => ({ ...prev, path: `models/${selectedFile.name}` }))
      }
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error("Please select a model file to upload.")
      return
    }

    setIsUploading(true)
    try {
      const apiFormData = new FormData()

      apiFormData.append("modelFile", file)
      Object.entries(formData).forEach(([key, value]) => {
        apiFormData.append(key, value)
      })

      await adminUploadModel(apiFormData)

      toast.success("Model uploaded successfully!", {
        description: "The new model is now available in the list.",
      })
      onUploadSuccess()
      onClose()
    } catch (error) {
      toast.error("Upload failed.", { description: (error as Error).message })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload New AI Model</DialogTitle>
          <DialogDescription>
            Provide the model file (.pt) and its metadata. The file will be uploaded to Hugging Face.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="version" className="text-right">Version</Label>
            <Input id="version" name="version" value={formData.version} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="path" className="text-right">HF Path</Label>
            <Input id="path" name="path" placeholder="e.g., models/yolov8_v2.pt" value={formData.path} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="modelFile" className="text-right">Model File</Label>
            <Input id="modelFile" name="modelFile" type="file" accept=".pt" onChange={handleFileChange} className="col-span-3" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload and Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}