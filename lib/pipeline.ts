import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { scrapeBamaNews } from "./scraper";
import { isDuplicate, preloadExistingUrls } from "./dedup";
import { generateSlug } from "./slug";
import { scrapeArticleBody } from "./article";
import { generateContent, isAIConfigured } from "./ai";
import { publishToTelegram } from "./publisher/telegram";
import { publishToSite } from "./publisher/site";
import type {
  ArticleProcessResult,
  PipelineRunDetails,
  RawNewsItem,
  RunLog,
} from "./types";

/**
 * ارکستراسیون پایپ‌لاین — فاز ۲ (Scrape + Dedup + ذخیره در DB).
 *
 * ⚠️ فاز ۳ و ۴ به این تابع اضافه خواهند شد:
 *    - پس از ذخیره، فراخوانی ماژول AI (lib/ai.ts) برای تولید محتوا
 *    - سپس انتشار در تلگرام/اینستاگرام (lib/publisher/*)
 *    ساختار زیر (run log + نتیجه per-article) در هر دو حالت ثابت می‌ماند.
 */

export interface PipelineResult {
  run_id: string;
  status: "success" | "partial" | "failed" | "running";
  articles_found: number;
  articles_new: number;
  articles_published: number;
  error_message: string | null;
  details: PipelineRunDetails;
}

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return getSupabaseClient();
}

async function createRunRecord(): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("run_logs")
    .insert({ trigger: "manual", found_count: 0, new_count: 0, success_count: 0, error_count: 0 })
    .select("id")
    .single();

  if (error) throw new Error(`createRunRecord failed: ${error.message}`);
  return data.id as string;
}

async function finalizeRunRecord(
  runId: string,
  result: Omit<PipelineResult, "run_id">
): Promise<void> {
  const db = requireSupabase();
  await db
    .from("run_logs")
    .update({
      finished_at: new Date().toISOString(),
      found_count: result.articles_found,
      new_count: result.articles_new,
      success_count: result.articles_published,
      error_count: result.details.errors.length,
      note: result.error_message,
    })
    .eq("id", runId);
}

async function saveNewArticle(item: RawNewsItem): Promise<string> {
  const db = requireSupabase();
  const slug = generateSlug(item.title, item.source_url);

  const { error } = await db.from("news_items").upsert(
    {
      source_url: item.source_url,
      slug,
      title: item.title,
      original_text: item.excerpt,
      source_image_url: item.image_url,
      source_date: item.published_date,
      process_status: "new",
    },
    { onConflict: "source_url", ignoreDuplicates: true }
  );

  if (error) throw new Error(`saveNewArticle failed for "${item.title}": ${error.message}`);
  return slug;
}

export async function runPipeline(): Promise<PipelineResult> {
  const runId = await createRunRecord();
  const articleResults: ArticleProcessResult[] = [];
  const errors: string[] = [];

  let articlesFound = 0;
  let articlesNew = 0;

  try {
    // 1) بارگذاری source_url های موجود برای dedup سریع
    await preloadExistingUrls();

    // 2) اسکرپ اخبار
    const items = await scrapeBamaNews();
    articlesFound = items.length;

    // 3) برای هر خبر: dedup + ذخیره
    for (const item of items) {
      try {
        const duplicate = await isDuplicate(item.source_url);

        if (duplicate) {
          articleResults.push({
            title: item.title,
            source_url: item.source_url,
            slug: "-",
            is_duplicate: true,
          });
          continue;
        }

        const slug = await saveNewArticle(item);
        articlesNew++;

        articleResults.push({
          title: item.title,
          source_url: item.source_url,
          slug,
          is_duplicate: false,
        });
      } catch (itemErr) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        errors.push(msg);
        articleResults.push({
          title: item.title,
          source_url: item.source_url,
          slug: "-",
          is_duplicate: false,
          error: msg,
        });
      }
    }

    const status: PipelineResult["status"] =
      errors.length > 0 && articlesNew > 0
        ? "partial"
        : errors.length > 0 && articlesNew === 0
        ? "failed"
        : "success";

    const result: Omit<PipelineResult, "run_id"> = {
      status,
      articles_found: articlesFound,
      articles_new: articlesNew,
      articles_published: 0, // فاز ۴
      error_message: errors.length ? errors.join(" | ") : null,
      details: { articles: articleResults, errors },
    };

    await finalizeRunRecord(runId, result);
    return { run_id: runId, ...result };
  } catch (fatalErr) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    const result: Omit<PipelineResult, "run_id"> = {
      status: "failed",
      articles_found: articlesFound,
      articles_new: articlesNew,
      articles_published: 0,
      error_message: msg,
      details: { articles: articleResults, errors: [msg] },
    };
    try {
      await finalizeRunRecord(runId, result);
    } catch {
      // اگر حتی لاگ کردن هم شکست خورد، همچنان نتیجه را برمی‌گردانیم
    }
    return { run_id: runId, ...result };
  }
}

