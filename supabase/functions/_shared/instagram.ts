// فاز ۴ج — انتشار اینستاگرام از طریق Make (Integromat)
// پورت‌شده از lib/publisher/instagram.ts — idempotency با RPC های schema.
//
// Make Scenario: Custom Webhook → Router(x-make-secret) → Instagram
//   Create Photo Post → Get Media (permalink) → Webhook Response {status, post_url}

import { getServiceClient } from "./supabase.ts";

export const isInstagramConfigured = Boolean(Deno.env.get("MAKE_WEBHOOK_URL"));

function requireConfig() {
  const webhook = Deno.env.get("MAKE_WEBHOOK_URL");
  if (!webhook) throw new Error("MAKE_WEBHOOK_URL is not configured.");
  return { webhook, secret: Deno.env.get("MAKE_SECRET") ?? "" };
}

export interface InstagramNews {
  id: string;
  title: string;
  ig_caption: string | null;
  image_url: string | null;
  source_image_url: string | null;
}

export interface PublishResult {
  news_id: string;
  destination: "instagram";
  status: "success" | "skipped" | "error";
  post_url?: string;
  error?: string;
}

interface MakeResponse {
  status?: "success" | "error";
  post_url?: string;
  error?: string;
}

export async function publishToInstagram(news: InstagramNews): Promise<PublishResult> {
  if (!isInstagramConfigured) {
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

  const db = getServiceClient();

  // 1) claim (idempotency)
  let claimed = false;
  try {
    const { data, error } = await db.rpc("claim_publication", {
      p_news_id: news.id,
      p_destination: "instagram",
    });
    if (error) throw new Error(`claim_publication failed: ${error.message}`);
    claimed = data === true;
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
    if (secret) headers["x-make-secret"] = secret;

    const res = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify({
        news_id: news.id,
        title: news.title,
        image_url: photo,
        caption,
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Make webhook HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    let body: MakeResponse = {};
    try {
      body = (await res.json()) as MakeResponse;
    } catch {
      body = {};
    }

    if (body.status === "error") {
      throw new Error(body.error ?? "Make reported an error.");
    }

    const postUrl = body.post_url ?? null;
    await db.rpc("complete_publication", {
      p_news_id: news.id,
      p_destination: "instagram",
      p_status: "success",
      p_post_url: postUrl,
      p_error: null,
    });
    console.log(`[instagram] ✅ published "${news.title}" via Make${postUrl ? ` → ${postUrl}` : ""}`);
    return {
      news_id: news.id,
      destination: "instagram",
      status: "success",
      post_url: postUrl ?? undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.rpc("complete_publication", {
      p_news_id: news.id,
      p_destination: "instagram",
      p_status: "error",
      p_post_url: null,
      p_error: msg,
    }).catch(() => {});
    console.warn(`[instagram] ❌ failed "${news.title}": ${msg}`);
    return { news_id: news.id, destination: "instagram", status: "error", error: msg };
  }
}
