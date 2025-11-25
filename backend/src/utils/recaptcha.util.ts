import axios from "axios";
import { logger } from "./logger.util";

interface RecaptchaResponse {
  success: boolean;
  score?: number;      // Dành cho v3
  action?: string;     // Dành cho v3
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export async function verifyRecaptcha(token: string, action?: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    logger.error("[reCAPTCHA] RECAPTCHA_SECRET_KEY chưa được set trong .env");
    // Trong môi trường dev, có thể return true để test cho nhanh
    if (process.env.NODE_ENV === 'development') return true; 
    return false;
  }

  try {
    // Google khuyên dùng phương thức POST với params
    const response = await axios.post<RecaptchaResponse>(
      `https://www.google.com/recaptcha/api/siteverify`,
      null, // Body null vì gửi qua query params
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );

    const { success, score, action: responseAction, "error-codes": errorCodes } = response.data;

    // LOG QUAN TRỌNG: In ra để xem Google trả về cái gì
    logger.info(`[reCAPTCHA Debug] Success: ${success}, Score: ${score}, Action: ${responseAction}, Errors: ${errorCodes}`);

    // 1. Kiểm tra success cơ bản (Token hợp lệ, key đúng...)
    if (!success) {
      logger.warn(`[reCAPTCHA] Token không hợp lệ: ${errorCodes?.join(", ")}`);
      return false;
    }

    // 2. Kiểm tra Score (Chỉ dành cho v3)
    // Score chạy từ 0.0 (bot) -> 1.0 (human). 
    // Mặc định google khuyến nghị 0.5, bạn có thể chỉnh xuống 0.4 nếu user bị chặn nhầm nhiều.
    if (score !== undefined && score < 0.5) {
      logger.warn(`[reCAPTCHA] Score quá thấp (${score}). Nghi ngờ là bot.`);
      return false;
    }

    // 3. Kiểm tra Action (Optional nhưng recommend)
    // Đảm bảo token được tạo ra cho action 'login' chứ không phải action khác
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