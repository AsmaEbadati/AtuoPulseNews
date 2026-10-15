-- ============================================================
-- Migration: افزودن زمانبندی انتشار به جدول publications
-- در Supabase Dashboard → SQL Editor اجرا کنید
-- ============================================================

-- افزودن ستون scheduled_at به جدول publications (اگر وجود نداشت)
ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- افزودن ستون برای محتوای ویرایش‌شده توسط کاربر (override از AI)
ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS edited_website   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edited_telegram  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edited_instagram TEXT DEFAULT NULL;

-- ایندکس برای جست‌وجوی زمانبندی‌شده‌ها
CREATE INDEX IF NOT EXISTS idx_publications_scheduled_at
  ON publications (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- View عمومی برای زمانبندی (برای صفحه /schedule)
-- خبرهای ready که هنوز در سایت منتشر نشده‌اند
CREATE OR REPLACE VIEW public_schedule AS
SELECT
  ni.id,
  ni.slug,
  ni.title,
  ni.source_image_url AS image_url,
  ni.process_status,
  ni.rewritten_text,
  ni.edited_website,
  ni.tg_caption,
  ni.edited_telegram,
  ni.ig_caption,
  ni.edited_instagram,
  ni.created_at,
  -- وضعیت انتشار هر مقصد
  MAX(CASE WHEN p.destination = 'site'      THEN p.status      END) AS site_status,
  MAX(CASE WHEN p.destination = 'telegram'  THEN p.status      END) AS tg_status,
  MAX(CASE WHEN p.destination = 'instagram' THEN p.status      END) AS ig_status,
  MAX(CASE WHEN p.destination = 'site'      THEN p.post_url    END) AS site_url,
  MAX(CASE WHEN p.destination = 'telegram'  THEN p.post_url    END) AS tg_url,
  MAX(CASE WHEN p.destination = 'instagram' THEN p.post_url    END) AS ig_url,
  MAX(CASE WHEN p.destination = 'site'      THEN p.scheduled_at::text END) AS site_scheduled,
  MAX(CASE WHEN p.destination = 'telegram'  THEN p.scheduled_at::text END) AS tg_scheduled,
  MAX(CASE WHEN p.destination = 'instagram' THEN p.scheduled_at::text END) AS ig_scheduled,
  MAX(CASE WHEN p.destination = 'site'      THEN p.error_message END) AS site_error,
  MAX(CASE WHEN p.destination = 'telegram'  THEN p.error_message END) AS tg_error,
  MAX(CASE WHEN p.destination = 'instagram' THEN p.error_message END) AS ig_error,
  MAX(CASE WHEN p.destination = 'site'      THEN p.attempts    END) AS site_attempts,
  MAX(CASE WHEN p.destination = 'telegram'  THEN p.attempts    END) AS tg_attempts,
  MAX(CASE WHEN p.destination = 'instagram' THEN p.attempts    END) AS ig_attempts
FROM news_items ni
LEFT JOIN publications p ON p.news_id = ni.id
WHERE ni.process_status IN ('ready', 'processing')
   OR EXISTS (
     SELECT 1 FROM publications p2
     WHERE p2.news_id = ni.id AND p2.status = 'success'
   )
GROUP BY ni.id, ni.slug, ni.title, ni.source_image_url,
         ni.process_status, ni.rewritten_text, ni.edited_website,
         ni.tg_caption, ni.edited_telegram, ni.ig_caption, ni.edited_instagram, ni.created_at
ORDER BY ni.created_at DESC;

-- دسترسی عمومی به view
GRANT SELECT ON public_schedule TO anon, authenticated;
