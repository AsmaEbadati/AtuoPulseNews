// فاز ۴ج — انتشار اینستاگرام با Instagram Graph API (مستقیم، بدون Make)
// پورت‌شده از lib/publisher/instagram.ts — idempotency با RPC های schema.
//
// جریان دو مرحله‌ای Content Publishing API:
//   1) POST /{ig-user-id}/media?image_url=...&caption=...  → creation_id
//   2) POST /{ig-user-id}/media_publish?creation_id=...    → media_id
//   3) GET  /{media_id}?fields=permalink                   → permalink (best-effort)
//
// env لازم: INSTAGRAM_ACCESS_TOKEN و INSTAGRAM_ACCOUNT_ID

import { getServiceClient } from "./supabase.ts";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const isInstagramConfigured = Boolean(
  Deno.env.get("INSTAGRAM_ACCESS_TOKEN") && Deno.env.get("INSTAGRAM_ACCOUNT_ID")
);

function requireConfig() {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  const accountId = Deno.env.get("INSTAGRAM_ACCOUNT_ID");
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN is not configured.");
  if (!accountId) throw new Error("INSTAGRAM_ACCOUNT_ID is not configured.");
  return { token, accountId };
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

async function graphPost(path: string, params: Record<string, string>): Promise<any> {
  const { token } = requireConfig();
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

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const { token } = requireConfig();
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
  const json = (await res.json()) as any;
  if (!res.ok || json.error) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Instagram ${path} failed: ${msg}`);
  }
  return json;
}

async function getPermalink(mediaId: string): Promise<string | null> {
  try {
    const json = await graphGet(mediaId, { fields: "permalink" });
    return (json.permalink as string) ?? null;
  } catch {
    return null;
  }
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
  if (!photo.startsWith("https://")) {
    return {
      news_id: news.id,
      destination: "instagram",
      status: "error",
      error: `Image URL must be public HTTPS: ${photo}`,
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

  // 2) ساخت container و publish
  const caption = (news.ig_caption && news.ig_caption.trim()) || news.title;
  const { accountId } = requireConfig();

  try {
    const container = await graphPost(`${accountId}/media`, {
      image_url: photo,
      caption,
    });
    const creationId = container.id as string;
    if (!creationId) throw new Error("Graph API did not return a creation id.");

    const published = await graphPost(`${accountId}/media_publish`, {
      creation_id: creationId,
    });
    const mediaId = published.id as string;

    const postUrl = mediaId ? await getPermalink(mediaId) : null;

    await db.rpc("complete_publication", {
      p_news_id: news.id,
      p_destination: "instagram",
      p_status: "success",
      p_post_url: postUrl,
      p_error: null,
    });
    console.log(
      `[instagram] ✅ published "${news.title}" (media ${mediaId})${postUrl ? ` → ${postUrl}` : ""}`
    );
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
