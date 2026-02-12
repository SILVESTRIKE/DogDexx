require('dotenv').config(); // Đảm bảo bạn có thể đọc GEMINI_API_KEY
import {logger} from '../utils/logger.util.js';
/**
 * Script này gọi trực tiếp đến REST API của Google để liệt kê các model có sẵn cho API key của bạn.
 * This script directly calls the Google REST API to list available models for your API key.
 */
async function listAvailableModels() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    logger.error("Lỗi: Biến môi trường GOOGLE_API_KEY chưa được thiết lập trong file .env");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    // Node.js v18+ đã tích hợp sẵn fetch
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      logger.error("Lỗi khi lấy danh sách model:", data.error.message);
      return;
    }

    logger.info("\n--- CÁC MODEL CÓ SẴN CHO BẠN ---");
    for (const model of data.models) {
      logger.info(`- Tên Model: ${model.name}`);
      logger.info(`  - Hỗ trợ: ${model.supportedGenerationMethods.join(", ")}`);
    }
    logger.info("\n----------------------------------\n");
    logger.info("Gợi ý: Hãy chọn một trong các model trên (ví dụ: 'models/gemini-1.0-pro') và cập nhật trong file geminiAI.service.ts của bạn.");

  } catch (error) {
    logger.error("Không thể thực hiện yêu cầu:", error);
  }
}

listAvailableModels();