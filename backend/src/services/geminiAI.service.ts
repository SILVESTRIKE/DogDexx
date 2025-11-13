import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { logger } from "../utils/logger.util";
import { redisClient } from "../utils/redis.util"; // Import Redis client
import { tokenConfig } from "../config/token.config";
import { REDIS_KEYS } from "../constants/redis.constants";
import axios from "axios";
import { Builder, By, until, WebDriver, Capabilities } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import 'chromedriver'; 
dotenv.config();

// 1. Kiểm tra API Key ngay từ đầu để báo lỗi sớm
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_API_KEY is not defined in the .env file");
}
const ACCESSTRADE_API_BASE = "https://fast.accesstrade.com.vn";
const genAI = new GoogleGenerativeAI(apiKey);
const SHOPEE_CAMPAIGN_ID = "128"; // ID chiến dịch của Shopee trên AccessTrade

// 2. Khởi tạo model một lần duy nhất để tái sử dụng
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Interface cho lịch sử chat lưu trong Redis
interface RedisChatSession {
  lang: "vi" | "en";
  history: { role: string; parts: { text: string }[] }[];
}

// Hàm tạo khóa Redis cho phiên chat
function getChatRedisKey(
  userId: string | undefined,
  guestIdentifier: string | undefined,
  breedSlug: string
): string {
  if (userId) {
    return `${REDIS_KEYS.CHAT_SESSION_PREFIX}user:${userId}:${breedSlug}`;
  }
  if (guestIdentifier) {
    return `${REDIS_KEYS.CHAT_SESSION_PREFIX}guest:${guestIdentifier}:${breedSlug}`;
  }
  // Trường hợp dự phòng, không nên xảy ra nếu logic xác định người dùng/khách là mạnh mẽ
  return `${REDIS_KEYS.CHAT_SESSION_PREFIX}anon:${breedSlug}`;
}

/**
 * Lấy lịch sử chat từ Redis.
 */
