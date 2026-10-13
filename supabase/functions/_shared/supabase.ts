// Supabase client با Service Role Key (تنها کلیدی که RLS را دور می‌زند).
// در Edge Functions، env های SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY
// به‌صورت خودکار توسط پلتفرم تزریق می‌شوند (با fallback به مقادیر دستی).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
