import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
dotenv.config();

/**
 * Hàm gửi email sử dụng Brevo API (HTTP) thay vì SMTP
 * Cách này khắc phục triệt để lỗi Timeout trên Render.
 */
async function sendGenericEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || "ctytest8@gmail.com";
  const senderName = "DogBreed Support";

  if (!apiKey) {
    throw new Error("Chưa cấu hình BREVO_API_KEY trong biến môi trường.");
  }

  const url = "https://api.brevo.com/v3/smtp/email";
  
  const body = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent, // Brevo hỗ trợ HTML content
  };

  try {
    logger.info(`[EmailService] Đang gọi API Brevo gửi mail đến: ${to}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error("[EmailService] Brevo API Error:", JSON.stringify(errorData));
      throw new Error(`Lỗi từ Brevo: ${response.statusText}`);
    }

    const data = await response.json();
    logger.info(`[EmailService] Gửi thành công! MessageId: ${data.messageId}`);
  } catch (error) {
    logger.error(`[EmailService] Lỗi kết nối API:`, error);
    throw new Error("Không thể gửi email qua API.");
  }
}

// Giữ nguyên interface cũ để không phải sửa user.service.ts
interface ContactFormPayload {
  fromEmail: string;
  message: string;
}

async function sendContactFormEmail(payload: ContactFormPayload): Promise<void> {
  const { fromEmail, message } = payload;
  const receiverEmail = process.env.EMAIL_FROM; // Gửi về cho chính mình

  if (!receiverEmail) return;

  const htmlContent = `
    <h2>Feedback mới</h2>
    <p><strong>Từ:</strong> ${fromEmail}</p>
    <p><strong>Nội dung:</strong></p>
    <pre>${message}</pre>
  `;

  // Tái sử dụng hàm sendGenericEmail nhưng đổi subject
  await sendGenericEmail(receiverEmail, `[Feedback] Từ ${fromEmail}`, htmlContent);
}

export const emailService = {
  // Map hàm sendEmail cũ vào hàm mới (Lưu ý: tham số thứ 3 giờ là HTML/Text)
  sendEmail: sendGenericEmail, 
  sendContactFormEmail,
};