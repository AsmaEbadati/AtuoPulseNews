-- ============================================================
-- زمان‌بندی پایپ‌لاین با pg_cron → Edge Functions
-- اجرا در: Supabase Dashboard > SQL Editor
-- ============================================================
-- پیش‌نیاز: Edge Function های run-pipeline و process-news دیپلوی شده باشند.
--
-- دو cron داریم:
--   A) daily-news-pipeline   — هر روز ۱۰:۰۰ تهران → run-pipeline
--                              (باما را می‌خواند، خبر جدید را ذخیره و صف می‌سازد)
--   B) news-processor        — هر ۱۰ دقیقه → process-news برای «قدیمی‌ترین خبر new»
--                              (چون run-pipeline به‌صورت fire-and-forget خبر‌ها را
--                               پردازش می‌کند و ممکن است پروسه پس‌زمینه قطع شود؛
--                               این cron پایشی مطمئن می‌شود هیچ خبری روی new نماند.
--                               process-news خودش idempotent است و خبر success‌شده
--                               را دوباره پردازش/منتشر نمی‌کند.)
--
-- نکتهٔ امنیتی: PIPELINE_SECRET_KEY باید همان مقداری باشد که در env تابع
-- تنظیم شده و در هدر x-pipeline-secret فرستاده می‌شود.
-- ============================================================

-- ---------- 1) ذخیرهٔ secrets در Vault (idempotent، یک‌بار) ----------
-- vault.create_secret یک تابع است (نه INSERT)، پس با DO + IF NOT EXISTS
-- مطمئن می‌شویم اگر از قبل وجود دارد دوباره ساخته نشود.

-- pipeline_url: آدرس تابع سبک run-pipeline
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pipeline_url') then
    perform vault.create_secret(
      'https://jcycygforwzryomjeyki.supabase.co/functions/v1/run-pipeline',
      'pipeline_url'
    );
  end if;
end $$;

-- process_url: آدرس تابع سنگین process-news (برای cron پایشی)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'process_url') then
    perform vault.create_secret(
      'https://jcycygforwzryomjeyki.supabase.co/functions/v1/process-news',
      'process_url'
    );
  end if;
end $$;

-- pipeline_secret: همان PIPELINE_SECRET_KEY در .env
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pipeline_secret') then
    perform vault.create_secret(
      'cf12eae2d576f40ef09812d66f8df1289134fbf0650a185e274c7befd2353942',
      'pipeline_secret'
    );
  end if;
end $$;

-- ---------- 2) cron A: اسکرپ ۴ بار در روز → run-pipeline ----------
-- '0 6,10,14,18 * * *' = چهار بار در شبانه‌روز (ساعات ۰۶:۰۰، ۱۰:۰۰، ۱۴:۰۰، ۱۸:۰۰ به وقت UTC)
-- معادل ساعت ۰۹:۳۰، ۱۳:۳۰، ۱۷:۳۰ و ۲۱:۳۰ به وقت رسمی تهران (UTC+03:30)
-- باما را اسکرپ می‌کند، پس از بررسی عدم تکرار در دیتابیس وارد کرده و بلافاصله پردازش با هوش مصنوعی و انتشار ۳ گانه را فراخوانی می‌کند.
select cron.schedule(
  'daily-news-pipeline',
  '0 6,10,14,18 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-pipeline-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_secret')
               ),
    body    := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 30000
  );
  $$
);

-- ---------- 3) cron B: پایشی هر ۱۰ دقیقه → process-news ----------
-- قدیمی‌ترین خبرِ آماده‌ پردازش (new/processing) را برمی‌دارد و پردازش می‌کند.
-- چون process-news بدون body قدیمی‌ترین new را انتخاب می‌کند، فقط یک بار
-- در هر ۱۰ دقیقه یک خبر پردازش می‌شود (محدودیت نرخ NIM را هم رعایت می‌کند).
select cron.schedule(
  'news-processor',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'process_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-pipeline-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_secret')
               ),
    body    := jsonb_build_object('trigger', 'cron'),
    timeout_milliseconds := 140000
  );
  $$
);

-- ---------- 4) پایش / حذف ----------
-- مشاهدهٔ همهٔ job ها:
--   select * from cron.job;
-- تاریخچهٔ اجرا:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- حذف:
--   select cron.unschedule('daily-news-pipeline');
--   select cron.unschedule('news-processor');

