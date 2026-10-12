import { createHash } from "crypto";
import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * تولید hash پایدار (SHA-256) از یک رشته.
 * برای مقایسه سریع و مطمئن source_url جهت جلوگیری از انتشار تکراری.
 */
export function hashString(input: string): string {
  return createHash("sha256").update(input.trim(), "utf8").digest("hex");
}

/**
 * بررسی تکراری بودن یک source_url.
 * اول به cache حافظه‌ای نگاه می‌کند تا از فراخوانی‌های تکراری DB جلوگیری شود،
 * سپس در صورت نبود، از جدول news_articles جست‌وجو می‌کند.
 *
 * @returns true اگر این منبع قبلاً ثبت شده باشد (تکراری است)
 */
const memoryCache = new Set<string>();

export async function isDuplicate(sourceUrl: string): Promise<boolean> {
  const hash = hashString(sourceUrl);

  // 1) بررسی cache حافظه‌ای
  if (memoryCache.has(hash)) return true;

  // 2) اگر Supabase تنظیم نشده، فقط بر اساس cache تصمیم می‌گیریم
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("news_articles")
      .select("id")
      .eq("source_hash", hash)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[dedup] Supabase query error:", error.message);
      // در صورت خطای DB، محافظه‌کارانه false برمی‌گردانیم (خبر تکراری منتشر می‌شود)
      // اما این موارد باید در لاگ‌ها رصد شوند. برای اطمینان بیشتر می‌توان
      // رفتار را به true تغییر داد؛ اینجا انتخاب false است تا پایپ‌لاین متوقف نشود.
      return false;
    }

    const dup = data !== null;
    if (dup) memoryCache.add(hash);
    return dup;
  } catch (err) {
    console.error("[dedup] Unexpected error:", err);
    return false;
  }
}

/**
 * بارگذاری hash همه source_url های موجود در DB به cache حافظه‌ای.
 * در ابتدای هر اجرای پایپ‌لاین فراخوانی می‌شود تا تعداد query ها کم شود.
 */
export async function preloadExistingHashes(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;

  try {
    const { data, error } = await supabase
      .from("news_articles")
      .select("source_hash");

    if (error) {
      console.error("[dedup] preload error:", error.message);
      return 0;
    }

    let count = 0;
    for (const row of data ?? []) {
      if (row.source_hash) {
        memoryCache.add(row.source_hash);
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
