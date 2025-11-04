import { notFound } from "next/navigation";

export const locales = ["en", "vi"];

export async function getMessages(locale: string) {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale)) {
    notFound();
  }

  // Dynamically import the message file
  return (await import(`./i18n/messages/${locale}.ts`)).default;
}
