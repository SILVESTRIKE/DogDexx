import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { redisClient } from "../utils/redis.util"; // Import Redis client
import { tokenConfig } from "../config/token.config";
import { REDIS_KEYS } from "../constants/redis.constants";
import {
  Builder,
  By,
  until,
  WebDriver,
  Capabilities,
} from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import "chromedriver";
dotenv.config();

// 1. Kiểm tra API Key ngay từ đầu để báo lỗi sớm
const apiKey = process.env.GOOGLE_API_KEY;
const healthApiKey = process.env.GOOGLE_API_KEY_HealthRec;
const proApiKey = process.env.GOOGLE_API_KEY_ProRec;
if (!apiKey) {
  throw new Error("GOOGLE_API_KEY is not defined in the .env file");
}
if (!healthApiKey) {
  throw new Error("GOOGLE_API_KEY_HealthRec is not defined in the .env file");
}
if (!proApiKey) {
  throw new Error("GOOGLE_API_KEY_ProRec is not defined in the .env file");
}
const ACCESSTRADE_API_BASE = "https://fast.accesstrade.com.vn";
const genAI = new GoogleGenerativeAI(apiKey);
const healthAI = new GoogleGenerativeAI(healthApiKey);
const proRecAI = new GoogleGenerativeAI(proApiKey);

const SHOPEE_CAMPAIGN_ID = "128"; // ID chiến dịch của Shopee trên AccessTrade

// 2. Khởi tạo model một lần duy nhất để tái sử dụng
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const healthModel = healthAI.getGenerativeModel({
  model: "gemini-flash-latest",
});
const proRecModel = proRecAI.getGenerativeModel({
  model: "gemini-flash-latest",
});
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
): Promise<RedisChatSession["history"]> {
  const chatRedisKey = getChatRedisKey(userId, guestIdentifier, breedSlug);
  if (!redisClient) {
    return [];
  }

  const sessionStr = await redisClient.get(chatRedisKey);
  if (sessionStr) {
    try {
      const session: RedisChatSession = JSON.parse(sessionStr);
      return session.history.slice(1);
    } catch (e) { }
  }
  return [];
}
async function addToRedisHistory(
  key: string,
  role: "user" | "model",
  content: string
) {
  if (!redisClient) {
    return;
  }

  const sessionStr = await redisClient.get(key);
  let session: RedisChatSession | null = null;
  if (sessionStr) {
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {
      session = null;
    }
  }

  if (!session) {
    return;
  }

  session.history.push({ role, parts: [{ text: content }] });

  if (session.history.length > 22) {
    const systemMessages = session.history.slice(0, 2);
    const recentMessages = session.history.slice(-20);
    session.history = [...systemMessages, ...recentMessages];
  }

  await redisClient.set(key, JSON.stringify(session), {
    EX: tokenConfig.guest.expirationSeconds,
  });
}

