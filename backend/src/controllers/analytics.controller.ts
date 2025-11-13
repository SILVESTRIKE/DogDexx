import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { AnalyticsEventName } from '../constants/analytics.constants';

export const trackVisit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await analyticsService.trackEvent({
      eventName: AnalyticsEventName.PAGE_VISIT,
      req,
      eventData: { page: req.body.page || "unknown" }
    });

    res.status(200).json({ message: "Visit tracked successfully" });
  } catch (error) {
    next(error);
  }
};

export const trackEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventName, eventData } = req.body;
    
    if (!Object.values(AnalyticsEventName).includes(eventName)) {
        return res.status(400).json({ message: "Invalid event name provided." });
    }

    await analyticsService.trackEvent({ eventName, req, eventData });

    res.status(200).json({ message: "Event tracked" });
  } catch (error) {
    next(error);
  }
};