// ابزار تولید slug یکتا از عنوان (فارسی/انگلیسی)
// خروجی فقط شامل حروف کوچک انگلیسی، اعداد و خط تیره است.

// نرمال‌سازی حروف عربی/کردی به فارسی استاندارد
function normalizeArabic(text: string): string {
  const map: Record<string, string> = {
    "ي": "ی", // ي → ی
    "ك": "ک", // ك → ک
    "ۀ": "ه", // ۀ → ه
    "ة": "ه", // ة → ه
    "أ": "ا", // أ → ا
    "إ": "ا", // إ → ا
    "آ": "ا", // آ → ا
    "ؤ": "و", // ؤ → و
    "ئ": "ی", // ئ → ی
  };
  return text.replace(/[يكةهأإآؤئ]/g, (ch) => map[ch] ?? ch);
}

// تبدیل اعداد فارسی/عربی به انگلیسی
function toEnglishDigits(text: string): string {
  const map: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return text.replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
}

/**
 * تولید slug از عنوان.
 * اگر عنوان انگلیسی بود، آن را پاکسازی می‌کند؛
 * اگر فارسی بود، یک slug پایدار بر اساس hash می‌سازد.
 * در نهایت با یک suffix کوتاه از منبع یکتاست.
 */
export function generateSlug(title: string, sourceUrl?: string): string {
  const normalized = normalizeArabic(toEnglishDigits(title)).trim();

  let base: string;
  const hasPersian = /[؀-ۿ]/.test(normalized);

  if (hasPersian) {
    // برای عنوان فارسی: از hash پایدار استفاده می‌کنیم تا slug خوانا و یکتا باشد
    base = hashString(normalized).toString(36);
  } else {
    // انگلیسی: پاکسازی استاندارد
    base = normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  // یکتا کردن با کمک source_url یا عدد تصادفی کوتاه
  const suffix = sourceUrl ? hashString(sourceUrl).toString(36).slice(0, 6) : Math.random().toString(36).slice(2, 8);

  return `${base || "news"}-${suffix}`;
}

// hash ساده و پایدار (FNV-1a 32-bit)
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0; // unsigned 32-bit
}
