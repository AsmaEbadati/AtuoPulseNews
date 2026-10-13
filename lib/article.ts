import * as cheerio from "cheerio";

/**
 * استخراج «متن کامل» یک خبر از صفحهٔ خودش (bama.ir/news/...).
 *
 * ساختار واقعی صفحه (بر اساس بررسی HTML):
 *  - صفحه‌های عادی: یک <h1 class="big-title"> عنوان اصلی
 *    و یک یا چند <div class="news-container__contents-section"> که هر کدام
 *    یک <h2> (عنوان بخش) و یک <div class="html-section"> با چند <p> دارند.
 *  - برخی صفحه‌ها (مثل صفحه‌های ویژهٔ فروش) چند بخش خبری را با هم نشان می‌دهند؛
 *    در آن حالت همهٔ بخش‌ها را استخراج و به هم می‌چسبانیم.
 *
 * راهبرد:
 *   1) عنوان اصلی از <h1 class="big-title"> یا <title>.
 *   2) هر پاراگراف <p> داخل <div class="html-section"> را برمی‌داریم
 *      (این متن واقعی است، بدون تبلیغ/منوی فرعی).
 *   3) متن‌ها را با "\n" به هم می‌چسبانیم و فاصله‌های اضافه را تمیز می‌کنیم.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface ScrapedArticle {
  title: string;
  body: string; // متن کامل (چند پاراگراف، جدا شده با \n)
  image_url: string | null;
}

/** پاک‌سازی متن: حذف فاصله‌های اضافه و نرمال‌سازی خط جدید. */
function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ") // فاصلهٔ معمولی + نیم‌فاصلهٔ تکراری
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * گرفتن متن کامل یک خبر از URL صفحهٔ خودش.
 * در صورت خطا، به‌جای throw مقدار null برمی‌گرداند تا پایپ‌لاین متوقف نشود
 * (در آن صورت از عنوان/زیرنویس صفحهٔ لیست استفاده می‌شود).
 */
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

    // عنوان اصلی
    const title =
      $("h1.big-title").first().text().trim() ||
      $("h1").first().text().trim() ||
      ($("title").text().split("|")[0] || "").trim();

    // تصویر اصلی (اولین article-image با src واقعی)
    let image_url: string | null = null;
    $("img.article-image").each((_, el) => {
      if (image_url) return;
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src && src.startsWith("http")) image_url = src;
    });

    // پاراگراف‌های متن: داخل هر .html-section، فقط <p>های مستقیم/غیرخالی
    const paragraphs: string[] = [];
    $("div.html-section").each((_, section) => {
      $(section)
        .find("p")
        .each((__, p) => {
          const t = $(p).text().replace(/\s+/g, " ").trim();
          // فیلتر: متن خیلی کوتاه (احتمالاً منو/دکمه) یا تکراری
          if (t.length >= 25 && !paragraphs.includes(t)) {
            paragraphs.push(t);
          }
        });
    });

    // fallback: اگر .html-section نبود، همهٔ <p>های صفحهٔ خبر را بردار
    if (paragraphs.length === 0) {
      $(".news-container__main p").each((_, p) => {
        const t = $(p).text().replace(/\s+/g, " ").trim();
        if (t.length >= 25 && !paragraphs.includes(t)) paragraphs.push(t);
      });
    }

    const body = cleanText(paragraphs.join("\n"));

    return {
      title,
      body,
      image_url,
    };
  } catch (err) {
    console.warn(`[article] parse failed for ${url}:`, err);
    return null;
  }
}
