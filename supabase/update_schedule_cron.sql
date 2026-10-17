-- ============================================================
-- AutoPulse AI — زمان‌بندی ۴ بار در روز و اتصال خودکار پنل مدیریت به pg_cron
-- این فایل را در: Supabase Dashboard → SQL Editor کپی و اجرا (Run) کنید.
-- ============================================================

-- ۱. ایجاد تابع هوشمند جهت تغییر خودکار زمان‌بندی از داخل پنل مدیریت
CREATE OR REPLACE FUNCTION public.set_pipeline_cron(p_cron_expr text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- حذف زمان‌بندی قبلی اگر وجود داشت
  BEGIN
    PERFORM cron.unschedule('daily-news-pipeline');
  EXCEPTION WHEN OTHERS THEN
    -- نادیده گرفتن اگر از قبل وجود نداشت
  END;

  -- ایجاد زمان‌بندی جدید با عبارت کران ارسالی
  PERFORM cron.schedule(
    'daily-news-pipeline',
    p_cron_expr,
    $cmd$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_url'),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-pipeline-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_secret')
                 ),
      body    := jsonb_build_object('trigger', 'cron'),
      timeout_milliseconds := 30000
    );
    $cmd$
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_pipeline_cron(text) TO service_role, postgres, anon, authenticated;


-- ۲. تنظیم پیش‌فرض ۴ بار در شبانه‌روز (ساعات ۰۹:۳۰، ۱۳:۳۰، ۱۷:۳۰ و ۲۱:۳۰ به وقت تهران)
-- معادل ساعات 06:00، 10:00، 14:00 و 18:00 به وقت UTC
SELECT public.set_pipeline_cron('0 6,10,14,18 * * *');


-- ۳. اطمینان از وجود کران پایشی هر ۱۰ دقیقه (جهت پایش اخبار معلق و بدون وقفه)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('news-processor');
  EXCEPTION WHEN OTHERS THEN
  END;

  PERFORM cron.schedule(
    'news-processor',
    '*/10 * * * *',
    $cmd$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'process_url'),
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'x-pipeline-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pipeline_secret')
                 ),
      body    := jsonb_build_object('trigger', 'cron'),
      timeout_milliseconds := 140000
    );
    $cmd$
  );
END;
$$;


-- ۴. بررسی وضعیت جاب‌های ثبت‌شده
SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
FROM cron.job;
