import axios from "axios";
import { logger } from "./logger.util";

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyRecaptcha(token: string, action?: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    logger.error("[reCAPTCHA] RECAPTCHA_SECRET_KEY chưa được set trong .env");
    if (process.env.NODE_ENV === 'development') return true;
    return false;
  }

  try {
    const response = await axios.post<RecaptchaResponse>(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );

    const { success, score, action: responseAction, "error-codes": errorCodes } = response.data;

    logger.info(`[reCAPTCHA Debug] Success: ${success}, Score: ${score}, Action: ${responseAction}, Errors: ${errorCodes}`);

    if (!success) {
      logger.warn(`[reCAPTCHA] Token không hợp lệ: ${errorCodes?.join(", ")}`);
      return false;
    }

    if (score !== undefined && score < 0.5) {
      logger.warn(`[reCAPTCHA] Score quá thấp (${score}). Nghi ngờ là bot.`);
      return false;
    }
    if (action && responseAction !== action) {
      logger.warn(`[reCAPTCHA] Action không khớp (Expected: ${action}, Got: ${responseAction})`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`[reCAPTCHA] Lỗi kết nối đến Google API: ${error}`);
    return false;
  }
}