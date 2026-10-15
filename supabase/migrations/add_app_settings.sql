-- ============================================================
-- Migration: جدول تنظیمات سراسری انتشار و هوش مصنوعی
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- مقداردهی اولیه تنظیمات زمان‌بندی پلتفرم‌ها و هوش مصنوعی
INSERT INTO app_settings (key, value)
VALUES
  (
    'publish_schedule',
    '{
      "website":   { "enabled": true, "mode": "instant",   "time": "09:30" },
      "telegram":  { "enabled": true, "mode": "instant",   "time": "11:00" },
      "instagram": { "enabled": true, "mode": "scheduled", "time": "18:00" }
    }'::jsonb
  ),
  (
    'ai_settings',
    '{
      "tone": "formal",
      "model": "openai/gpt-oss-20b"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
