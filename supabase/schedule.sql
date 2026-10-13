-- ============================================================
-- زمان‌بندی روزانهٔ پایپ‌لاین با pg_cron → Edge Function
-- اجرا در: Supabase Dashboard > SQL Editor
-- ============================================================
-- پیش‌نیاز: Edge Function های run-pipeline و process-news دیپلوی شده باشند.
--
-- نحوهٔ کار:
--   هر روز ساعت ۰۶:۳۰ UTC (= ۱۰:۰۰ تهران، UTC+03:30) یک POST به
--   run-pipeline زده می‌شود. آن تابع اخبار جدید را ذخیره کرده و برای هر
--   خبر یک درخواست (بدون انتظار) به process-news می‌فرستد.
--
-- نکتهٔ امنیتی: PIPELINE_SECRET_KEY باید همان مقداری باشد که به‌عنوان
-- env تابع تنظیم شده و در هدر x-pipeline-secret فرستاده می‌شود.
-- ============================================================

-- ---------- 1) ذخیرهٔ secrets در Vault (یک‌بار) ----------
-- PROJECT_REF را با ref پروژه‌ات جایگزین کن.
select vault.create_secret(
  'https://jcycygforwzryomjeyki.supabase.co/functions/v1/run-pipeline',
  'pipeline_url'
);

-- این مقدار را عوض کن: همان PIPELINE_SECRET_KEY در .env خودت.
-- (فعلاً همان کلید تولیدشدهٔ .env)
select vault.create_secret(
  'cf12eae2d576f40ef09812d66f8df1289134fbf0650a185e274c7befd2353942',
  'pipeline_secret'
);

-- ---------- 2) schedule روزانه ----------
-- 30 6 * * *  = هر روز ساعت 06:30 UTC = 10:00 تهران
select cron.schedule(
  'daily-news-pipeline',
  '30 6 * * *',
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

-- ---------- 3) پایش / حذف ----------
-- مشاهدهٔ همهٔ job ها:
--   select * from cron.job;
-- تاریخچهٔ اجرا:
--   select * from cron.job_run_details order by start_time desc limit 10;
-- حذف job:
--   select cron.unschedule('daily-news-pipeline');
