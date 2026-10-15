import { getSupabaseClient, isSupabaseConfigured } from "../supabase";
import { getAppSettings } from "../settings";
import { prepareInstagramImage, validateInstagramImage, type InstagramImageRatio } from "../instagram-image";

/**
 * ماژول انتشار در اینستاگرام با دو شیوه:
 *   ۱) Make.com Webhook (توصیه‌شده، بدون نیاز به درگیر شدن با تایید اپ‌های متا)
 *   ۲) Instagram Graph API مستقیم (با توکن و Account ID)
 *
 * قبل از انتشار، تصویر به صورت استاندارد ۱۰۸۰×۱۰۸۰ (یا ۱۰۸۰×۱۳۵۰)
 * با حاشیه بلور شکیل آماده و در Supabase Storage آپلود می‌شود.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const DEFAULT_MAKE_WEBHOOK_URL =
  "https://hook.us2.make.com/gggarffsj3hvwprvvv388hjt968xhrwe";

export const isGraphApiConfigured = Boolean(
  process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID
);

export const isMakeWebhookConfigured = true;

export interface PublishResult {
  news_id: string;
  destination: "instagram";
  status: "success" | "skipped" | "error";
  post_url?: string;
  error?: string;
}

export interface InstagramNews {
  id: string;
  title: string;
  ig_caption: string | null;
  image_url: string | null;
  source_image_url: string | null;
  source_url?: string | null;
}

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

/** فراخوانی POST به Graph API */
async function graphPost(path: string, params: Record<string, string>, token: string): Promise<any> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), {
    method: "POST",
    signal: AbortSignal.timeout(60000),
  });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Instagram ${path} failed: ${msg}`);
  }
  return json;
}

/** ارسال خبر به وب‌هوک Make.com */
export async function sendToMakeWebhook(
  webhookUrl: string,
  payload: {
    news_id: string;
    title: string;
    caption: string;
    image_url: string;
    source_url?: string;
    aspect_ratio: string;
    width: number;
    height: number;
    timestamp: string;
  }
): Promise<{ success: boolean; responseText?: string; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AutoPulse-Make-Publisher/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        success: false,
        error: `Make webhook responded with HTTP ${res.status}: ${responseText}`,
      };
    }

    return { success: true, responseText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Make webhook error: ${msg}` };
  }
}

/**
 * انتشار خبر در اینستاگرام (اتوماتیک از طریق Make.com یا Graph API)
 */
export async function publishToInstagram(news: InstagramNews): Promise<PublishResult> {
  if (!isSupabaseConfigured) {
    return { news_id: news.id, destination: "instagram", status: "skipped" };
  }

  // دریافت تنظیمات ذخیره‌شده
  const settings = await getAppSettings();
  const igConfig = settings.publish_schedule.instagram;
  const webhookUrl =
    igConfig.webhook_url?.trim() ||
    process.env.MAKE_INSTAGRAM_WEBHOOK_URL?.trim() ||
    process.env.INSTAGRAM_WEBHOOK_URL?.trim() ||
    DEFAULT_MAKE_WEBHOOK_URL;
  const ratio: InstagramImageRatio = igConfig.aspect_ratio === "portrait" ? "portrait" : "square";

  const hasMake = Boolean(webhookUrl);
  const hasGraph = isGraphApiConfigured;

  if (!hasMake && !hasGraph) {
    console.log(`[instagram] Skipped: neither Make Webhook nor Graph API is configured.`);
    return {
      news_id: news.id,
      destination: "instagram",
      status: "skipped",
      error: "تنظیمات وب‌هوک Make یا کلیدهای اینستاگرام وارد نشده است.",
    };
  }

  // ۱) بررسی و آماده‌سازی عکس استاندارد اینستاگرام
  const rawPhoto = news.image_url || news.source_image_url || null;
  if (!rawPhoto) {
    return {
      news_id: news.id,
      destination: "instagram",
      status: "error",
      error: "خبر فاقد تصویر است و امکان انتشار در اینستاگرام وجود ندارد.",
    };
  }

  console.log(`[instagram] 🖼️ Preparing ${ratio} image for news ${news.id}...`);
  const prepared = await prepareInstagramImage(rawPhoto, news.id, ratio);
  const finalImageUrl = prepared.finalUrl;

  // اعتبارسنجی تصویر خروجی
  const validation = await validateInstagramImage(finalImageUrl);
  if (!validation.valid && !validation.isInstagramCompliant) {
    console.warn(`[instagram] Image validation warning: ${validation.error}`);
  }

  // ۲) ثبت claim در دیتابیس برای جلوگیری از ارسال تکراری (Idempotency)
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

  const caption = (news.ig_caption && news.ig_caption.trim()) || news.title;

  // ۳) سناریو اول: ارسال از طریق وب‌هوک Make.com (در اولویت)
  if (hasMake) {
    console.log(`[instagram] 🚀 Sending to Make.com webhook: ${webhookUrl}`);
    const makeRes = await sendToMakeWebhook(webhookUrl, {
      news_id: news.id,
      title: news.title,
      caption,
      image_url: finalImageUrl,
      source_url: news.source_url ?? undefined,
      aspect_ratio: ratio === "portrait" ? "4:5" : "1:1",
      width: prepared.width,
      height: prepared.height,
      timestamp: new Date().toISOString(),
    });

    if (makeRes.success) {
      await completePublication(news.id, "success", webhookUrl, null);
      console.log(`[instagram] ✅ Published via Make.com webhook for "${news.title}"`);
      return {
        news_id: news.id,
        destination: "instagram",
        status: "success",
        post_url: webhookUrl,
      };
    } else {
      await completePublication(news.id, "error", null, makeRes.error ?? "Make error").catch(() => {});
      console.warn(`[instagram] ❌ Make webhook failed for "${news.title}": ${makeRes.error}`);
      return {
        news_id: news.id,
        destination: "instagram",
        status: "error",
        error: makeRes.error,
      };
    }
  }

  // ۴) سناریو دوم: ارسال از طریق Graph API مستقیم
  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID!;

    const container = await graphPost(
      `${accountId}/media`,
      { image_url: finalImageUrl, caption },
      token
    );
    const creationId = container.id as string;
    if (!creationId) throw new Error("Graph API did not return a creation id.");

    const published = await graphPost(
      `${accountId}/media_publish`,
      { creation_id: creationId },
      token
    );
    const mediaId = published.id as string;

    await completePublication(news.id, "success", mediaId, null);
    console.log(`[instagram] ✅ Published via Graph API for "${news.title}" (media ${mediaId})`);
    return {
      news_id: news.id,
      destination: "instagram",
      status: "success",
      post_url: `https://instagram.com/p/${mediaId}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completePublication(news.id, "error", null, msg).catch(() => {});
    console.warn(`[instagram] ❌ Graph API failed for "${news.title}": ${msg}`);
    return { news_id: news.id, destination: "instagram", status: "error", error: msg };
  }
}
