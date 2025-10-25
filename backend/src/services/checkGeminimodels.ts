require('dotenv').config(); // Đảm bảo bạn có thể đọc GEMINI_API_KEY

/**
 * Script này gọi trực tiếp đến REST API của Google để liệt kê các model có sẵn cho API key của bạn.
 * This script directly calls the Google REST API to list available models for your API key.
 */
async function listAvailableModels() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Lỗi: Biến môi trường GOOGLE_API_KEY chưa được thiết lập trong file .env");
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  console.log("Đang gọi API để lấy danh sách model...");

  try {
    // Node.js v18+ đã tích hợp sẵn fetch
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("Lỗi khi lấy danh sách model:", data.error.message);
      return;
    }

    console.log("\n--- CÁC MODEL CÓ SẴN CHO BẠN ---");
    for (const model of data.models) {
      console.log(`- Tên Model: ${model.name}`);
      console.log(`  - Hỗ trợ: ${model.supportedGenerationMethods.join(", ")}`);
    }
    console.log("\n----------------------------------\n");
    console.log("Gợi ý: Hãy chọn một trong các model trên (ví dụ: 'models/gemini-1.0-pro') và cập nhật trong file geminiAI.service.ts của bạn.");

  } catch (error) {
    console.error("Không thể thực hiện yêu cầu:", error);
  }
}

listAvailableModels();