// process-news — تابع سنگین (یک خبر کامل، سقف ~۱۵۰ ثانیه مخصوص خودش).
// ورودی: { news_id } (یا { source_url }). خروجی: وضعیت پردازش آن خبر.
//
// مراحل برای یک خبر:
//   1) دریافت متن کامل خبر از صفحهٔ منبع (scrapeArticleBody)
//   2) بازنویسی با AI (NVIDIA) → rewritten_text + tg_caption + ig_caption
//   3) ذخیره در news_items (process_status=ready)
//   4) انتشار سایت: claim_publication(site) + complete_publication(success)
//   5) انتشار تلگرام: publishToTelegram (idempotent)
//
// idempotency: اگر اجرای قبلی نیمه‌کاره رها شده، مقصدهای success شده دوباره
// اجرا نمی‌شوند (claim_publication آن‌ها را رد می‌کند).

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { scrapeArticleBody } from "../_shared/bama.ts";
import { generateContent } from "../_shared/ai.ts";
import { publishToTelegram } from "../_shared/telegram.ts";
import { publishToInstagram } from "../_shared/instagram.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const PIPELINE_SECRET = Deno.env.get("PIPELINE_SECRET_KEY") ?? Deno.env.get("PIPELINE_SECRET");
  if (PIPELINE_SECRET) {
    const provided = req.headers.get("x-pipeline-secret") ?? "";
    if (!timingSafeEqual(provided, PIPELINE_SECRET)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const db = getServiceClient();

  let news_id: string | null = null;
  let source_url: string | null = null;
  try {
    const body = await req.json();
    news_id = body.news_id ?? null;
    source_url = body.source_url ?? null;
  } catch {
    // بدنهٔ خالی → تلاش برای گرفتن قدیمی‌ترین خبر pending در ادامه
  }

  // اگر news_id/source_url نبود، قدیمی‌ترین خبرِ آمادهٔ پردازش را بردار
  let item: any = null;
  if (news_id) {
    const { data } = await db.from("news_items").select("*").eq("id", news_id).maybeSingle();
    item = data;
  } else if (source_url) {
    const { data } = await db.from("news_items").select("*").eq("source_url", source_url).maybeSingle();
    item = data;
  } else {
    const { data } = await db
      .from("news_items")
      .select("*")
      .in("process_status", ["new", "processing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    item = data;
  }

  if (!item) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, note: "no pending news" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const id = item.id as string;

  // علامت‌گذاری processing (برای cron پایشی که دوباره صدا می‌زند)
  await db.from("news_items").update({ process_status: "processing" }).eq("id", id);

  const result: Record<string, unknown> = { news_id: id, title: item.title };

  try {
    // 1) متن کامل از صفحهٔ منبع
    const article = await scrapeArticleBody(item.source_url);
    const excerpt = (article?.body && article.body.trim()) || item.original_text || item.title;
    const betterImage = article?.image_url ?? item.source_image_url ?? null;

    // 2) بازنویسی با AI
    const content = await generateContent({ title: item.title, excerpt });

    // 3) ذخیرهٔ خروجی AI
    const { error: updErr } = await db
      .from("news_items")
      .update({
        original_text: excerpt,
        rewritten_text: content.rewritten_text,
        tg_caption: content.tg_caption,
        ig_caption: content.ig_caption,
        source_image_url: betterImage,
        image_url: betterImage, // فعلاً از همان تصویر منبع استفاده می‌کنیم
        process_status: "ready",
        process_error: null,
      })
      .eq("id", id);
    if (updErr) throw new Error(`update failed: ${updErr.message}`);
    result.rewritten_len = content.rewritten_text.length;

    // 4) انتشار سایت (idempotent)
    const SITE_URL = (Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://autopulsenews.netlify.app").replace(/\/+$/, "");
    const sitePublicUrl = `${SITE_URL}/news/${item.slug}`;
    let siteStatus = "skipped";
    try {
      const { data: claimed } = await db.rpc("claim_publication", {
        p_news_id: id,
        p_destination: "site",
      });
      if (claimed === true) {
        await db.rpc("complete_publication", {
          p_news_id: id,
          p_destination: "site",
          p_status: "success",
          p_post_url: sitePublicUrl,
          p_error: null,
        });
        siteStatus = "success";
      }
    } catch (e) {
      result.site_error = e instanceof Error ? e.message : String(e);
    }
    result.site = siteStatus;

    // 5) انتشار تلگرام (idempotent)
    const tg = await publishToTelegram({
      id,
      title: item.title,
      tg_caption: content.tg_caption,
      image_url: betterImage,
      source_image_url: betterImage,
    });
    result.telegram = tg.status;
    if (tg.post_url) result.telegram_url = tg.post_url;

    // 6) انتشار اینستاگرام از طریق Make (idempotent)
    const ig = await publishToInstagram({
      id,
      title: item.title,
      ig_caption: content.ig_caption,
      image_url: betterImage,
      source_image_url: betterImage,
    });
    result.instagram = ig.status;
    if (ig.post_url) result.instagram_url = ig.post_url;

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[process-news] failed for ${id}:`, msg);
    await db
      .from("news_items")
      .update({ process_status: "error", process_error: msg })
      .eq("id", id);
    result.error = msg;
    return new Response(JSON.stringify({ ok: false, ...result }), {
      status: 200, // 200 تا pg_cron/net.http_post خطای شدید ثبت نکند؛ وضعیت در بدنه است
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
