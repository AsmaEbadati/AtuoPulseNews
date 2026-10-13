// Supabase Edge Function shared helpers
// پورت‌شده از lib/ — منطق تست‌شدهٔ پروژه، با Deno/npm imports.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pipeline-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
