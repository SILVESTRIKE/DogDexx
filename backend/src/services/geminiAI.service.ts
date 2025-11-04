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

/**
 * Lấy khuyến nghị chăm sóc sức khỏe từ Gemini AI dựa trên các vấn đề sức khỏe phổ biến.
 * @param breed Tên giống chó
 * @param healthIssues Mảng các vấn đề sức khỏe
 * @param lang Ngôn ngữ
 * @returns Một chuỗi chứa các khuyến nghị.
 */
export async function getHealthRecommendations(
  breed: string,
  healthIssues: string[],
  lang: "vi" | "en" = "vi"
): Promise<string> {
  try {
    const issuesString = healthIssues.join(", ");

    const prompt = lang === "en"
      ? `As a veterinary expert, provide practical and easy-to-understand care recommendations for a ${breed} dog owner. This breed may be prone to the following health issues: ${issuesString}.

Focus on preventative care, early detection signs, and home care tips. Structure the advice clearly. For example, for skin issues like mange, recommend regular grooming, diet adjustments, and what symptoms to watch for.

Your tone should be empathetic, professional, and reassuring. Start with a general encouraging sentence.`
      : `Với vai trò là một chuyên gia thú y, hãy đưa ra các khuyến nghị chăm sóc thiết thực và dễ hiểu cho người nuôi chó giống ${breed}. Giống chó này có thể gặp các vấn đề sức khỏe sau: ${issuesString}.

Hãy tập trung vào các biện pháp phòng ngừa, dấu hiệu phát hiện sớm và các mẹo chăm sóc tại nhà. Sắp xếp lời khuyên một cách rõ ràng. Ví dụ, đối với các vấn đề về da như ghẻ, rận, hãy đề xuất lịch trình chải chuốt thường xuyên, điều chỉnh chế độ ăn và những triệu chứng cần chú ý.

Sử dụng giọng văn đồng cảm, chuyên nghiệp và trấn an. Bắt đầu bằng một câu động viên chung.`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    return reply;
  } catch (error) {
    logger.error(`[Gemini Service Error] Failed to get health recommendations for breed '${breed}':`, error);
    const errorMessage = lang === "en"
      ? "I'm having a little trouble thinking of recommendations right now. Please try again in a moment."
      : "Mình đang gặp chút sự cố khi lấy khuyến nghị, bạn thử lại sau nhé.";
    return errorMessage;
  }
}

/**
 * Lấy danh sách sản phẩm đề xuất từ Gemini AI cho một giống chó cụ thể.
 * @param breed Tên giống chó
 * @param lang Ngôn ngữ
 * @returns Một chuỗi JSON chứa danh sách sản phẩm.
 */
export async function getRecommendedProducts(
  breed: string,
  lang: "vi" | "en" = "vi"
): Promise<string> {
  try {
    const prompt = lang === "en"
      ? `Based on the characteristics of the ${breed} dog breed, recommend a list of about 10 essential products for a new owner.

Include products from these categories:
- Food (e.g., specific brand or type suitable for the breed)
- Grooming tools (e.g., brush type for their coat)
- Health supplements (e.g., for joints or skin)
- Toys (e.g., for their energy level)
- Training aids

For each product, provide a "productName" and a brief "reason" why it's suitable for a ${breed}.

Return the result ONLY as a single JSON array string. Do not include any other text or markdown formatting. The JSON should look like this:
[
  {"productName": "Example Product Name 1", "reason": "Reason why this is good for a ${breed}."},
  {"productName": "Example Product Name 2", "reason": "Another reason for this product."}
]`
      : `Dựa trên đặc điểm của giống chó ${breed}, hãy đề xuất một danh sách khoảng 10 sản phẩm thiết yếu cho người mới nuôi.

Bao gồm các sản phẩm từ những danh mục sau:
- Thức ăn (ví dụ: nhãn hiệu hoặc loại cụ thể phù hợp với giống chó)
- Dụng cụ chải chuốt (ví dụ: loại lược cho bộ lông của chúng)
- Thực phẩm chức năng (ví dụ: cho khớp hoặc da)
- Đồ chơi (ví dụ: phù hợp với mức năng lượng của chúng)
- Dụng cụ huấn luyện

Với mỗi sản phẩm, hãy cung cấp "productName" (tên sản phẩm) và "reason" (lý do ngắn gọn tại sao nó phù hợp với chó ${breed}).

Chỉ trả về kết quả dưới dạng một chuỗi mảng JSON duy nhất. Không bao gồm bất kỳ văn bản hay định dạng markdown nào khác. JSON phải có dạng như sau:
[
  {"productName": "Tên sản phẩm ví dụ 1", "reason": "Lý do tại sao sản phẩm này tốt cho chó ${breed}."},
  {"productName": "Tên sản phẩm ví dụ 2", "reason": "Một lý do khác cho sản phẩm này."}
]`;

    const result = await model.generateContent(prompt);
    let reply = result.response.text();

    // Đảm bảo chuỗi trả về là một JSON hợp lệ
    const jsonStartIndex = reply.indexOf('[');
    const jsonEndIndex = reply.lastIndexOf(']');
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      reply = reply.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    return reply;
  } catch (error) {
    logger.error(`[Gemini Service Error] Failed to get recommended products for breed '${breed}':`, error);
    const errorMessage = lang === "en"
      ? '[]' // Trả về mảng rỗng nếu có lỗi
      : '[]';
    return errorMessage;
  }
}
