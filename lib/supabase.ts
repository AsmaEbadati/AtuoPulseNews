import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton client با Service Role Key (فقط سمت سرور).
// Service Role Key تمام محدودیت‌های RLS را دور می‌زند؛ بنابراین هرگز نباید
// با پیشوند NEXT_PUBLIC_ به کلاینت در دسترس قرار گیرد.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * آیا Supabase با مقادیر معتبر تنظیم شده است؟
 * علاوه بر وجود، URL را هم اعتبارسنجی می‌کنیم تا مقادیر placeholder
 * (مثل your_supabase_project_url) باعث کرش build نشوند.
 */
function isValidUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseServiceKey && isValidUrl(supabaseUrl)
);

let clientInstance: SupabaseClient | null = null;

/**
 * برگرداندن (یا ساخت تنبل) client سرویس.
 * در صورت نبود config معتبر، خطای واضح می‌دهد.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase config missing or invalid: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables."
    );
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return clientInstance;
}

