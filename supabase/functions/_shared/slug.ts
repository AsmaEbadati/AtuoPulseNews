// تولید slug یکتا از عنوان (پورت مستقیم lib/slug.ts)
function normalizeArabic(text: string): string {
  const map: Record<string, string> = {
    "ي": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه",
    "أ": "ا", "إ": "ا", "آ": "ا", "ؤ": "و", "ئ": "ی",
  };
  return text.replace(/[يكةهأإآؤئ]/g, (ch) => map[ch] ?? ch);
}

function toEnglishDigits(text: string): string {
  const map: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return text.replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateSlug(title: string, sourceUrl?: string): string {
  const normalized = normalizeArabic(toEnglishDigits(title)).trim();
  const hasPersian = /[؀-ۿ]/.test(normalized);

  let base: string;
  if (hasPersian) {
    base = hashString(normalized).toString(36);
  } else {
    base = normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  const suffix = sourceUrl
    ? hashString(sourceUrl).toString(36).slice(0, 6)
    : Math.random().toString(36).slice(2, 8);

  return `${base || "news"}-${suffix}`;
}
