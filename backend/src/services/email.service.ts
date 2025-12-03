import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
dotenv.config();

// Hàm gửi mail dùng API thay vì SMTP
async function sendGenericEmail(
  to: string,
  subject: string,
  content: string // Tham số này có thể là text hoặc html
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY; // Nhớ cấu hình biến này trên Render
  const senderEmail = process.env.EMAIL_FROM || "ctytest8@gmail.com";

  if (!apiKey) {
    throw new Error("Thiếu cấu hình BREVO_API_KEY");
  }

  const url = "https://api.brevo.com/v3/smtp/email";

  // Brevo API Body
  const body = {
    sender: { name: "DOGDEX siu cấp vjp pro", email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: `<html><body>${content}</body></html>`,
  };

  try {
    logger.info(`[EmailService] Đang gọi API gửi đến: ${to}`);

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
      const err = await response.json();
      logger.error(`[EmailService] API Lỗi: ${JSON.stringify(err)}`);
      throw new Error("Lỗi gửi mail từ Brevo API");
    }

    logger.info("[EmailService] Gửi mail thành công qua API.");
  } catch (error) {
    logger.error("[EmailService] Lỗi kết nối:", error);
    throw error;
  }
}

interface ContactFormPayload {
  fromEmail: string;
  message: string;
}

async function sendContactFormEmail(payload: ContactFormPayload): Promise<void> {
  const { fromEmail, message } = payload;
  const receiverEmail = process.env.EMAIL_FROM;

  if (!receiverEmail) return;

  const htmlBody = `
    <h3>Feedback mới</h3>
    <p><strong>Từ:</strong> ${fromEmail}</p>
    <p><strong>Nội dung:</strong> ${message}</p>
  `;

  await sendGenericEmail(receiverEmail, `Feedback từ ${fromEmail}`, htmlBody);
}

export const emailService = {
  sendEmail: sendGenericEmail,
  sendContactFormEmail,
};