import { Request, Response, NextFunction } from "express";
import { PlanService } from "../services/plan.service";
import axios from "axios";
import { logger } from "../utils/logger.util";
import { emailService } from "../services/email.service";
import { BadRequestError } from "../errors";
import { leaderboardService } from "../services/leaderboard.service";
import { transformMediaURLs } from "../utils/media.util";

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    logger.error("[reCAPTCHA] RECAPTCHA_SECRET_KEY is not set in .env file.");
    if (process.env.NODE_ENV === "development") {
      logger.warn(
        "[reCAPTCHA] Skipping reCAPTCHA verification in development mode."
      );
      return true;
    }
    return false;
  }

  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

  try {
    const response = await axios.post(verificationUrl);
    const { success, "error-codes": errorCodes } = response.data;
    if (!success) {
      logger.warn(`[reCAPTCHA] Verification failed: ${errorCodes?.join(", ")}`);
    }
    return success;
  } catch (error) {
    logger.error(`[reCAPTCHA] Error verifying token: ${error}`);
    return false;
  }
}

export const bffPublicController = {
  getPublicPlans: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await PlanService.getPublicPlans();
      res.status(200).json({
        message: "Lấy danh sách gói cước công khai thành công.",
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  },

  getPublicPlanBySlug: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { slug } = req.params;
      const plan = await PlanService.getBySlug(slug);
      res.status(200).json({
        message: `Lấy chi tiết gói cước '${slug}' thành công.`,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  },

  handleContactForm: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email, message, captchaToken } = req.body;
      if (!email || !message || !captchaToken)
        throw new BadRequestError(
          "Email, message, and captchaToken are required."
        );

      const isCaptchaValid = await verifyRecaptcha(captchaToken);
      if (!isCaptchaValid)
        throw new BadRequestError("Invalid CAPTCHA. Please try again.");

      await emailService.sendContactFormEmail({ fromEmail: email, message });
      res
        .status(200)
        .json({ message: "Thank you! Your feedback has been sent." });
    } catch (error) {
      next(error);
    }
  },

  getLeaderboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, value, limit } = req.query;
      const validTypes = ["global", "country", "city"];
      const scope = (type as string) || "global";

      if (!validTypes.includes(scope)) {
        throw new BadRequestError("Loại bảng xếp hạng không hợp lệ.");
      }

      const limitNum = limit ? parseInt(limit as string) : 50;
      const rawData = await leaderboardService.getLeaderboard(
        scope as "global" | "country" | "city",
        value as string,
        limitNum
      );

      const data = rawData.map((entry) => {
        const tempObj = { avatarPath: entry.avatarPath };
        const transformed = transformMediaURLs(req, tempObj);
        return {
          ...entry,
          avatarUrl: transformed.avatarUrl || null,
          avatarPath: undefined,
        };
      });

      res
        .status(200)
        .json({ success: true, scope, filterValue: value || "Global", data });
    } catch (error) {
      next(error);
    }
  },

  getLeaderboardLocations: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { type } = req.query;
      if (type !== "country" && type !== "city")
        throw new BadRequestError("Type phải là country hoặc city");
      const locations = await leaderboardService.getLocations(
        type as "country" | "city"
      );
      res.status(200).json({ success: true, type, data: locations });
    } catch (error) {
      next(error);
    }
  },
};