import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
dotenv.config();
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});
async function sendGenericEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  const mailOptions = {
    from: `__STRING_1_11__ <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    text: text,
  };
  try {
    logger.info(
      `[EmailService] Đang gửi mail từ ${process.env.EMAIL_USER} đến ${to}...`
    );
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EmailService] Gửi thành công! MessageID: ${info.messageId}`);
  } catch (error) {
    logger.error(`[EmailService] Lỗi gửi mail đến ${to}:`, error);
    throw new Error("Không thể gửi email");
  }
}
interface ContactFormPayload {
  fromEmail: string;
  message: string;
}

async function sendContactFormEmail(
  payload: ContactFormPayload
): Promise<void> {
  const { fromEmail, message } = payload;
  const receiverEmail = process.env.EMAIL_USER;
  if (!receiverEmail) {
    logger.error("[EmailService] EMAIL_USER chưa được cấu hình.");
    throw new Error("Server configuration error.");
  }
  const mailOptions = {
    from: `__STRING_1_13__ <${process.env.EMAIL_USER}>`,
    replyTo: fromEmail,
    to: receiverEmail,
    subject: `[DogBreedID] Feedback mới từ ${fromEmail}`,
    html: `
      <h2>Bạn nhận được phản hồi mới</h2>
      <p><strong>Người gửi:</strong> <a href=__STRING_1_14__>${fromEmail}</a></p>
      <p><strong>Nội dung:</strong></p>
      <pre style=__STRING_1_15__>${message}</pre>
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
