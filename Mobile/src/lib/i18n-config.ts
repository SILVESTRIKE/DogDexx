export const locales = ["en", "vi"];

export async function getMessages(locale: string) {
  if (!locales.includes(locale)) {
    // Trả về mặc định tiếng Anh nếu locale không hợp lệ
    locale = "en";
  }

  const messages = await import(`./i18n/messages/${locale}.ts`);
  return messages.default;
}