export async function askGemini(
  breed: string,
  userMessage: string,
  lang: "vi" | "en" = "vi",
  userId: string | undefined,
  guestIdentifier: string | undefined
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
          session = null;
        }
      }
    }

    if (!session || session.lang !== lang) {
      const newHistory = [
        { role: "user", parts: [{ text: systemPromptText }] },
      ];

      session = { lang, history: newHistory };
      if (redisClient) {
        await redisClient.set(chatRedisKey, JSON.stringify(session), {
          EX: tokenConfig.guest.expirationSeconds,
        });
      }
    }

    const chat = model.startChat({
      history: session.history,
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    await addToRedisHistory(chatRedisKey, "user", userMessage);
    await addToRedisHistory(chatRedisKey, "model", reply);

    return { reply, initialMessage };
  } catch (error) {
    const errorMessage =
      lang === "en"
        ? "I'm having a little trouble thinking right now. Please try again in a moment."
        : "Mình đang gặp chút sự cố, bạn thử lại sau nhé.";

    return { reply: errorMessage };
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 1000,
  operationName = "Gemini API call"
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = initialDelay * Math.pow(2, i);
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
export async function getHealthRecommendations(
  breed: string,
  healthIssues: string[],
  lang: "vi" | "en" = "vi"
): Promise<string> {
  try {
    const issuesString = healthIssues.join(", ");

    const prompt =
      lang === "en"
        ? `As a veterinary expert, create a comprehensive care guide for a ${breed} dog.
The guide must include the following sections:
- Nutrition and Diet
- Daily Exercise Requirements
- Grooming and Healthcare
- Vaccination Schedule
- For the "Vaccination Schedule" section, provide a general schedule based on this information:
  - **Core Vaccines:** Parvovirus, Distemper, Adenovirus (Hepatitis), Parainfluenza (DAPP/DHPP), and Rabies.
  - **Puppy Schedule:** Start at 6-8 weeks old, repeat every 3-4 weeks until 16 weeks old.
  - **Adult Schedule:** Booster DAPP/DHPP 1 year after the final puppy shot, then every 3 years; Rabies as required by law.
  - **Non-Core Vaccines:** Mention consulting a vet for non-core vaccines (e.g., Bordetella, Leptospirosis) based on the dog's lifestyle.
- Apartment Living Considerations
- Specific advice for these health issues: ${issuesString}

CRITICAL REQUIREMENTS:
- DO NOT use a Markdown table. Use lists.
- Use a hyphen (-) for bullet points, not an asterisk (*).
- You can use Markdown for bolding text (e.g., **Core Vaccines**) within the list items.
- For each section (e.g., "Nutrition and Diet", "Daily Exercise Requirements"), use a Level 3 Markdown header.
- For each specific health issue from the list, also create a separate Level 3 Markdown header (e.g., "### Hip Dysplasia").
- Under each header, provide a bulleted list of the 2-4 most important recommendations using a hyphen (-).
- Keep the advice concise, professional, and easy to understand.
- Do not include any introductory or concluding paragraphs. Just the headers and lists.

Example:
### Nutrition and Diet
- Recommendation 1.
- Recommendation 2.

### Daily Exercise Requirements
- Recommendation 3.
- Recommendation 4.

### Hip Dysplasia
- Preventive measure 1.
- Preventive measure 2.
`
        : `Với vai trò là chuyên gia thú y, hãy tạo một hướng dẫn chăm sóc toàn diện cho chó ${breed}.

Hướng dẫn phải bao gồm các mục sau:
- Chế độ dinh dưỡng và khẩu phần
- Thời gian vận động cần thiết mỗi ngày
- Cách chăm sóc bộ lông và sức khỏe
- Lịch tiêm phòng
- Đối với mục "Lịch tiêm phòng", hãy cung cấp lịch trình chung dựa trên thông tin sau:
  - **Vắc xin cốt lõi (Cần thiết):** Parvovirus, Distemper, Adenovirus (Viêm gan), Parainfluenza (DAPP/DHPP), và Rabies (Bệnh dại).
  - **Lịch cho chó con:** Bắt đầu từ 6-8 tuần tuổi và nhắc lại mỗi 3-4 tuần cho đến 16 tuần tuổi.
  - **Lịch cho chó trưởng thành:** Tiêm nhắc lại vắc xin DAPP/DHPP 1 năm sau loạt tiêm cuối cùng, sau đó 3 năm/lần; Vắc xin dại theo quy định pháp luật.
  - **Vắc xin không cốt lõi:** Đề cập việc tham khảo ý kiến bác sĩ thú y về các vắc xin không cốt lõi (ví dụ: Bordetella, Leptospirosis) dựa trên môi trường sống của chó.
- Lưu ý khi nuôi trong môi trường căn hộ
- Lời khuyên cụ thể cho các vấn đề sức khỏe sau: ${issuesString}

YÊU CẦU QUAN TRỌNG:
- KHÔNG sử dụng định dạng bảng Markdown. Hãy dùng danh sách.
- Sử dụng dấu gạch ngang (-) cho các gạch đầu dòng, không dùng dấu hoa thị (*).
- Có thể sử dụng Markdown để in đậm chữ (ví dụ: **Vắc xin cốt lõi**) bên trong các mục của danh sách.
- Với mỗi mục (ví dụ: "Chế độ dinh dưỡng và khẩu phần", "Thời gian vận động cần thiết mỗi ngày"), hãy sử dụng tiêu đề Markdown cấp 3.
- Với mỗi vấn đề sức khỏe cụ thể trong danh sách, cũng tạo một tiêu đề Markdown cấp 3 riêng (ví dụ: "### Loạn sản khớp háng").
- Bên dưới mỗi tiêu đề, cung cấp một danh sách gạch đầu dòng từ 2-4 khuyến nghị quan trọng nhất, sử dụng dấu gạch ngang (-).
- Giữ cho lời khuyên ngắn gọn, chuyên nghiệp và dễ hiểu.
- Không thêm bất kỳ đoạn văn giới thiệu hay kết luận nào. Chỉ cần các tiêu đề và danh sách.

Ví dụ:
### Chế độ dinh dưỡng và khẩu phần
- Khuyến nghị 1.
- Khuyến nghị 2.

### Thời gian vận động cần thiết mỗi ngày
- Khuyến nghị 3.
- Khuyến nghị 4.

### Loạn sản khớp háng
- Biện pháp phòng ngừa 1.
- Biện pháp phòng ngừa 2.
`;

    const operation = () => healthModel.generateContent(prompt);

    const result = await withRetry(
      operation,
      3,
      1000,
      `HealthRec for ${breed}`
    );

    return result.response.text();
  } catch (error) {
    const errorMessage =
      lang === "en"
        ? "I'm having a little trouble thinking of recommendations right now. Please try again in a moment."
        : "Mình đang gặp chút sự cố khi lấy khuyến nghị, bạn thử lại sau nhé.";
    return errorMessage;
  }
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
interface ShopeeProduct {
  name: string;
  imageUrl: string;
  productUrl: string;
}
async function scrapeFirstShopeeProduct(
  keyword: string
): Promise<ShopeeProduct | null> {
  const encodedKeyword = encodeURIComponent(keyword);
  const searchUrl = `https://shopee.vn/search?keyword=${encodedKeyword}`;

  const options = new chrome.Options();
  options.addArguments(
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  );
  options.excludeSwitches("enable-automation");

  let driver: WebDriver | null = null;

  try {
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    await driver.executeScript(
      "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    );

    await driver.get(searchUrl);

    try {
      const popupCloseButton = await driver.wait(
        until.elementLocated(By.css("div.shopee-popup__close-btn")),
        5000
      );
      await driver.executeScript("arguments[0].click();", popupCloseButton);
      await sleep(1000);
    } catch (error) { }

    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight);"
    );
    await sleep(1000);
    await driver.executeScript("window.scrollTo(0, 0);");
    await sleep(500);

    const resultsContainerSelector = By.css(
      "div.shopee-search-item-result__items"
    );

    const resultsContainer = await driver.wait(
      until.elementLocated(resultsContainerSelector),
      30000
    );

    const productXPathSelector = ".//a[contains(@href, '-i.')]";
    const firstProductElement = await resultsContainer.findElement(
      By.xpath(productXPathSelector)
    );

    const productUrl = await firstProductElement.getAttribute("href");
    const name =
      (await firstProductElement
        .findElement(By.css('div[data-sqe="name"]'))
        .getText()) || keyword;
    const imageUrl = await firstProductElement
      .findElement(By.css("img.shopee-search-item-result__item-image-img"))
      .getAttribute("src");

    return { name, imageUrl, productUrl };
  } catch (error) {
    if (driver) {
      const image = await driver.takeScreenshot();
      const safeKeyword = keyword
        .replace(/[\\/:*?"<>|]/g, "_")
        .substring(0, 100);
      const screenshotPath = `selenium_error_${safeKeyword}.png`;
      require("fs").writeFileSync(screenshotPath, image, "base64");
    }
    return null;
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}
async function createAffiliateLinkManually(
  destinationUrl: string
): Promise<string | null> {
  const affiliateId = process.env.ACCESSTRADE_API_KEY;
  if (!affiliateId) {
    return null;
  }

  const encodedDestinationUrl = encodeURIComponent(destinationUrl);

  const affiliateLink = `https://fast.accesstrade.com.vn/deep_link/v6?aff_id=${affiliateId}&campaign_id=${SHOPEE_CAMPAIGN_ID}&url=${encodedDestinationUrl}`;

  return affiliateLink;
}

export async function getRecommendedProducts(
  breed: string,
  lang: "vi" | "en" = "vi"
): Promise<string> {
  try {
    const prompt =
      lang === "en"
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

    const resultFromAI = await proRecModel.generateContent(prompt);
    const rawReply = resultFromAI.response.text();

    let ideas: {
      categoryName: string;
      searchKeywords: string;
      reason: string;
    }[] = [];
    try {
      const jsonString = rawReply.match(/\[[\s\S]*\]/)?.[0];
      if (jsonString) {
        ideas = JSON.parse(jsonString);
      } else {
        throw new Error("Không tìm thấy mảng JSON trong phản hồi của AI.");
      }
    } catch (e) {
      return "[]";
    }

    const finalRecommendations = [];

    for (const idea of ideas) {
      if (!idea.searchKeywords) {
        continue;
      }

      const mainKeyword = idea.searchKeywords.split(",")[0].trim();

      const shopeeSearchUrl = `https://shopee.vn/search?keyword=${encodeURIComponent(
        mainKeyword
      )}`;

      finalRecommendations.push({
        category: idea.categoryName,
        reason: idea.reason,
        shopeeUrl: shopeeSearchUrl,
      });
    }

    return JSON.stringify(finalRecommendations);
  } catch (error) {
    return "[]";
  }
}
