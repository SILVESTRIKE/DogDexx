/**
 * Converts a string into a URL-friendly and filesystem-friendly slug.
 * - Converts to lowercase.
 * - Replaces spaces and underscores with hyphens.
 * - Removes all non-alphanumeric characters except hyphens.
 * - Trims leading/trailing hyphens.
 * @param text The string to slugify.
 * @returns The slugified string.
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}