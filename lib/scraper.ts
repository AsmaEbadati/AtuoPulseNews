import * as cheerio from "cheerio";
import type { RawNewsItem } from "./types";

const NEWS_URL = "https://bama.ir/news";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * استخراج لیست آخرین اخبار از bama.ir/news
 *
 * ساختار واقعی صفحه (بر اساس بررسی HTML):
 *  - کارت‌های اصلی: <a class="related-posts" href="/news/{id}/{slug}">
 *      <h2 class="news-title" title="عنوان">
 *      <h3 class="news-subtitle" title="زیرنویس">
 *      <div class="image-holder"><img src="...">
 *      <div class="news_time">زمان
 *  - اسلایدر بالای صفحه: <a class="slider-info" href="/news/{id}/{slug}">
 *      <p class="title">عنوان
 *      <h2 class="subtitle">زیرنویس
 *      <img src="...">
 */
export async function scrapeBamaNews(): Promise<RawNewsItem[]> {
  let html: string;

  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "fa-IR,fa;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      // هر ۱۵ ثانیه تایم‌اوت
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`bama.ir responded with status ${res.status}`);
    }

    html = await res.text();
  } catch (err) {
    console.error("[scraper] fetch failed:", err);
    throw new Error(
      `Failed to fetch ${NEWS_URL}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const $ = cheerio.load(html);
  const items = new Map<string, RawNewsItem>(); // key = source_url برای dedup درون‌لیستی

  const resolveUrl = (href: string | undefined): string | null => {
    if (!href) return null;
    try {
      return new URL(href, NEWS_URL).toString();
    } catch {
      return null;
    }
  };

  // --- 1) کارت‌های اصلی (related-posts) ---
  $("a.related-posts").each((_, el) => {
    const $card = $(el);
    const href = $card.attr("href");
    const sourceUrl = resolveUrl(href);
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

    const imageUrl = resolveUrl(imageRaw);

    items.set(sourceUrl, {
      title,
      source_url: sourceUrl,
      image_url: imageUrl,
      excerpt: subtitle,
      published_date: parseRelativeTime(time),
    });
  });

  // --- 2) اسلایدر بالای صفحه (slider-info) ---
  $("a.slider-info").each((_, el) => {
    const $card = $(el);
    const href = $card.attr("href");
    const sourceUrl = resolveUrl(href);
    if (!sourceUrl || !sourceUrl.includes("/news/")) return;
    if (items.has(sourceUrl)) return; // اگر قبلاً ثبت شده رد کن

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

/**
 * تبدیل زمان نسبی فارسی/متنی به ISO string تقریبی.
 * اگر قابل تفسیر نبود، null برمی‌گرداند (از صفحه لیست معمولاً تاریخ دقیق نیست).
 */
function parseRelativeTime(timeText: string | undefined | null): string | null {
  if (!timeText) return null;
  const t = timeText.trim();

  if (t.includes("دیروز")) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }

  // "N ساعت پیش" یا "N دقیقه پیش" → فقط برای اطلاع، تاریخ امروز
  if (/ساعت|دقیقه|امروز/.test(t)) {
    return new Date().toISOString();
  }

  return null;
}
