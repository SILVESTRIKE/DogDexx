export class WebSocketService {
  private ws: WebSocket | null = null
  private messageHandlers: ((data: any) => void)[] = []
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000

  async connect(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          console.log("[WebSocket] Connected")
          this.reconnectAttempts = 0
          resolve(this.ws!)
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.messageHandlers.forEach((handler) => handler(data))
          } catch (error) {
            console.error("[WebSocket] Error parsing message:", error)
          }
        }

        this.ws.onerror = (error) => {
          console.error("[WebSocket] Error:", error)
          reject(error)
        }

        this.ws.onclose = () => {
          console.log("[WebSocket] Connection closed")
          this.ws = null
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  onMessage(handler: (data: any) => void) {
    this.messageHandlers.push(handler)
  }

  send(data: string | ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }

  close(code = 1000, reason = "Client close") {
    if (this.ws) {
      this.ws.close(code, reason)
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

export const wsService = new WebSocketService()
