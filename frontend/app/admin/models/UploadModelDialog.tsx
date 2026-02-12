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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// --- Định nghĩa các tùy chọn cho Select Dropdowns ---
const TASK_TYPE_OPTIONS = [
  { value: "DOG_BREED_CLASSIFICATION", label: "Dog Breed Classification" },
  { value: "CAT_BREED_CLASSIFICATION", label: "Cat Breed Classification" },
  { value: "OBJECT_DETECTION", label: "Object Detection" },
]

const FORMAT_OPTIONS = [
  { value: "PYTORCH", label: "PyTorch (.pt)" },
  { value: "ONNX", label: "ONNX" },
  { value: "TENSORFLOW_JS", label: "TensorFlow.js" },
]

export function UploadModelDialog({ isOpen, onClose, onUploadSuccess }: UploadModelDialogProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  // Cập nhật state để chứa tất cả các trường trong Mongoose model
  const [formData, setFormData] = useState({
    name: "",
    version: "1.0.0",
    description: "",
    taskType: "DOG_BREED_CLASSIFICATION",
    format: "PYTORCH",
    fileName: "",
    path: "",
    labelsFileName: "labels.json",
    tags: "",
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      
      setFormData((prev) => ({
        ...prev,
        fileName: selectedFile.name,
        path: 'models/' + selectedFile.name,
      }))
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error("Vui lòng chọn một file model để tải lên.")
      return
    }

    setIsUploading(true)
    try {
      const apiFormData = new FormData()
      
      apiFormData.append("modelFile", file)

      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);

      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'tags') return;
        apiFormData.append(key, value);
      });
      if (tagsArray.length > 0) {
        apiFormData.append('tags', JSON.stringify(tagsArray));
      }

      await adminUploadModel(apiFormData)

      toast.success("Tải lên model thành công!", {
        description: "Model mới đã có trong danh sách.",
      })
      onUploadSuccess()
      onClose()
    } catch (error) {
      toast.error("Tải lên thất bại.", { description: (error as Error).message })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload New AI Model</DialogTitle>
          <DialogDescription>
            Cung cấp file model và metadata. File sẽ được tải lên Hugging Face.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="version" className="text-right">Version</Label>
            <Input id="version" name="version" value={formData.version} onChange={handleInputChange} className="col-span-3" required />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskType" className="text-right">Task Type</Label>
            <Select name="taskType" value={formData.taskType} onValueChange={(value) => handleSelectChange('taskType', value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="format" className="text-right">Format</Label>
            <Select name="format" value={formData.format} onValueChange={(value) => handleSelectChange('format', value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fileName" className="text-right">File Name</Label>
            <Input id="fileName" name="fileName" placeholder="Auto-filled from file" value={formData.fileName} onChange={handleInputChange} className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="path" className="text-right">Path in Repo</Label>
            <Input id="path" name="path" placeholder="e.g., models/best.pt" value={formData.path} onChange={handleInputChange} className="col-span-3" required />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="labelsFileName" className="text-right">Labels File</Label>
            <Input id="labelsFileName" name="labelsFileName" value={formData.labelsFileName} onChange={handleInputChange} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">Tags</Label>
            <Input id="tags" name="tags" placeholder="yolov8, classification, ..." value={formData.tags} onChange={handleInputChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} className="col-span-3" />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="modelFile" className="text-right">Model File</Label>
            <Input id="modelFile" name="modelFile" type="file" accept=".pt,.onnx" onChange={handleFileChange} className="col-span-3" required />
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? "Đang tải lên..." : "Tải lên và Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}