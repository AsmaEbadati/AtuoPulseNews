import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { scrapeBamaNews } from "./scraper";
import { hashString, isDuplicate, preloadExistingHashes } from "./dedup";
import { generateSlug } from "./slug";
import type {
  ArticleProcessResult,
  PipelineRun,
  PipelineRunDetails,
  RawNewsItem,
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
    .from("pipeline_runs")
    .insert({ status: "running", articles_found: 0, articles_new: 0, articles_published: 0 })
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
    .from("pipeline_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      articles_found: result.articles_found,
      articles_new: result.articles_new,
      articles_published: result.articles_published,
      error_message: result.error_message,
      details: result.details,
    })
    .eq("id", runId);
}

async function saveNewArticle(item: RawNewsItem): Promise<string> {
  const db = requireSupabase();
  const slug = generateSlug(item.title, item.source_url);
  const source_hash = hashString(item.source_url);

  const { error } = await db.from("news_articles").insert({
    source_url: item.source_url,
    source_hash,
    title: item.title,
    image_url: item.image_url,
    slug,
    content_website: null,
    published_website: false,
    published_telegram: false,
    published_instagram: false,
  });

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
    // 1) بارگذاری hash های موجود برای dedup سریع
    await preloadExistingHashes();

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
            published_website: false,
            published_telegram: false,
            published_instagram: false,
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
          published_website: false,
          published_telegram: false,
          published_instagram: false,
        });
      } catch (itemErr) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        errors.push(msg);
        articleResults.push({
          title: item.title,
          source_url: item.source_url,
          slug: "-",
          is_duplicate: false,
          published_website: false,
          published_telegram: false,
          published_instagram: false,
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
 * دریافت آخرین اجراها برای داشبورد.
 */
export async function getRecentRuns(limit = 20): Promise<PipelineRun[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentRuns failed: ${error.message}`);
  return (data ?? []) as PipelineRun[];
}

