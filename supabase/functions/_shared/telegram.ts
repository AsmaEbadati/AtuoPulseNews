// فاز ۴ — انتشار در تلگرام (Telegram Bot API) — پورت lib/publisher/telegram.ts
// idempotency از طریق RPC های schema (claim_publication / complete_publication).

import { getServiceClient } from "./supabase.ts";

const TELEGRAM_API = "https://api.telegram.org";

const DEFAULT_BOT_TOKEN = "8783134519:AAHz8iS8AWf3TCRVFhs7aJ2x7miuZdRWM3c";
const DEFAULT_CHANNEL_ID = "@autopulsenewsai";

export const isTelegramConfigured = true;

function requireConfig() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") || DEFAULT_BOT_TOKEN;
  let chatId = Deno.env.get("TELEGRAM_CHANNEL_ID") || DEFAULT_CHANNEL_ID;
  if (chatId === "104067526") chatId = DEFAULT_CHANNEL_ID;
  return { token, chatId };
}

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
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? res.status}`);
  return data.result as T;
}

function buildMessageLink(chatId: string, messageId: number): string | null {
  if (chatId.startsWith("@")) {
    return `https://t.me/${chatId.slice(1)}/${messageId}`;
  }
  const m = String(chatId).match(/^-?(\d+)$/);
  if (!m) return null;
  const numeric = m[1];
  const internalId = numeric.startsWith("-100") ? numeric.slice(3) : numeric;
  return `https://t.me/c/${internalId}/${messageId}`;
}

export interface TelegramNews {
  id: string;
  title: string;
  tg_caption: string | null;
  image_url: string | null;
  source_image_url: string | null;
}

export interface PublishResult {
  news_id: string;
  destination: "telegram";
  status: "success" | "skipped" | "error";
  post_url?: string;
  error?: string;
}

export async function publishToTelegram(news: TelegramNews): Promise<PublishResult> {
  if (!isTelegramConfigured) {
    return { news_id: news.id, destination: "telegram", status: "skipped" };
  }
  const db = getServiceClient();

  // 1) claim (idempotency + جلوگیری از اجرای هم‌زمان)
  let claimed = false;
  try {
    const { data, error } = await db.rpc("claim_publication", {
      p_news_id: news.id,
      p_destination: "telegram",
    });
    if (error) throw new Error(`claim_publication failed: ${error.message}`);
    claimed = data === true;
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
      const msg = await callApi<{ message_id: number }>("sendPhoto", {
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
    await db.rpc("complete_publication", {
      p_news_id: news.id,
      p_destination: "telegram",
      p_status: "success",
      p_post_url: postUrl,
      p_error: null,
    });
    console.log(`[telegram] ✅ published "${news.title}" (msg ${messageId})`);
    return { news_id: news.id, destination: "telegram", status: "success", post_url: postUrl ?? undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.rpc("complete_publication", {
      p_news_id: news.id,
      p_destination: "telegram",
      p_status: "error",
      p_post_url: null,
      p_error: msg,
    });
    console.warn(`[telegram] ❌ failed "${news.title}": ${msg}`);
    return { news_id: news.id, destination: "telegram", status: "error", error: msg };
  }
}
