// run-pipeline — تابع سبک (چند ثانیه).
// cron روزانه این را صدا می‌زند. فقط صفحهٔ باما را می‌خواند، خبر جدید را در
// news_items ذخیره می‌کند، برای هر خبر جدید یک درخواست «بدون انتظار» به
// process-news می‌فرستد و در run_logs ثبت می‌کند.
//
// امنیت: header `x-pipeline-secret` باید برابر PIPELINE_SECRET باشد.

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { generateSlug } from "../_shared/slug.ts";
import { scrapeBamaNews } from "../_shared/bama.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
const PIPELINE_SECRET = Deno.env.get("PIPELINE_SECRET_KEY") ?? Deno.env.get("PIPELINE_SECRET");

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkSecret(req: Request): boolean {
  // اگر secret تنظیم نشده باشد، بررسی را رد می‌کنیم تا همیشه کار کند (تست).
  if (!PIPELINE_SECRET) return true;
  const provided = req.headers.get("x-pipeline-secret") ?? "";
  return timingSafeEqual(provided, PIPELINE_SECRET);
}

/** فرستادن درخواست پردازش به process-news بدون انتظار برای پاسخ (fire-and-forget). */
function dispatchProcess(newsId: string): void {
  const url = `${SUPABASE_URL}/functions/v1/process-news`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // EdgeRuntime.waitUntil تا اجرای پس‌زمینه پس از پاسخ اصلی ادامه یابد.
  const p = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ news_id: newsId }),
  }).catch((err) => console.warn(`[run-pipeline] dispatch failed for ${newsId}:`, err));
  // @ts-ignore - موجود در محیط Edge Runtime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!checkSecret(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = getServiceClient();
  const runId = (await db
    .from("run_logs")
    .insert({ trigger: "cron", found_count: 0, new_count: 0, success_count: 0, error_count: 0 })
    .select("id")
    .single());

  const run_id = runId.data?.id as string | undefined;

  let found = 0;
  let newCount = 0;
  const dispatched: string[] = [];
  const errors: string[] = [];

  try {
    // 1) بارگذاری URL های موجود برای dedup
    const { data: existing } = await db.from("news_items").select("source_url");
    const seen = new Set((existing ?? []).map((r: any) => r.source_url));

    // 2) اسکرپ لیست
    const items = await scrapeBamaNews();
    found = items.length;

    // 3) ذخیرهٔ خبرهای جدید + dispatch
    for (const item of items) {
      if (seen.has(item.source_url)) continue; // تکراری
      try {
        const slug = generateSlug(item.title, item.source_url);
        const { data, error } = await db
          .from("news_items")
          .upsert(
            {
              source_url: item.source_url,
              slug,
              title: item.title,
              original_text: item.excerpt,
              source_image_url: item.image_url,
              source_date: item.published_date,
              process_status: "new",
            },
            { onConflict: "source_url", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();

        if (error) throw new Error(`upsert failed: ${error.message}`);
        seen.add(item.source_url);
        newCount++;

        // اگر upsert به‌خاطر ignoreDuplicates هیچ ردیفی برنگرداند،
        // یعنی قبلاً وجود داشت (race) — رد شو.
        if (!data?.id) continue;

        dispatchProcess(data.id as string);
        dispatched.push(data.id as string);
      } catch (err) {
        errors.push(`${item.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 4) به‌روزرسانی run_logs
    if (run_id) {
      await db
        .from("run_logs")
        .update({
          finished_at: new Date().toISOString(),
          found_count: found,
          new_count: newCount,
          success_count: 0, // واقعی‌سازی در process-news
          error_count: errors.length,
          note: errors.length ? errors.join(" | ").slice(0, 1000) : null,
        })
        .eq("id", run_id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        run_id,
        found,
        new: newCount,
        dispatched: dispatched.length,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[run-pipeline] fatal:", msg);
    if (run_id) {
      await db
        .from("run_logs")
        .update({ finished_at: new Date().toISOString(), found_count: found, new_count: newCount, error_count: 1, note: msg })
        .eq("id", run_id);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
