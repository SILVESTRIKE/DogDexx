"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, Upload, Download, Play, Pause } from "lucide-react"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

const availableModels = [
  {
    id: "yolov8",
    name: "YOLOv8-Dog-Detector",
    version: "v1.2.0",
    accuracy: "94.2%",
    speed: "125ms",
    status: "active",
  },
  {
    id: "yolov5",
    name: "YOLOv5-Dog-Detector",
    version: "v1.0.0",
    accuracy: "91.8%",
    speed: "98ms",
    status: "inactive",
  },
  {
    id: "resnet",
    name: "ResNet50-Dog-Classifier",
    version: "v2.1.0",
    accuracy: "89.5%",
    speed: "156ms",
    status: "inactive",
  },
]

export default function ModelsPage() {
  const [activeModel, setActiveModel] = useState("yolov8")
  const [models, setModels] = useState(availableModels)

  const handleToggleModel = (modelId: string) => {
    setModels(
      models.map((model) => ({
        ...model,
        status: model.id === modelId ? "active" : "inactive",
      })),
    )
    setActiveModel(modelId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Model Management</h2>
          <p className="text-muted-foreground">Configure and manage AI detection models</p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Model
        </Button>
      </div>

      {/* Active Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Active Model Configuration</CardTitle>
          <CardDescription>Configure the currently active detection model</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Select Model</Label>
              <Select value={activeModel} onValueChange={setActiveModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Confidence Threshold</Label>
              <Input type="number" placeholder="0.75" min="0" max="1" step="0.05" defaultValue="0.75" />
            </div>
            <div className="space-y-2">
              <Label>Max Detections</Label>
              <Input type="number" placeholder="10" min="1" max="50" defaultValue="10" />
            </div>
            <div className="space-y-2">
              <Label>Batch Size</Label>
              <Input type="number" placeholder="1" min="1" max="32" defaultValue="1" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button>Save Configuration</Button>
            <Button variant="outline">Reset to Default</Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Models */}
      <div>
        <h3 className="text-xl font-bold mb-4">Available Models</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <Card key={model.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{model.name}</CardTitle>
                  </div>
                  <Badge variant={model.status === "active" ? "default" : "secondary"}>{model.status}</Badge>
                </div>
                <CardDescription>Version {model.version}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Accuracy</span>
                    <span className="font-medium">{model.accuracy}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Speed</span>
                    <span className="font-medium">{model.speed}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {model.status === "active" ? (
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      <Pause className="h-4 w-4 mr-2" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" className="flex-1" onClick={() => handleToggleModel(model.id)}>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
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
