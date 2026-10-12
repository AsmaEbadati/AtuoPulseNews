import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton client با Service Role Key (فقط سمت سرور استفاده شود).
// Service Role Key تمام محدودیت‌های RLS را دور می‌زند؛ بنابراین هرگز نباید
// با پیشوند NEXT_PUBLIC_ به کلاینت در دسترس قرار گیرد.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase config missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables."
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

// export یک instance آماده برای استفاده راحت (اگر config موجود باشد)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
