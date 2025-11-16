import { Request, Response, NextFunction } from 'express';
import { PlanService } from '../services/plan.service';
import axios from 'axios';
import { logger } from '../utils/logger.util';
import { emailService } from '../services/email.service';
import { BadRequestError } from '../errors';

/**
 * Xác thực token reCAPTCHA từ Google.
 * @param token Token từ client
 * @returns boolean
 */
async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    logger.error('[reCAPTCHA] RECAPTCHA_SECRET_KEY is not set in .env file.');
    // Trong môi trường dev, có thể bỏ qua reCAPTCHA nếu không có key
    if (process.env.NODE_ENV === 'development') {
        logger.warn('[reCAPTCHA] Skipping reCAPTCHA verification in development mode.');
        return true;
    }
    return false;
  }

  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

  try {
    const response = await axios.post(verificationUrl);
    const { success, 'error-codes': errorCodes } = response.data;
    if (!success) {
        logger.warn(`[reCAPTCHA] Verification failed: ${errorCodes?.join(', ')}`);
    }
    return success;
  } catch (error) {
    logger.error(`[reCAPTCHA] Error verifying token: ${error}`);
    return false;
  }
}

/**
 * Controller cho các endpoint công khai, không yêu cầu xác thực.
 */
export const bffPublicController = {
  /**
   * Lấy danh sách tất cả các gói cước công khai.
   */
  getPublicPlans: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await PlanService.getPublicPlans();
      res.status(200).json({
        message: 'Lấy danh sách gói cước công khai thành công.',
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Lấy chi tiết một gói cước công khai bằng slug.
   */
  getPublicPlanBySlug: async (req: Request, res: Response, next: NextFunction) => {
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
  
  /**
   * Xử lý form liên hệ từ người dùng.
   */
  handleContactForm: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, message, captchaToken } = req.body;
      if (!email || !message || !captchaToken) throw new BadRequestError('Email, message, and captchaToken are required.');
      const isCaptchaValid = await verifyRecaptcha(captchaToken);
      if (!isCaptchaValid) throw new BadRequestError('Invalid CAPTCHA. Please try again.');
      await emailService.sendContactFormEmail({ fromEmail: email, message });
      res.status(200).json({ message: 'Thank you! Your feedback has been sent.' });
    } catch (error) {
      next(error);
    }
  },
};