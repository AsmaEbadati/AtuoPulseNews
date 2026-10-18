import { getSupabaseClient, isSupabaseConfigured } from "../supabase";

/**
 * فاز ۴ — انتشار در تلگرام (Telegram Bot API).
 *
 * جریان کار با idempotency (وابسته به جدول publications و RPC های schema):
 *   1) claim_publication(news_id, 'telegram') را صدا می‌زنیم.
 *      - اگر false برگرداند ⇒ قبلاً منتشر شده یا در حال پردازش است ⇒ رد می‌شویم.
 *   2) پیام (عکس + کپشن یا فقط متن) را با Bot API ارسال می‌کنیم.
 *   3) complete_publication(...) با وضعیت success/error و لینک پیام.
 *
 * نکته: کپشن‌ها plain ارسال می‌شوند تا خطای parse (Markdown/HTML) رخ ندهد.
 */

const TELEGRAM_API = "https://api.telegram.org";

const DEFAULT_BOT_TOKEN = "8783134519:AAHz8iS8AWf3TCRVFhs7aJ2x7miuZdRWM3c";
const DEFAULT_CHANNEL_ID = "@autopulsenewsai";

/** تلگرام/کانال کانفیگ شده؟ */
export const isTelegramConfigured = true;

function requireConfig() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN).trim();
  const chatId = (process.env.TELEGRAM_CHANNEL_ID || DEFAULT_CHANNEL_ID).trim();
  return { token, chatId };
}

interface TelegramResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

/** فراخوانی یک متد از Bot API. */
async function callApi<T = any>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const { token } = requireConfig();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json()) as TelegramResponse<T>;
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`);
  }
  return data.result as T;
}

/** ساخت لینک عمومی پیام در کانال */
function buildMessageLink(chatId: string, messageId: number): string | null {
  if (chatId.startsWith("@")) {
    return `https://t.me/${chatId.slice(1)}/${messageId}`;
  }
  // chat_id کانال‌های عمومی معمولاً با -100 شروع می‌شود.
  const m = String(chatId).match(/^-?(\d+)$/);
  if (!m) return null;
  const numeric = m[1];
  const internalId = numeric.startsWith("-100") ? numeric.slice(3) : numeric;
  return `https://t.me/c/${internalId}/${messageId}`;
}

// ------------------------------------------------------------------
// idempotency با RPC های schema (security definer، فقط service_role)
// ------------------------------------------------------------------
async function claimPublication(newsId: string): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db.rpc("claim_publication", {
    p_news_id: newsId,
    p_destination: "telegram",
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
    p_destination: "telegram",
    p_status: status,
    p_post_url: postUrl,
    p_error: errorMessage,
  });
  if (error) throw new Error(`complete_publication failed: ${error.message}`);
}

export interface PublishResult {
  news_id: string;
  destination: "telegram";
  status: "success" | "skipped" | "error";
  post_url?: string;
  error?: string;
}

/** حداقل داده‌ای که برای انتشار لازم است. */
export interface TelegramNews {
  id: string;
  title: string;
  tg_caption: string | null;
  image_url: string | null;
  source_image_url: string | null;
}

/**
 * انتشار یک خبر در کانال تلگرام.
 * - اگر کانال/توکن تنظیم نشده باشد ⇒ skipped.
 * - اگر قبلاً منتشر شده ⇒ skipped (idempotent).
 */
export async function publishToTelegram(news: TelegramNews): Promise<PublishResult> {
  if (!isTelegramConfigured || !isSupabaseConfigured) {
    return { news_id: news.id, destination: "telegram", status: "skipped" };
  }

  // 1) claim (idempotency + جلوگیری از اجرای هم‌زمان)
  let claimed = false;
  try {
    claimed = await claimPublication(news.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { news_id: news.id, destination: "telegram", status: "error", error: msg };
  }
  if (!claimed) {
    return { news_id: news.id, destination: "telegram", status: "skipped" };
  }

  // 2) ساخت محتوا و ارسال
  const caption = (news.tg_caption && news.tg_caption.trim()) || news.title;
  const photo = news.image_url || news.source_image_url || null;

  try {
    let messageId: number | null = null;
    const { chatId } = requireConfig();

    if (photo) {
      // ارسال عکس همراه کپشن
      const msg = await callApi<{ message_id: number; chat: { id: number } }>("sendPhoto", {
        chat_id: chatId,
        photo,
        caption: caption.slice(0, 1024),
      });
      messageId = msg.message_id;
    } else {
      const msg = await callApi<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text: caption,
        disable_web_page_preview: false,
      });
      messageId = msg.message_id;
    }

    const channelHandle = chatId.startsWith("@") ? chatId.slice(1) : chatId;
    const postUrl = (messageId ? buildMessageLink(chatId, messageId) : null) || `https://t.me/${channelHandle}`;
    await completePublication(news.id, "success", postUrl, null);
    console.log(`[telegram] ✅ published "${news.title}" (msg ${messageId})`);
    return { news_id: news.id, destination: "telegram", status: "success", post_url: postUrl ?? undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completePublication(news.id, "error", null, msg);
    console.warn(`[telegram] ❌ failed "${news.title}": ${msg}`);
    return { news_id: news.id, destination: "telegram", status: "error", error: msg };
  }
}
