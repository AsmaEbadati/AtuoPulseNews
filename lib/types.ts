// TypeScript Types برای پروژه AutoPulse AI

export interface NewsArticle {
  id: string;
  source_url: string;
  source_hash: string;
  title: string;
  image_url: string | null;
  slug: string;

  // محتوای تولیدشده با AI
  content_website: string | null;   // 900-1100 کاراکتر
  content_telegram: string | null;
  content_instagram: string | null;

  // وضعیت انتشار
  published_website: boolean;
  published_telegram: boolean;
  published_instagram: boolean;

  telegram_message_id: string | null;
  instagram_post_id: string | null;

  created_at: string;
  published_at: string | null;
}

export interface PipelineRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "partial" | "failed";
  articles_found: number;
  articles_new: number;
  articles_published: number;
  error_message: string | null;
  details: PipelineRunDetails | null;
}

export interface PipelineRunDetails {
  articles: ArticleProcessResult[];
  errors: string[];
}

export interface ArticleProcessResult {
  title: string;
  source_url: string;
  slug: string;
  is_duplicate: boolean;
  published_website: boolean;
  published_telegram: boolean;
  published_instagram: boolean;
  error?: string;
}

// خبر خام از scraper
export interface RawNewsItem {
  title: string;
  source_url: string;
  image_url: string | null;
  excerpt: string;
  published_date: string | null;
}

// خروجی AI برای هر خبر
export interface AIGeneratedContent {
  content_website: string;    // دقیقاً 900-1100 کاراکتر
  content_telegram: string;   // فرمت Markdown
  content_instagram: string;  // کپشن + هشتگ
}

// وضعیت پایپ‌لاین برای نمایش در UI
export type PublishStatus = "pending" | "success" | "failed" | "skipped";

export interface PublishStatusMap {
  website: PublishStatus;
  telegram: PublishStatus;
  instagram: PublishStatus;
}
