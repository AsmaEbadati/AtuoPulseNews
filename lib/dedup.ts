import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

/**
 * Dedup بر اساس source_url (که در schema جدید کلید یکتای جدول news_items است).
 * اول به cache حافظه‌ای نگاه می‌کند تا از فراخوانی‌های تکراری DB جلوگیری شود،
 * سپس در صورت نبود، از جدول news_items جست‌وجو می‌کند.
 *
 * @returns true اگر این منبع قبلاً ثبت شده باشد (تکراری است)
 */
const memoryCache = new Set<string>();

export async function isDuplicate(sourceUrl: string): Promise<boolean> {
  // 1) بررسی cache حافظه‌ای
  if (memoryCache.has(sourceUrl)) return true;

  // 2) اگر Supabase تنظیم نشده، فقط بر اساس cache تصمیم می‌گیریم
  if (!isSupabaseConfigured) {
    return false;
  }

  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("news_items")
      .select("id")
      .eq("source_url", sourceUrl)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[dedup] Supabase query error:", error.message);
      // محافظه‌کارانه false تا پایپ‌لاین متوقف نشود.
      return false;
    }

    const dup = data !== null;
    if (dup) memoryCache.add(sourceUrl);
    return dup;
  } catch (err) {
    console.error("[dedup] Unexpected error:", err);
    return false;
  }
}

/**
 * بارگذاری source_url همه رکوردهای موجود در DB به cache حافظه‌ای.
 * در ابتدای هر اجرای پایپ‌لاین فراخوانی می‌شود تا تعداد query ها کم شود.
 */
export async function preloadExistingUrls(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.from("news_items").select("source_url");

    if (error) {
      console.error("[dedup] preload error:", error.message);
      return 0;
    }

    let count = 0;
    for (const row of data ?? []) {
      if (row.source_url) {
        memoryCache.add(row.source_url);
        count++;
      }
    }
    return count;
  } catch (err) {
    console.error("[dedup] preload unexpected error:", err);
    return 0;
  }
}

/** پاک کردن cache حافظه‌ای (مفید برای تست) */
export function clearDedupCache(): void {
  memoryCache.clear();
}

