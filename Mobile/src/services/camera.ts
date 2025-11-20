import { Camera } from 'react-native-vision-camera'

export interface CameraFrame {
  base64: string
  width: number
  height: number
}

export class CameraService {
  private cameraRef: Camera | null = null

  setCameraRef(ref: Camera) {
    this.cameraRef = ref
  }

  async captureFrame(): Promise<CameraFrame | null> {
    if (!this.cameraRef) {
      console.warn("[Camera] Camera reference not set")
      return null
    }

    try {
      const photo = await this.cameraRef.takePhoto({
        // qualityPrioritization: 'speed',
        flash: 'off',
      })

      // Convert file URI to base64
      const base64 = await this.convertToBase64(photo.path)

      return {
        base64,
        width: photo.width,
        height: photo.height,
      }
    } catch (error) {
      console.error("[Camera] Error capturing frame:", error)
      return null
    }
  }

  private async convertToBase64(filePath: string): Promise<string> {
    const RNFS = require('react-native-fs')
    try {
      const base64 = await RNFS.readFile(filePath, 'base64')
      return base64
    } catch (error) {
      console.error("[Camera] Error converting to base64:", error)
      return ""
    }
  }
}

export const cameraService = new CameraService()