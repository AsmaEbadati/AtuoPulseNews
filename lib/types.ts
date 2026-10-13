// TypeScript Types برای پروژه AutoPulse AI
// هماهنگ با schema جدید Supabase: news_items / publications / run_logs

export interface NewsItem {
  id: string;
  source_url: string;
  slug: string;
  title: string;
  original_text: string | null;      // متن خام از منبع
  rewritten_text: string | null;     // خروجی AI (900-1100 کاراکتر)
  tg_caption: string | null;         // کپشن تلگرام
  ig_caption: string | null;         // کپشن اینستاگرام
  source_image_url: string | null;   // تصویر اصلی روی سایت منبع
  image_url: string | null;          // تصویر نهایی ما (Supabase Storage)
  source_date: string | null;        // تاریخ انتشار روی منبع
  process_status: "new" | "processing" | "ready" | "error";
  process_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Publication {
  id: string;
  news_id: string;
  destination: "site" | "telegram" | "instagram";
  status: "pending" | "success" | "error";
  post_url: string | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface RunLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: "cron" | "manual";
  found_count: number;
  new_count: number;
  success_count: number;
  error_count: number;
  note: string | null;
}

// خبر خام از scraper
export interface RawNewsItem {
  title: string;
  source_url: string;
  image_url: string | null;
  excerpt: string;
  published_date: string | null;
}

// نتیجه پردازش هر خبر در یک اجرای پایپ‌لاین
export interface ArticleProcessResult {
  title: string;
  source_url: string;
  slug: string;
  is_duplicate: boolean;
  error?: string;
}

export interface PipelineRunDetails {
  articles: ArticleProcessResult[];
  errors: string[];
}

// خروجی AI برای هر خبر (فاز ۳)
export interface AIGeneratedContent {
  rewritten_text: string;   // دقیقاً 900-1100 کاراکتر
  tg_caption: string;       // فرمت Markdown
  ig_caption: string;       // کپشن + هشتگ
}

// وضعیت انتشار برای نمایش در UI
export type PublishStatus = "pending" | "success" | "error" | "skipped";