/**
 * دریافت آخرین اجراها برای داشبورد (از جدول run_logs).
 */
export async function getRecentRuns(limit = 20): Promise<RunLog[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("run_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentRuns failed: ${error.message}`);
  return (data ?? []) as RunLog[];
}

/**
 * فاز ۳ — پردازش اخبار «new» با AI:
 *   برای هر خبر با وضعیت new (قدیمی‌ترین‌ها اول):
 *     1) گرفتن متن کامل از صفحهٔ خودش (scrapeArticleBody)
 *     2) بازنویسی + ساخت کپشن‌ها با AI (generateContent)
 *     3) ذخیره rewritten_text/tg_caption/ig_caption و گذاشتن status = ready
 *   در صورت خطا، status = error و پیام در process_error ذخیره می‌شود.
 *
 * جدا از runPipeline صدا زده می‌شود چون هر فراخوانی AI کند است و
 * نباید با محدودیت زمانی maxDurationِ endpoint اصلی تداخل پیدا کند.
 */
export interface ProcessPendingResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    slug: string;
    title: string;
    status: "ready" | "error";
    rewritten_len?: number;
    error?: string;
  }>;
}

export async function processPendingArticles(limit = 3): Promise<ProcessPendingResult> {
  const db = requireSupabase();
  if (!isAIConfigured) {
    throw new Error("AI not configured. Set NVIDIA_API_KEY.");
  }

  // قدیمی‌ترین اخبار «new» را بردار (FIFO)
  const { data: pending, error: selErr } = await db
    .from("news_items")
    .select("id, source_url, slug, title, source_image_url")
    .eq("process_status", "new")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (selErr) throw new Error(`processPendingArticles select failed: ${selErr.message}`);

  const results: ProcessPendingResult["results"] = [];
  let succeeded = 0;
  let failed = 0;

  for (const item of pending ?? []) {
    try {
      // 1) نشانه‌گذاری processing (جلوگیری از پردازش هم‌زمان توسط اجرای دیگر)
      await db
        .from("news_items")
        .update({ process_status: "processing" })
        .eq("id", item.id);

      // 2) متن کامل از صفحهٔ خودش
      const article = await scrapeArticleBody(item.source_url);

      // ورودی AI: متن کامل اگر بود، وگرنه عنوان
      const excerpt =
        article?.body && article.body.length > 40
          ? article.body.slice(0, 6000)
          : item.title;

      // 3) تولید محتوا با AI
      const content = await generateContent({
        title: article?.title || item.title,
        source_url: item.source_url,
        image_url: article?.image_url ?? item.source_image_url ?? null,
        excerpt,
        published_date: null,
      });

      // 4) ذخیرهٔ خروجی AI
      const { error: updErr } = await db
        .from("news_items")
        .update({
          original_text: excerpt, // نگهداری متن کامل مرجع
          rewritten_text: content.rewritten_text,
          tg_caption: content.tg_caption,
          ig_caption: content.ig_caption,
          // اگر تصویر بهتری از صفحه گرفتیم، source_image_url را به‌روز کن
          source_image_url: article?.image_url ?? item.source_image_url ?? null,
          process_status: "ready",
          process_error: null,
        })
        .eq("id", item.id);

      if (updErr) throw new Error(`update failed: ${updErr.message}`);

      succeeded++;
      results.push({
        slug: item.slug,
        title: item.title,
        status: "ready",
        rewritten_len: content.rewritten_text.length,
      });
      console.log(
        `[pipeline:ai] ✅ "${item.title}" → ready (${content.rewritten_text.length} chars)`
      );
    } catch (itemErr) {
      const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
      failed++;
      // بازگرداندن به error + ثبت پیام
      await db
        .from("news_items")
        .update({ process_status: "error", process_error: msg })
        .eq("id", item.id);
      results.push({ slug: item.slug, title: item.title, status: "error", error: msg });
      console.warn(`[pipeline:ai] ❌ "${item.title}": ${msg}`);
    }
  }

  return { processed: (pending ?? []).length, succeeded, failed, results };
}

