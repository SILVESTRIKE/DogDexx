"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Upload, Download, Play, Pause, Save, RotateCcw } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  getAIConfig,
  updateAIConfig,
  AIConfiguration,
  AIConfigurationUpdatePayload,
  getAIModels,
  activateAIModel,
  AIModel,
} from "@/lib/admin-api"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UploadModelDialog } from "./UploadModelDialog"

export default function ModelsPage() {
  const [config, setConfig] = useState<AIConfiguration | null>(null)
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [configResponse, modelsResponse] = await Promise.all([
        getAIConfig(),
        getAIModels(),
      ])
      setConfig(configResponse.data)
      setModels(modelsResponse)
    } catch (error) {
      toast.error("Failed to fetch AI configuration.", { description: (error as Error).message })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return
    const { name, value } = e.target
    setConfig({
      ...config,
      [name]: name.includes("conf") ? parseFloat(value) : value,
    })
  }

  const handleSelectChange = (name: keyof AIConfiguration, value: string) => {
    if (!config) return
    setConfig({ ...config, [name]: value })
  }

  const handleSave = async (payload?: AIConfigurationUpdatePayload) => {
    const dataToSave = {
      device: config?.device,
      image_conf: config?.image_conf,
      video_conf: config?.video_conf,
      stream_conf: config?.stream_conf,
      stream_high_conf: config?.stream_high_conf,
    }

    setIsSaving(true)
    try {
      await updateAIConfig(dataToSave)
      toast.success("Configuration saved successfully!", {
        description: "The AI service has been instructed to reload the new settings.",
      })
      // Refetch to confirm changes
      await fetchData(false)
    } catch (error) {
      toast.error("Failed to save configuration.", { description: (error as Error).message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleActivateModel = async (modelId: string) => {
    setIsSaving(true)
    try {
      await activateAIModel(modelId)
      toast.success("Model activation successful!", {
        description: "The AI service is reloading with the new model.",
      })
      // Refetch all data to reflect the change
      await fetchData(false)
    } catch (error) {
      toast.error("Failed to activate model.", { description: (error as Error).message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản lý Model & Cấu hình AI</h2>
          <p className="text-muted-foreground">Thiết lập và quản lý các model và tham số của AI service</p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Model
        </Button>
      </div>

      <UploadModelDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onUploadSuccess={() => fetchData(false)}
      />

      {/* Active Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình AI đang hoạt động</CardTitle>
          <CardDescription>Các tham số này sẽ được AI service sử dụng cho tất cả các tác vụ dự đoán.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="model_path">Model Path</Label>
                <Input id="model_path" name="model_path" value={config?.model_path || ""} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device">Device</Label>
                <Select name="device" value={config?.device || "cpu"} onValueChange={(v) => handleSelectChange("device", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpu">CPU</SelectItem>
                    <SelectItem value="cuda">GPU (CUDA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_conf">Image Confidence</Label>
                <Input id="image_conf" name="image_conf" type="number" min="0" max="1" step="0.05" value={config?.image_conf ?? 0.25} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video_conf">Video Confidence</Label>
                <Input id="video_conf" name="video_conf" type="number" min="0" max="1" step="0.05" value={config?.video_conf || 0} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream_conf">Stream Confidence</Label>
                <Input id="stream_conf" name="stream_conf" type="number" min="0" max="1" step="0.05" value={config?.stream_conf || 0} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream_high_conf">Stream High Confidence</Label>
                <Input id="stream_high_conf" name="stream_high_conf" type="number" min="0" max="1" step="0.05" value={config?.stream_high_conf || 0} onChange={handleInputChange} />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button onClick={() => handleSave()} disabled={isSaving || loading}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
            <Button variant="outline" onClick={() => fetchData()} disabled={isSaving || loading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Hoàn tác
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Models */}
      <div>
        <h3 className="text-xl font-bold mb-4">Các Model có sẵn</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Card key={model.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{model.name} ({model.version})</CardTitle>
                  </div>
                  <Badge variant={model.status === "ACTIVE" ? "default" : "secondary"}>
                    {model.status}
                  </Badge>
                </div>
                <CardDescription>Version {model.version}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-medium">N/A</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Speed</span>
                    <span className="font-medium">N/A</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {model.status === "ACTIVE" ? (
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent" disabled>
                      <Pause className="h-4 w-4 mr-2" />
                      Đang hoạt động
                    </Button>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => handleActivateModel(model.id)} disabled={isSaving}>
                      <Play className="h-4 w-4 mr-2" />
                      Kích hoạt
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
