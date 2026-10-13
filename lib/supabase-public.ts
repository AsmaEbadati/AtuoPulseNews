import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * کلاینت Supabase فقط-خواندنی برای فرانت‌اند (Server/Client Components).
 *
 * از anon key استفاده می‌کند (نه service_role). viewهای عمومی
 * (public_news / public_runs / public_status) طبق schema به anon و
 * authenticated دسترسی SELECT داده‌اند، پس خواندن با این کلید کافی است.
 * هرگز از service_role در فرانت‌اند استفاده نکن.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let clientInstance: SupabaseClient | null = null;

/** آیا config عمومی (URL + anon key) موجود است؟ */
export const isPublicSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * برگرداندن (یا ساخت تنبل) کلاینت عمومی.
 * در صورت نبود config، null برمی‌گرداند تا صفحه‌ها به‌جای کرش، حالت خالی نشان دهند.
 */
export function getPublicClient(): SupabaseClient | null {
  if (!isPublicSupabaseConfigured) return null;
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clientInstance;
}
