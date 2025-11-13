import { Request } from 'express';
import { AnalyticsEventModel } from '../models/analytics_event.model';
import { Types } from 'mongoose';
import { AnalyticsEventName } from '../constants/analytics.constants';
import { logger } from '../utils/logger.util';
interface TrackEventArgs {
  eventName: AnalyticsEventName;
  req: Request; 
  eventData?: Record<string, any>; 
}

class AnalyticsService {
  
  public async trackEvent(args: TrackEventArgs): Promise<void> {
    const { eventName, req, eventData } = args;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const query: any = {
        eventName,
        date: today,
      };
      const user = (req as any).user as { _id: Types.ObjectId } | undefined;
      if (user?._id) {
        query.user = user._id;
      } else if ((req as any).fingerprint?.hash) {
        query.fingerprint = (req as any).fingerprint.hash; // Vẫn lưu hash vào DB
      } else {
        logger.warn(`[AnalyticsService] Could not track event '${eventName}' due to missing identifier. Full request fingerprint:`, (req as any).fingerprint);
        return;
      }
      const update = {
        $inc: { count: 1 },
        $setOnInsert: {
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          eventData: eventData || {},
        },
      };
      await AnalyticsEventModel.findOneAndUpdate(query, update, {
        upsert: true,
      });
    } catch (error) {
      logger.error('[AnalyticsService Error] Failed to track event:', {
        eventName,
        error: (error as Error).message,
      });
    }
  }
}
export const analyticsService = new AnalyticsService();