import { getSupabaseClient, isSupabaseConfigured } from "../supabase";

/**
 * فاز ۴ج — انتشار در اینستاگرام از طریق Make (Integromat).
 *
 * چرا Make؟ چون Instagram Graph API مستقیماً نیاز به توکن دسترسی تجاری،
 * Instagram Business Account متصل به یک صفحهٔ فیس‌بوک، و وریفای اپ دارد.
 * Make همهٔ این‌ها را با یک Scenario ساده مدیریت می‌کند:
 *
 *   Make Scenario:
 *     1. Custom Webhook      → ما به آن POST می‌زنیم
 *     2. Router/Filter       → بررسی x-make-secret
 *     3. Instagram Business: Create a Photo Post  (image_url + ig_caption)
 *     4. Instagram: Get Media → گرفتن permalink
 *     5. Webhook Response    → { status, post_url }
 *
 * جریان ما (idempotent، دقیقاً مثل تلگرام/سایت):
 *   1) claim_publication(news_id, 'instagram') → جلوگیری از تکرار/هم‌زمانی
 *   2) POST به MAKE_WEBHOOK_URL با هدر x-make-secret
 *      body: { news_id, image_url, caption, title }
 *   3) منتظر پاسخ Make می‌مانیم: { status: "success", post_url } یا خطا
 *   4) complete_publication(...) با نتیجه + permalink
 *
 * نکته: ارسال «هم‌زمان و با انتظار» است (نه fire-and-forget)، چون Make باید
 * عکس را پست کند و permalink را برگرداند. تایم‌اوت سخاوتمندانه است.
 */

export const isInstagramConfigured = Boolean(process.env.MAKE_WEBHOOK_URL);

function requireConfig() {
  const webhook = process.env.MAKE_WEBHOOK_URL;
  if (!webhook) throw new Error("MAKE_WEBHOOK_URL is not configured.");
  return { webhook, secret: process.env.MAKE_SECRET ?? "" };
}

// ------------------------------------------------------------------
// idempotency با RPC های schema (مثل تلگرام/سایت)
// ------------------------------------------------------------------
async function claimPublication(newsId: string): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db.rpc("claim_publication", {
    p_news_id: newsId,
    p_destination: "instagram",
  });
  if (error) throw new Error(`claim_publication failed: ${error.message}`);
  return data === true;
}

async function completePublication(
  newsId: string,
  status: "success" | "error",
  postUrl: string | null,
  errorMessage: string | null
): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db.rpc("complete_publication", {
    p_news_id: newsId,
    p_destination: "instagram",
    p_status: status,
    p_post_url: postUrl,
    p_error: errorMessage,
  });
  if (error) throw new Error(`complete_publication failed: ${error.message}`);
}

export interface PublishResult {
  news_id: string;
  destination: "instagram";
  status: "success" | "skipped" | "error";
  post_url?: string;
  error?: string;
}

/** حداقل داده‌ای که برای انتشار اینستاگرام لازم است. */
export interface InstagramNews {
  id: string;
  title: string;
  ig_caption: string | null;
  image_url: string | null;
  source_image_url: string | null;
}

/** پاسخ Make از Webhook Response ماژول. */
interface MakeResponse {
  status?: "success" | "error";
  post_url?: string;
  error?: string;
}

/**
 * انتشار یک خبر در اینستاگرام از طریق Make.
 * - اگر MAKE_WEBHOOK_URL تنظیم نشده ⇒ skipped.
 * - اگر تصویر نباشد ⇒ error (اینستاگرام بدون عکس پست نمی‌کند).
 * - اگر قبلاً success شده ⇒ skipped (idempotent).
 */
export async function publishToInstagram(news: InstagramNews): Promise<PublishResult> {
  if (!isInstagramConfigured || !isSupabaseConfigured) {
    return { news_id: news.id, destination: "instagram", status: "skipped" };
  }

  const photo = news.image_url || news.source_image_url || null;
  if (!photo) {
    return {
      news_id: news.id,
      destination: "instagram",
      status: "error",
      error: "Instagram requires an image; none available.",
    };
  }

  // 1) claim (idempotency)
  let claimed = false;
  try {
    claimed = await claimPublication(news.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { news_id: news.id, destination: "instagram", status: "error", error: msg };
  }
  if (!claimed) {
    return { news_id: news.id, destination: "instagram", status: "skipped" };
  }

  // 2) ساخت محتوا و POST به Make
  const caption = (news.ig_caption && news.ig_caption.trim()) || news.title;
  const { webhook, secret } = requireConfig();

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // secret هم در بدنه (برای Router/Filter در Make) و هم در هدر (fallback).
    // فیلتر Make را روی فیلد بدنهٔ «secret» بگذار.
    if (secret) headers["x-make-secret"] = secret;

    const res = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify({
        news_id: news.id,
        title: news.title,
        image_url: photo,
        caption,
        secret,
      }),
      // Make ممکن است چند ثانیه طول بکشد (آپلود عکس + گرفتن permalink)
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Make webhook HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    // Make می‌تواند JSON برگرداند (Webhook Response) یا متن ساده
    let body: MakeResponse = {};
    try {
      body = (await res.json()) as MakeResponse;
    } catch {
      // اگر Make پاسخ JSON نداد، موفق فرض می‌کنیم (post_url ناشناس)
      body = {};
    }

    if (body.status === "error") {
      throw new Error(body.error ?? "Make reported an error.");
    }

    const postUrl = body.post_url ?? null;
    await completePublication(news.id, "success", postUrl, null);
    console.log(`[instagram] ✅ published "${news.title}" via Make${postUrl ? ` → ${postUrl}` : ""}`);
    return {
      news_id: news.id,
      destination: "instagram",
      status: "success",
      post_url: postUrl ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completePublication(news.id, "error", null, msg).catch(() => {});
    console.warn(`[instagram] ❌ failed "${news.title}": ${msg}`);
    return { news_id: news.id, destination: "instagram", status: "error", error: msg };
  }
}
