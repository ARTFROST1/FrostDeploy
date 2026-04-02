export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}
