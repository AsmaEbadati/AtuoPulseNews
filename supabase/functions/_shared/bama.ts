// استخراج اخبار از bama.ir — پورت lib/scraper.ts + lib/article.ts
import * as cheerio from "npm:cheerio@1.0.0";

const NEWS_URL = "https://bama.ir/news";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface RawNewsItem {
  title: string;
  source_url: string;
  image_url: string | null;
  excerpt: string;
  published_date: string | null;
}

function parseRelativeTime(timeText: string | undefined | null): string | null {
  if (!timeText) return null;
  const t = timeText.trim();
  if (t.includes("دیروز")) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  if (/ساعت|دقیقه|امروز/.test(t)) return new Date().toISOString();
  return null;
}

/** لیست آخرین اخبار از صفحهٔ اصلی bama.ir/news */
export async function scrapeBamaNews(): Promise<RawNewsItem[]> {
  let html: string;
  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "fa-IR,fa;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`bama.ir responded with status ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new Error(`Failed to fetch ${NEWS_URL}: ${err instanceof Error ? err.message : err}`);
  }

  const $ = cheerio.load(html);
  const items = new Map<string, RawNewsItem>();
  const resolveUrl = (href: string | undefined): string | null => {
    if (!href) return null;
    try {
      return new URL(href, NEWS_URL).toString();
    } catch {
      return null;
    }
  };

  // 1) کارت‌های اصلی
  $("a.related-posts").each((_, el) => {
    const $card = $(el);
    const sourceUrl = resolveUrl($card.attr("href"));
    if (!sourceUrl || !sourceUrl.includes("/news/")) return;

    const title =
      $card.find("h2.news-title").first().attr("title")?.trim() ||
      $card.find("h2.news-title").first().text().trim();
    const subtitle =
      $card.find("h3.news-subtitle").first().attr("title")?.trim() ||
      $card.find("h3.news-subtitle").first().text().trim();
    const imageRaw =
      $card.find(".image-holder img").first().attr("src") ||
      $card.find("img").first().attr("src");
    const time = $card.find(".news_time").first().text().trim();

    if (!title) return;
    items.set(sourceUrl, {
      title,
      source_url: sourceUrl,
      image_url: resolveUrl(imageRaw),
      excerpt: subtitle,
      published_date: parseRelativeTime(time),
    });
  });

  // 2) اسلایدر بالای صفحه
  $("a.slider-info").each((_, el) => {
    const $card = $(el);
    const sourceUrl = resolveUrl($card.attr("href"));
    if (!sourceUrl || !sourceUrl.includes("/news/")) return;
    if (items.has(sourceUrl)) return;

    const title =
      $card.find("p.title").first().text().trim() ||
      $card.find(".title").first().text().trim();
    const subtitle = $card.find("h2.subtitle, .subtitle").first().text().trim();
    const imageRaw = $card.find("img").first().attr("src");
    if (!title) return;

    items.set(sourceUrl, {
      title,
      source_url: sourceUrl,
      image_url: resolveUrl(imageRaw),
      excerpt: subtitle,
      published_date: new Date().toISOString(),
    });
  });

  const result = [...items.values()];
  console.log(`[scraper] extracted ${result.length} news items from bama.ir`);
  return result;
}

export interface ScrapedArticle {
  title: string;
  body: string;
  image_url: string | null;
}

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** متن کامل یک خبر از صفحهٔ خودش */
export async function scrapeArticleBody(url: string): Promise<ScrapedArticle | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "fa-IR,fa;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn(`[article] ${url} responded ${res.status}`);
      return null;
    }
    html = await res.text();
  } catch (err) {
    console.warn(`[article] fetch failed for ${url}:`, err);
    return null;
  }

  try {
    const $ = cheerio.load(html);
    const title =
      $("h1.big-title").first().text().trim() ||
      $("h1").first().text().trim() ||
      ($("title").text().split("|")[0] || "").trim();

    let image_url: string | null = null;
    $("img.article-image").each((_, el) => {
      if (image_url) return;
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http")) image_url = src;
    });

    const paragraphs: string[] = [];
    $("div.html-section").each((_, section) => {
      $(section)
        .find("p")
        .each((__, p) => {
          const t = $(p).text().replace(/\s+/g, " ").trim();
          if (t.length >= 25 && !paragraphs.includes(t)) paragraphs.push(t);
        });
    });

    if (paragraphs.length === 0) {
      $(".news-container__main p").each((_, p) => {
        const t = $(p).text().replace(/\s+/g, " ").trim();
        if (t.length >= 25 && !paragraphs.includes(t)) paragraphs.push(t);
      });
    }

    return { title, body: cleanText(paragraphs.join("\n")), image_url };
  } catch (err) {
    console.warn(`[article] parse failed for ${url}:`, err);
    return null;
  }
}
