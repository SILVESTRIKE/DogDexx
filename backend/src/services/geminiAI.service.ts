import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
import { redisClient } from "../utils/redis.util"; // Import Redis client
import { tokenConfig } from "../config/token.config"; // Import tokenConfig cho thời gian hết hạn
dotenv.config();

// 1. Kiểm tra API Key ngay từ đầu để báo lỗi sớm
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_API_KEY is not defined in the .env file");
}

const genAI = new GoogleGenerativeAI(apiKey);

// 2. Khởi tạo model một lần duy nhất để tái sử dụng
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Interface cho lịch sử chat lưu trong Redis
interface RedisChatSession {
  lang: 'vi' | 'en';
  history: { role: string; parts: { text: string }[] }[];
}

// Hàm tạo khóa Redis cho phiên chat
function getChatRedisKey(userId: string | undefined, guestIdentifier: string | undefined, breedSlug: string): string {
  if (userId) {
    return `chat:user:${userId}:${breedSlug}`;
  }
  if (guestIdentifier) {
    return `chat:guest:${guestIdentifier}:${breedSlug}`;
  }
  // Trường hợp dự phòng, không nên xảy ra nếu logic xác định người dùng/khách là mạnh mẽ
  return `chat:anon:${breedSlug}`;
}

// Hàm thêm tin nhắn vào lịch sử chat trong Redis
async function addToRedisHistory(key: string, role: "user" | "model", content: string) {
  if (!redisClient) {
    logger.error("Redis client not available for chat history.");
    return;
  }

  const sessionStr = await redisClient.get(key);
  let session: RedisChatSession | null = null;
  if (sessionStr) {
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {
      logger.error(`Failed to parse chat session from Redis for key ${key}:`, e);
      session = null; // Vô hiệu hóa session nếu phân tích cú pháp thất bại
    }
  }

  if (!session) {
    logger.warn(`No existing session found for key ${key} when trying to add history. This should not happen.`);
    return;
  }

  session.history.push({ role, parts: [{ text: content }] }); // Thêm tin nhắn mới

  // Giới hạn 10 lượt hỏi-đáp (20 tin nhắn) + 2 tin nhắn khởi tạo
  if (session.history.length > 22) {
    // Giữ lại 2 tin nhắn đầu (system prompt + welcome) và 20 tin nhắn gần nhất
    const systemMessages = session.history.slice(0, 2);
    const recentMessages = session.history.slice(-20);
    session.history = [...systemMessages, ...recentMessages];
  }

  await redisClient.set(key, JSON.stringify(session), {
    EX: tokenConfig.guest.expirationSeconds, // Đặt thời gian hết hạn cho phiên chat
  });
}

export async function askGemini(
  breed: string,
  userMessage: string,
  lang: "vi" | "en" = "vi",
  userId: string | undefined, // MỚI: ID người dùng đã đăng nhập
  guestIdentifier: string | undefined // MỚI: Định danh khách
): Promise<{ reply: string; initialMessage?: string }> {
  try {
    const chatRedisKey = getChatRedisKey(userId, guestIdentifier, breed);

    const systemPromptText = lang === "en"
      ? `You are an expert in dog breeds, especially knowledgeable about the ${breed} breed.

Requirements:
- Talk only about the ${breed} breed.
- If the user goes off-topic, gently guide the conversation back (for example: “Let’s stay focused on the ${breed} breed 🐶”).
- Use a friendly, concise, and emotionally engaging tone that’s easy to understand.
- Give detailed answers when the user asks about origin, temperament, living environment, care, diet, training, or friendliness with children/other pets.

---
`
        : `Bạn là chuyên gia về các giống chó cảnh, đặc biệt hiểu rõ về giống chó ${breed}.

Yêu cầu:
- Chỉ nói về giống chó ${breed}.
- Nếu người dùng hỏi lạc đề, hãy khéo léo kéo về chủ đề (ví dụ: "Mình đang nói về giống chó ${breed} nhé 🐶").
- Sử dụng phong cách thân thiện, ngắn gọn và dễ hiểu, có cảm xúc.
- Trả lời chi tiết khi người dùng hỏi về nguồn gốc, tính cách, môi trường sống, chăm sóc, thức ăn, huấn luyện hoặc độ thân thiện với trẻ em/thú cưng khác.

---`;

    let session: RedisChatSession | null = null;
    let initialMessage: string | undefined = undefined;

    if (redisClient) {
      const sessionStr = await redisClient.get(chatRedisKey);
      if (sessionStr) {
        try {
          session = JSON.parse(sessionStr);
        } catch (e) {
          logger.error(`Failed to parse chat session from Redis for key ${chatRedisKey}:`, e);
          session = null; // Vô hiệu hóa session nếu phân tích cú pháp thất bại
        }
      }
    } else {
      logger.error("Redis client not available for chat history.");
    }

    // Nếu chưa có session hoặc ngôn ngữ đã thay đổi, tạo session mới
    if (!session || session.lang !== lang) {
      logger.info(`[Gemini] Creating new chat session for breed '${breed}' for ${userId ? 'user' : guestIdentifier ? 'guest' : 'anon'} in '${lang}'.`);

      const newHistory = [
        { role: 'user', parts: [{ text: systemPromptText }] },
      ];

      session = { lang, history: newHistory };
      if (redisClient) {
        await redisClient.set(chatRedisKey, JSON.stringify(session), {
          EX: tokenConfig.guest.expirationSeconds, // Đặt thời gian hết hạn cho phiên chat
        });
      }
    }

    // 3. Dùng model đã được khởi tạo sẵn
    const chat = model.startChat({
      history: session.history, // Sử dụng lịch sử từ Redis
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();
    
    // CẬP NHẬT: Thêm tin nhắn mới vào lịch sử trước khi gửi về
    await addToRedisHistory(chatRedisKey, "user", userMessage);
    await addToRedisHistory(chatRedisKey, "model", reply);

    return { reply, initialMessage };
  } catch (error) {
    console.error(
      `[Gemini Service Error] Failed to get response for breed '${breed}':`,
      error
    );
    // Trả về một tin nhắn lỗi thân thiện với người dùng
    const errorMessage = lang === "en"
      ? "I'm having a little trouble thinking right now. Please try again in a moment."
      : "Mình đang gặp chút sự cố, bạn thử lại sau nhé.";
    
    return { reply: errorMessage };
  }
}
