import WebSocket from 'ws';
import { logger } from './logger.util';

/**
 * PredictionNotifier - Manages WebSocket connections for prediction status updates.
 * Allows clients to subscribe to specific prediction IDs and receive push notifications
 * when the prediction is complete, eliminating the need for polling.
 */
class PredictionNotifier {
    // Map: predictionId -> Set of WebSocket connections
    private subscriptions: Map<string, Set<WebSocket>> = new Map();

    /**
     * Subscribe a WebSocket connection to receive updates for a specific prediction.
     */
    subscribe(predictionId: string, ws: WebSocket): void {
        if (!this.subscriptions.has(predictionId)) {
            this.subscriptions.set(predictionId, new Set());
        }
        this.subscriptions.get(predictionId)!.add(ws);
        logger.debug(`[PredictionNotifier] Client subscribed to ${predictionId}`);
    }

    /**
     * Unsubscribe a WebSocket from a prediction.
     */
    unsubscribe(predictionId: string, ws: WebSocket): void {
        const subs = this.subscriptions.get(predictionId);
        if (subs) {
            subs.delete(ws);
            if (subs.size === 0) {
                this.subscriptions.delete(predictionId);
            }
        }
    }

    /**
     * Remove a WebSocket from all subscriptions (e.g., on disconnect).
     */
    removeConnection(ws: WebSocket): void {
        for (const [predictionId, subs] of this.subscriptions.entries()) {
            subs.delete(ws);
            if (subs.size === 0) {
                this.subscriptions.delete(predictionId);
            }
        }
    }

    /**
     * Notify all subscribers of a prediction that it has completed/failed.
     */
    notify(predictionId: string, event: 'completed' | 'failed' | 'progress', data: any): void {
        const subs = this.subscriptions.get(predictionId);
        if (!subs || subs.size === 0) {
            return; // No subscribers for this prediction
        }

        const message = JSON.stringify({ event, predictionId, ...data });

        for (const ws of subs) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
                logger.debug(`[PredictionNotifier] Sent ${event} to client for ${predictionId}`);
            }
        }

        // If completed or failed, auto-cleanup subscriptions
        if (event === 'completed' || event === 'failed') {
            this.subscriptions.delete(predictionId);
        }
    }
}

// Singleton instance
export const predictionNotifier = new PredictionNotifier();
