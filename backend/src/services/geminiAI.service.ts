import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
dotenv.config();

// 1. Kiểm tra API Key ngay từ đầu để báo lỗi sớm
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_API_KEY is not defined in the .env file");
}

const genAI = new GoogleGenerativeAI(apiKey);

// 2. Khởi tạo model một lần duy nhất để tái sử dụng
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

/**
 * RỦI RO KIẾN TRÚC:
 * Lịch sử chat đang được lưu trong RAM.
 * Nếu server khởi động lại, toàn bộ dữ liệu này sẽ mất.
 * Cân nhắc dùng Redis hoặc DB cho giải pháp lâu dài.
 */
interface ChatSession {
  lang: 'vi' | 'en';
  history: { role: string; parts: { text: string }[] }[];
}

// Key là breedSlug
const chatSessions = new Map<string, ChatSession>();

function addToHistory(breed: string, role: "user" | "model", content: string) {
  const session = chatSessions.get(breed);
  if (!session) return;

  session.history.push({ role, parts: [{ text: content }] });
  // Giới hạn 10 lượt hỏi-đáp (20 tin nhắn) + 2 tin nhắn khởi tạo
  if (session.history.length > 22) {
    // Giữ lại 2 tin nhắn đầu (system prompt + welcome) và 20 tin nhắn gần nhất
    const systemMessages = session.history.slice(0, 2);
    const recentMessages = session.history.slice(-20);
    session.history = [...systemMessages, ...recentMessages];
  }
}

export async function askGemini(
  breed: string,
  userMessage: string,
  lang: "vi" | "en" = "vi"
): Promise<{ reply: string; initialMessage?: string }> {
  try {
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

    let session = chatSessions.get(breed);
    let initialMessage: string | undefined = undefined;

    // Nếu chưa có session hoặc ngôn ngữ đã thay đổi, tạo session mới
    if (!session || session.lang !== lang) {
      logger.info(`[Gemini] Creating new chat session for breed '${breed}' in '${lang}'.`);

      const newHistory = [
        { role: 'user', parts: [{ text: systemPromptText }] },
      ];

      session = { lang, history: newHistory };
      chatSessions.set(breed, session);
    }

    // 3. Dùng model đã được khởi tạo sẵn
    const chat = model.startChat({
      history: session.history,
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    addToHistory(breed, "user", userMessage); // Lưu tin nhắn của người dùng
    addToHistory(breed, "model", reply); // Lưu tin nhắn của AI

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
