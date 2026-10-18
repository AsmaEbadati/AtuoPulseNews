import { getPublicClient } from "./supabase-public";

/**
 * خواندن اخبار منتشرشده + لینک‌های انتشار هر خبر.
 *
 * view عمومی public_news فقط خبرهای success روی «سایت» را می‌دهد.
 * view عمومی public_status ردیف‌های هر مقصد (site/telegram/instagram)
 * با post_url آن‌ها را دارد. این‌ها را با هم ترکیب می‌کنیم تا هر کارت
 * بتواند لینک خبر اصلی (منبع)، نسخهٔ AI (خود صفحه)، تلگرام و اینستاگرام
 * را نشان دهد.
 */

export interface ArticleLinks {
  telegram_url: string | null;
  instagram_url: string | null;
}

export interface ArticleWithLinks {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
  telegram_url: string | null;
  instagram_url: string | null;
}

/** آخرین post_url موفق برای هر (destination) روی یک news_id مشخص. */
async function fetchLinksForIds(
  ids: string[]
): Promise<Record<string, ArticleLinks>> {
  const empty: Record<string, ArticleLinks> = {};
  if (ids.length === 0) return empty;

  const db = getPublicClient();
  if (!db) return empty;

  // public_status فقط news_id ندارد؛ اما بر اساس slug هم قابل پیوند است.
  // برای اطمینان از دقت، روی news_id نمی‌توانیم فیلتر عمومی بزنیم، پس همهٔ
  // ردیف‌های success مقاصد را می‌گیریم و در حافظه به slug نگاشت می‌کنیم.
  const { data, error } = await db
    .from("public_status")
    .select("slug, destination, status, post_url")
    .in("status", ["success"])
    .in("destination", ["telegram", "instagram"]);

  if (error) {
    console.warn("[news-links] public_status fetch failed:", error.message);
    return empty;
  }

  const map: Record<string, ArticleLinks> = {};
  for (const row of data ?? []) {
    const slug = (row as any).slug as string;
    const dest = (row as any).destination as "telegram" | "instagram";
    let url = (row as any).post_url as string | null;
    if (dest === "telegram") {
      if (url && url.includes("104067526")) {
        const msgMatch = url.match(/\/(\d+)$/);
        url = msgMatch ? `https://t.me/autopulsenewsai/${msgMatch[1]}` : "https://t.me/autopulsenewsai";
      } else if (!url) {
        url = "https://t.me/autopulsenewsai";
      }
    } else if (dest === "instagram") {
      if (!url) {
        url = "https://instagram.com/autopulsenews";
      }
    }
    if (!slug || !url) continue;
    if (!map[slug]) map[slug] = { telegram_url: null, instagram_url: null };
    map[slug][dest === "telegram" ? "telegram_url" : "instagram_url"] = url;
  }
  return map;
}

/** لیست اخبار منتشرشدهٔ سایت همراه لینک‌های تلگرام/اینستاگرام. */
export async function getArticlesWithLinks(limit = 60): Promise<ArticleWithLinks[]> {
  const db = getPublicClient();
  if (!db) return [];

  const { data, error } = await db
    .from("public_news")
    .select("id, slug, title, body, image_url, source_url, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[news-links] public_news fetch failed:", error.message);
    return [];
  }

  const articles = (data ?? []) as Omit<ArticleWithLinks, "telegram_url" | "instagram_url">[];
  const links = await fetchLinksForIds(articles.map((a) => a.id));

  return articles.map((a) => ({
    ...a,
    telegram_url: links[a.slug]?.telegram_url ?? null,
    instagram_url: links[a.slug]?.instagram_url ?? null,
  }));
}

/** یک خبر منتشرشده بر اساس slug + لینک‌های انتشارش. */
export async function getArticleWithLinks(
  slug: string
): Promise<ArticleWithLinks | null> {
  const db = getPublicClient();
  if (!db) return null;

  const { data, error } = await db
    .from("public_news")
    .select("id, slug, title, body, image_url, source_url, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[news-links] public_news fetch failed:", error.message);
    return null;
  }
  if (!data) return null;

  const links = await fetchLinksForIds([(data as any).id]);
  const s = (data as any).slug as string;

  return {
    ...(data as Omit<ArticleWithLinks, "telegram_url" | "instagram_url">),
    telegram_url: links[s]?.telegram_url ?? null,
    instagram_url: links[s]?.instagram_url ?? null,
  };
}
