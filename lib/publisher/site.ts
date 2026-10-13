import { getSupabaseClient, isSupabaseConfigured } from "../supabase";

/**
 * فاز ۴ب — انتشار در «سایت» (Netlify).
 *
 * در این معماری، سایت استاتیک روی Netlify است و اخبار را از view عمومی
 * `public_news` می‌خواند (که فقط خبرهایی را نشان می‌دهد که ردیف
 * publications با destination='site' و status='success' دارند).
 *
 * پس «انتشار در سایت» یعنی:
 *   1) claim_publication(news_id, 'site')  → تضمین idempotency
 *   2) ساختن آدرس صفحهٔ خبر روی Netlify:  {SITE_URL}/news/{slug}
 *   3) complete_publication(news_id, 'site', 'success', post_url)
 *
 * از این پس خبر در view public_news ظاهر می‌شود و روی سایت قابل مشاهده است.
 * نیازی به درخواست شبکه نیست؛ صرفاً یک علامت‌گذاری در DB + ثبت لینک عمومی.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");

/** آیا انتشار سایت پیکربندی شده (URL سایت تعیین شده)؟ */
export const isSiteConfigured = Boolean(SITE_URL);

function buildArticleUrl(slug: string): string | null {
  if (!SITE_URL) return null;
  return `${SITE_URL}/news/${slug}`;
}

// ------------------------------------------------------------------
// idempotency با RPC های schema (مثل تلگرام)
// ------------------------------------------------------------------
async function claimPublication(newsId: string): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db.rpc("claim_publication", {
    p_news_id: newsId,
    p_destination: "site",
  });
  if (error) throw new Error(`claim_publication(site) failed: ${error.message}`);
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
    p_destination: "site",
    p_status: status,
    p_post_url: postUrl,
    p_error: errorMessage,
  });
  if (error) throw new Error(`complete_publication(site) failed: ${error.message}`);
}

export interface PublishResult {
  news_id: string;
  destination: "site";
  status: "success" | "skipped" | "error";
  post_url?: string;
  error?: string;
}

/** حداقل داده‌ای که برای انتشار سایت لازم است. */
export interface SiteNews {
  id: string;
  title: string;
  slug: string;
  rewritten_text: string | null;
}

/**
 * انتشار یک خبر در سایت.
 * - اگر NEXT_PUBLIC_SITE_URL تنظیم نشده ⇒ skipped.
 * - اگر rewritten_text خالی باشد ⇒ error (خبر آماده نیست).
 * - اگر قبلاً success شده ⇒ skipped (idempotent).
 */
export async function publishToSite(news: SiteNews): Promise<PublishResult> {
  if (!isSiteConfigured || !isSupabaseConfigured) {
    return { news_id: news.id, destination: "site", status: "skipped" };
  }

  // خبر باید محتوای بازنویسی‌شده داشته باشد تا روی سایت معنا داشته باشد
  if (!news.rewritten_text || news.rewritten_text.trim().length === 0) {
    return {
      news_id: news.id,
      destination: "site",
      status: "error",
      error: "rewritten_text is empty; article is not ready for the site.",
    };
  }

  // 1) claim (idempotency)
  let claimed = false;
  try {
    claimed = await claimPublication(news.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { news_id: news.id, destination: "site", status: "error", error: msg };
  }
  if (!claimed) {
    return { news_id: news.id, destination: "site", status: "skipped" };
  }

  // 2) لینک صفحهٔ خبر روی Netlify
  const postUrl = buildArticleUrl(news.slug);

  // 3) ثبت success + لینک (الان در view public_news دیده می‌شود)
  try {
    await completePublication(news.id, "success", postUrl, null);
    console.log(`[site] ✅ published "${news.title}" → ${postUrl}`);
    return { news_id: news.id, destination: "site", status: "success", post_url: postUrl ?? undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completePublication(news.id, "error", null, msg).catch(() => {});
    console.warn(`[site] ❌ failed "${news.title}": ${msg}`);
    return { news_id: news.id, destination: "site", status: "error", error: msg };
  }
}
