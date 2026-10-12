-- ============================================================
-- AutoPulse AI — Database Schema (Supabase / PostgreSQL)
-- این فایل را در Supabase Dashboard → SQL Editor اجرا کنید.
-- ============================================================

-- جدول اخبار
CREATE TABLE IF NOT EXISTS news_articles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url           TEXT UNIQUE NOT NULL,
  source_hash          TEXT UNIQUE NOT NULL,
  title                TEXT NOT NULL,
  image_url            TEXT,
  slug                 TEXT UNIQUE NOT NULL,
  content_website      TEXT,          -- 900-1100 کاراکتر
  content_telegram     TEXT,
  content_instagram    TEXT,
  published_website    BOOLEAN DEFAULT FALSE,
  published_telegram   BOOLEAN DEFAULT FALSE,
  published_instagram  BOOLEAN DEFAULT FALSE,
  telegram_message_id  TEXT,
  instagram_post_id    TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  published_at         TIMESTAMPTZ
);

-- ایندکس برای جست‌وجوی سریع dedup و مرتب‌سازی
CREATE INDEX IF NOT EXISTS idx_news_articles_source_hash ON news_articles (source_hash);
CREATE INDEX IF NOT EXISTS idx_news_articles_created_at ON news_articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_website ON news_articles (published_website);

-- جدول لاگ اجراهای پایپ‌لاین
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT,           -- success | partial | failed | running
  articles_found      INT DEFAULT 0,
  articles_new        INT DEFAULT 0,
  articles_published  INT DEFAULT 0,
  error_message       TEXT,
  details             JSONB
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs (started_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- چون فقط از سمت سرور با Service Role Key دسترسی داریم،
-- RLS را فعال می‌کنیم و دسترسی anon را می‌بندیم تا امن باشد.
-- (Service Role Key محدودیت‌های RLS را دور می‌زند.)
-- ============================================================
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- اگر نیاز به خواندن عمومی از کلاینت داشتید، این policy را اضافه کنید:
-- CREATE POLICY "public read news" ON news_articles
--   FOR SELECT USING (true);