/**
 * فاز ۴ — انتشار اخبار «ready» در مقاصد (فعلاً تلگرام).
 *
 * برای هر خبر ready (قدیمی‌ترین اول):
 *   - تلگرام: publishToTelegram (idempotent از طریق جدول publications)
 *
 * idempotency کل زنجیره تضمین‌شده است: اگر news_id قبلاً برای مقصد
 * موردنظر success شده باشد، claim_publication آن را رد می‌کند.
 */
export interface PublishReadyResult {
  processed: number;
  site: { success: number; skipped: number; error: number };
  telegram: { success: number; skipped: number; error: number };
  results: Array<{
    title: string;
    site?: { status: "success" | "skipped" | "error"; post_url?: string; error?: string };
    telegram?: { status: "success" | "skipped" | "error"; post_url?: string; error?: string };
  }>;
}

export async function publishReadyArticles(limit = 5): Promise<PublishReadyResult> {
  const db = requireSupabase();

  const { data: ready, error: selErr } = await db
    .from("news_items")
    .select("id, slug, title, rewritten_text, tg_caption, image_url, source_image_url")
    .eq("process_status", "ready")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (selErr) throw new Error(`publishReadyArticles select failed: ${selErr.message}`);

  const results: PublishReadyResult["results"] = [];
  let siteSuccess = 0,
    siteSkipped = 0,
    siteError = 0;
  let tgSuccess = 0,
    tgSkipped = 0,
    tgError = 0;

  for (const item of ready ?? []) {
    // 1) انتشار در سایت (اول سایت، چون پایدارترین و سریع‌ترین مقصد است)
    const site = await publishToSite({
      id: item.id,
      title: item.title,
      slug: item.slug,
      rewritten_text: item.rewritten_text,
    });
    if (site.status === "success") siteSuccess++;
    else if (site.status === "skipped") siteSkipped++;
    else siteError++;
    console.log(`[pipeline:publish] ${item.title} → site:${site.status}`);

    // 2) انتشار در تلگرام
    const tg = await publishToTelegram({
      id: item.id,
      title: item.title,
      tg_caption: item.tg_caption,
      image_url: item.image_url,
      source_image_url: item.source_image_url,
    });
    if (tg.status === "success") tgSuccess++;
    else if (tg.status === "skipped") tgSkipped++;
    else tgError++;
    console.log(`[pipeline:publish] ${item.title} → telegram:${tg.status}`);

    results.push({
      title: item.title,
      site: { status: site.status, post_url: site.post_url, error: site.error },
      telegram: { status: tg.status, post_url: tg.post_url, error: tg.error },
    });
  }

  return {
    processed: (ready ?? []).length,
    site: { success: siteSuccess, skipped: siteSkipped, error: siteError },
    telegram: { success: tgSuccess, skipped: tgSkipped, error: tgError },
    results,
  };
}