export async function getChatHistory(
  userId: string | undefined,
  guestIdentifier: string | undefined,
  breedSlug: string
): Promise<RedisChatSession['history']> {
  const chatRedisKey = getChatRedisKey(userId, guestIdentifier, breedSlug);
  if (!redisClient) {
    logger.error("Redis client not available, cannot get chat history.");
    return [];
  }

  const sessionStr = await redisClient.get(chatRedisKey);
  if (sessionStr) {
    try {
      const session: RedisChatSession = JSON.parse(sessionStr);
      // Bỏ qua 2 tin nhắn hệ thống đầu tiên (system prompt)
      return session.history.slice(1);
    } catch (e) {
      logger.error(`Failed to parse chat session from Redis for key ${chatRedisKey}:`, e);
    }
  }
  return [];
}
// Hàm thêm tin nhắn vào lịch sử chat trong Redis
async function addToRedisHistory(
  key: string,
  role: "user" | "model",
  content: string
) {
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
      logger.error(
        `Failed to parse chat session from Redis for key ${key}:`,
        e
      );
      session = null; // Vô hiệu hóa session nếu phân tích cú pháp thất bại
    }
  }

  if (!session) {
    logger.warn(
      `No existing session found for key ${key} when trying to add history. This should not happen.`
    );
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

    const systemPromptText =
      lang === "en"
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
          logger.error(
            `Failed to parse chat session from Redis for key ${chatRedisKey}:`,
            e
          );
          session = null; // Vô hiệu hóa session nếu phân tích cú pháp thất bại
        }
      }
    } else {
      logger.error("Redis client not available for chat history.");
    }

    // Nếu chưa có session hoặc ngôn ngữ đã thay đổi, tạo session mới
    if (!session || session.lang !== lang) {
      logger.info(
        `[Gemini] Creating new chat session for breed '${breed}' for ${
          userId ? "user" : guestIdentifier ? "guest" : "anon"
        } in '${lang}'.`
      );

      const newHistory = [
        { role: "user", parts: [{ text: systemPromptText }] },
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
    const errorMessage =
      lang === "en"
        ? "I'm having a little trouble thinking right now. Please try again in a moment."
        : "Mình đang gặp chút sự cố, bạn thử lại sau nhé.";

    return { reply: errorMessage };
  }
}
export async function getHealthRecommendations(
  breed: string,
  healthIssues: string[],
  lang: "vi" | "en" = "vi"
): Promise<string> {
  try {
    const issuesString = healthIssues.join(", ");

    // ====================== PROMPT MỚI - ĐỊNH DẠNG LIST ======================
    const prompt =
      lang === "en"
        ? `As a veterinary expert, provide practical care recommendations for a ${breed} dog for these health issues: ${issuesString}.

CRITICAL REQUIREMENTS:
- DO NOT use a Markdown table. Use lists.
- For each health issue, use a Level 3 Markdown header (e.g., "### Hip Dysplasia").
- Under each header, provide a bulleted list of the 2-3 most important preventive measures using a hyphen (-).
- Keep the advice concise, professional, and easy to understand.
- Do not include any introductory or concluding paragraphs. Just the headers and lists.

Example:
### Health Issue A
- Do this one short thing.
- Do this other short thing.

### Health Issue B
- Do this third short thing.
`
        : `Với vai trò là chuyên gia thú y, hãy đưa ra các khuyến nghị chăm sóc cho chó ${breed} đối với các vấn đề sức khỏe sau: ${issuesString}.

YÊU CẦU QUAN TRỌNG:
- KHÔNG sử dụng định dạng bảng Markdown. Hãy dùng danh sách.
- Với mỗi vấn đề sức khỏe, hãy sử dụng tiêu đề Markdown cấp 3 (ví dụ: "### Loạn sản khớp háng").
- Bên dưới mỗi tiêu đề, cung cấp một danh sách gạch đầu dòng từ 2-3 biện pháp phòng ngừa quan trọng nhất, sử dụng dấu gạch ngang (-).
- Giữ cho lời khuyên ngắn gọn, chuyên nghiệp và dễ hiểu.
- Không thêm bất kỳ đoạn văn giới thiệu hay kết luận nào. Chỉ cần các tiêu đề và danh sách.

Ví dụ:
### Tên Bệnh A
- Làm hành động 1 ngắn gọn.
- Làm hành động 2 ngắn gọn.

### Tên Bệnh B
- Làm hành động 3 ngắn gọn.
`;
    // =======================================================================

    const result = await model.generateContent(prompt);
    const reply = result.response.text();
    return reply;
  } catch (error) {
    logger.error(
      `[Gemini Service Error] Failed to get health recommendations for breed '${breed}':`,
      error
    );
    const errorMessage =
      lang === "en"
        ? "I'm having a little trouble thinking of recommendations right now. Please try again in a moment."
        : "Mình đang gặp chút sự cố khi lấy khuyến nghị, bạn thử lại sau nhé.";
    return errorMessage;
  }
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
interface ShopeeProduct {
    name: string;
    imageUrl: string;
    productUrl: string;
}
async function scrapeFirstShopeeProduct(keyword: string): Promise<ShopeeProduct | null> {
    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://shopee.vn/search?keyword=${encodedKeyword}`;

    logger.info(`[Selenium V3] 🚀 Khởi tạo trình duyệt cho: "${keyword}"`);
    
    const options = new chrome.Options();
    options.addArguments(
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );
    options.excludeSwitches('enable-automation');
    
    let driver: WebDriver | null = null;

    try {
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        await driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

        await driver.get(searchUrl);
        logger.info(`[Selenium V3] 🔎 Đã truy cập Shopee...`);
        
        try {
            const popupCloseButton = await driver.wait(until.elementLocated(By.css('div.shopee-popup__close-btn')), 5000);
            await driver.executeScript("arguments[0].click();", popupCloseButton);
            logger.info('[Selenium V3] 👍 Đã đóng pop-up.');
            await sleep(1000);
        } catch (error) {
            logger.info('[Selenium V3] ✅ Không có pop-up.');
        }

        // CẢI TIẾN 1: CUỘN XUỐNG TẬN CÙNG TRANG
        logger.info('[Selenium V3] 🖱️ Cuộn xuống cuối trang để tải tất cả sản phẩm...');
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
        await sleep(1000); // Chờ 1 giây để các sản phẩm bắt đầu hiện ra
        await driver.executeScript('window.scrollTo(0, 0);'); // Cuộn lại lên đầu để đảm bảo sản phẩm đầu tiên hiển thị
        await sleep(500);

        // CẢI TIẾN 2: CHỜ "VÙNG CHỨA SẢN PHẨM" TRƯỚC
        const resultsContainerSelector = By.css('div.shopee-search-item-result__items');
        logger.info(`[Selenium V3] ⏳ Chờ vùng chứa sản phẩm xuất hiện...`);
        
        // CẢI TIẾN 3: TĂNG TIMEOUT TỔNG THỂ LÊN 30 GIÂY
        const resultsContainer = await driver.wait(
            until.elementLocated(resultsContainerSelector), 
            30000 
        );
        logger.info(`[Selenium V3] ✅ Vùng chứa sản phẩm đã xuất hiện!`);

        // Bây giờ mới tìm sản phẩm đầu tiên BÊN TRONG vùng chứa đó
        const productXPathSelector = ".//a[contains(@href, '-i.')]"; // Dùng ".//" để tìm bên trong element
        logger.info(`[Selenium V3] 🎯 Đang săn lùng sản phẩm đầu tiên...`);
        const firstProductElement = await resultsContainer.findElement(By.xpath(productXPathSelector));
        
        logger.info("[Selenium V3] ✅ Đã tìm thấy sản phẩm! Đang lấy chi tiết...");

        const productUrl = await firstProductElement.getAttribute("href");
        const name = (await firstProductElement.findElement(By.css('div[data-sqe="name"]')).getText()) || keyword;
        const imageUrl = await firstProductElement.findElement(By.css('img.shopee-search-item-result__item-image-img')).getAttribute("src");
        
        return { name, imageUrl, productUrl };

    } catch (error) {
        logger.error(`[Selenium V3] Lỗi khi cào dữ liệu cho "${keyword}":`, error);
        if(driver) {
            const image = await driver.takeScreenshot();
            const safeKeyword = keyword.replace(/[\\/:*?"<>|]/g, "_").substring(0, 100);
            const screenshotPath = `selenium_error_${safeKeyword}.png`;
            require('fs').writeFileSync(screenshotPath, image, 'base64');
            logger.info(`📸 Đã lưu ảnh màn hình lỗi tại: ${screenshotPath}`);
        }
        return null;
    } finally {
        if (driver) {
            logger.info("[Selenium V3] 👍 Hoàn tất, đóng trình duyệt.");
            await driver.quit();
        }
    }
}
/**
 * [HÀM GIỮ LẠI] Tạo deeplink từ link sản phẩm gốc.
 * Hàm này vẫn cần thiết để chuyển đổi link gốc từ Top Products thành link affiliate.
 * Lưu ý: Tên biến accessToken đã đổi từ process.env.ACCESSTRADE_ACCESS_TOKEN thành process.env.ACCESSTRADE_API_KEY để nhất quán
 */
async function createAffiliateLinkManually(destinationUrl: string): Promise<string | null> {
    const affiliateId = process.env.ACCESSTRADE_API_KEY;
    if (!affiliateId) {
        logger.error("[Link Builder] ACCESSTRADE_API_KEY chưa được cấu hình trong file .env!");
        return null;
    }

    const encodedDestinationUrl = encodeURIComponent(destinationUrl);
    
    // ĐÚNG CÔNG THỨC LINK CÔNG KHAI
    const affiliateLink = `https://fast.accesstrade.com.vn/deep_link/v6?aff_id=${affiliateId}&campaign_id=${SHOPEE_CAMPAIGN_ID}&url=${encodedDestinationUrl}`;
    
    return affiliateLink;
}

export async function getRecommendedProducts(
    breed: string,
    lang: "vi" | "en" = "vi"
): Promise<string> {
    try {
        logger.info(`[Gemini Products] Bắt đầu lấy gợi ý sản phẩm cho giống chó: ${breed}`);
        // === BƯỚC 1: LẤY GỢI Ý TỪ GEMINI (Cập nhật để hỗ trợ đa ngôn ngữ) ===
        const prompt = lang === 'en'
            ? `Based on the characteristics of the ${breed} dog, suggest 6 essential product types. For each type, provide:
1. "categoryName": A concise category name (e.g., "Smart Toys").
2. "searchKeywords": The best search keywords for Shopee (a Vietnamese e-commerce site).
3. "reason": A short sentence explaining WHY the ${breed} dog needs this type of product.
Return as a valid JSON array.`
            : `Dựa trên đặc điểm của chó ${breed}, đề xuất 6 loại sản phẩm thiết yếu. Với mỗi loại, hãy cung cấp:
1. "categoryName": Tên danh mục ngắn gọn (VD: "Đồ Chơi Thông Minh").
2. "searchKeywords": Từ khóa tìm kiếm tốt nhất trên Shopee.
3. "reason": Một câu ngắn giải thích TẠI SAO giống chó ${breed} cần loại sản phẩm này.
Trả về dưới dạng một mảng JSON hợp lệ.`;

        const resultFromAI = await model.generateContent(prompt);
        const rawReply = resultFromAI.response.text();
        logger.info(`[Gemini Products] Phản hồi thô từ Gemini: ${rawReply}`);
        
        let ideas: { categoryName: string; searchKeywords: string; reason: string; }[] = [];
        try {
            const jsonString = rawReply.match(/\[[\s\S]*\]/)?.[0];
            if (jsonString) {
                ideas = JSON.parse(jsonString);
                logger.info(`[Gemini Products] Đã parse thành công ${ideas.length} ý tưởng sản phẩm.`);
            } else {
                throw new Error("Không tìm thấy mảng JSON trong phản hồi của AI.");
            }
        } catch (e) {
            logger.error("Lỗi parse JSON từ Gemini.", e);
            return "[]";
        }

        const finalRecommendations = [];

        logger.info(`[Gemini Products] Bắt đầu tạo link Shopee cho từng ý tưởng...`);
        // === BƯỚC 2: DUYỆT VÀ TẠO LINK SHOPEE TRỰC TIẾP (KHÔNG AFFILIATE) ===
        for (const idea of ideas) {
            if (!idea.searchKeywords) {
                logger.warn(`[Gemini Products] Bỏ qua ý tưởng vì không có searchKeywords:`, idea);
                continue;
            }
            
            // Lấy từ khóa chính để tạo link
            const mainKeyword = idea.searchKeywords.split(',')[0].trim();
            
            // Tạo URL tìm kiếm gốc, trực tiếp trên Shopee
            const shopeeSearchUrl = `https://shopee.vn/search?keyword=${encodeURIComponent(mainKeyword)}`;
            
            logger.info(`[Gemini Products] -> Từ khóa: "${mainKeyword}", URL: ${shopeeSearchUrl}`);

            // Đóng gói kết quả theo yêu cầu cuối cùng của bạn
            finalRecommendations.push({
                category: idea.categoryName,
                reason: idea.reason,
                shopeeUrl: shopeeSearchUrl // Trả về link Shopee gốc
            });
        }
        
        logger.info(`[Workflow] ĐÃ XONG! Đã tạo ${finalRecommendations.length} link Shopee trực tiếp.`);
        return JSON.stringify(finalRecommendations);

    } catch (error) {
        logger.error(`Lỗi nghiêm trọng trong getRecommendedProducts cho ${breed}:`, error);
        return "[]";
    }
}