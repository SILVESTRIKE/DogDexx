import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: (process.env.EMAIL_PORT === '465'), // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendGenericEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: subject,
    text: text,
  };

  try {
    logger.info("Gửi email từ:", process.env.EMAIL_USER);
    await transporter.sendMail(mailOptions);
    logger.info(mailOptions.text);
    logger.info("Đã gửi mail đến:", to);
  } catch (error) {
    logger.error(`[EmailService] Lỗi gửi mail đến ${to}:`, error);
    throw new Error("Không thể gửi email");
  }
}

interface ContactFormPayload {
  fromEmail: string;
  message: string;
}

/**
 * Gửi email từ form liên hệ của người dùng.
 * @param payload Dữ liệu từ form
 */
async function sendContactFormEmail(payload: ContactFormPayload): Promise<void> {
  const { fromEmail, message } = payload;
  const receiverEmail = process.env.EMAIL_USER;

  // Thêm kiểm tra để đảm bảo biến môi trường đã được thiết lập
  if (!receiverEmail) {
    logger.error('[EmailService] CONTACT_FORM_RECEIVER_EMAIL is not set in the .env file. Cannot send contact form email.');
    throw new Error('Server configuration error: Contact email recipient is not defined.');
  }

  const mailOptions = {
    from: `"${fromEmail}" <${process.env.EMAIL_USER}>`, // Hiển thị email người gửi trong tiêu đề mail
    to: receiverEmail, // Email của bạn để nhận feedback
    subject: `[DogBreedID] New Feedback from ${fromEmail}`,
    html: `
      <h2>New Feedback Received</h2>
      <p><strong>From:</strong> <a href="mailto:${fromEmail}">${fromEmail}</a></p>
      <p><strong>Message:</strong></p>
      <pre style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${message}</pre>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EmailService] Contact form email sent: ${info.messageId}`);
  } catch (error) {
    logger.error(`[EmailService] Error sending contact form email:`, error);
    throw new Error("Could not send contact email.");
  }
}

export const emailService = {
  sendEmail: sendGenericEmail,
  sendContactFormEmail,
};