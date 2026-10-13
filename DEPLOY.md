# 🚀 راهنمای دیپلوی AutoPulse AI

این پروژه از **دو بخش** تشکیل شده:

1. **وب‌سایت (Next.js)** → روی **Netlify** دیپلوی می‌شود. فقط اخبار منتشرشده را نمایش می‌دهد.
2. **پایپ‌لاین خودکار (Edge Functions)** → روی **Supabase** اجرا می‌شود (pg_cron هر روز صدا می‌زند).

> نکتهٔ معماری: تصمیم گرفتیم **هماهنگ‌کننده و پردازش خبر روی Supabase بماند** و Netlify فقط برای نمایش سایت باشد. این باعث می‌شود سقف ۱۵۰ ثانیه‌ای Edge Function برای هر خبر کافی باشد (با معماری دو تابع `run-pipeline` + `process-news`).

---

## بخش ۱ — دیپلوی وب‌سایت روی Netlify

### ۱) آماده‌سازی
مطمئن شو پروژه با Git پوش شده و مخزن روی GitHub/GitLab/Bitbucket است.

### ۲) ساخت Site روی Netlify
1. برو به https://app.netlify.com → **Add new site** → **Import an existing project**.
2. مخزن پروژه را وصل کن.
3. Netlify به‌طور خودکار `netlify.toml` را می‌خواند:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Plugin:** `@netlify/plugin-nextjs`

### ۳) تنظیم Environment Variables روی Netlify
برو به **Site settings → Build & deploy → Environment** و این متغیرها را اضافه کن:

| کلید | مقدار | توضیح |
|:--|:--|:--|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jcycygforwzryomjeyki.supabase.co` | عمومی، امن |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key پروژه | عمومی، امن |
| `NEXT_PUBLIC_SITE_URL` | دامنهٔ نهایی، مثل `https://<your-site>.netlify.app` | برای ساخت لینک خبر |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` را روی Netlify ست نکن.** صفحات سایت فقط از `public_news`/`public_runs` (viewهای عمومی) با **anon key** می‌خوانند. service_role فقط داخل Edge Functions استفاده می‌شود.
>
> ⚠️ کلیدها را با پیشوند `NEXT_PUBLIC_` امن می‌دانیم چون فقط خواندن از viewهای عمومی است.

### ۴) Deploy
**Deploy site** را بزن. بعد از موفقیت، دامنهٔ Netlify را در `NEXT_PUBLIC_SITE_URL` هم به‌روز کن (و یک بار دیگر build بزن).

---

## بخش ۲ — دیپلوی پایپ‌لاین روی Supabase (Edge Functions)

پیش‌نیاز: [Supabase CLI](https://supabase.com/docs/guides/cli) نصب باشد.

```powershell
cd C:\Users\Asma\Desktop\AYAN\autopulse-ai
supabase login
supabase link --project-ref jcycygforwzryomjeyki
```

### ست‌کردن Secrets تابع‌ها
```powershell
supabase secrets set \
  NVIDIA_API_KEY="<کلید NVIDIA شما>" \
  NVIDIA_API_MODEL="openai/gpt-oss-20b" \
  TELEGRAM_BOT_TOKEN="<توکن بات>" \
  TELEGRAM_CHANNEL_ID="104067526" \
  PIPELINE_SECRET_KEY="cf12eae2d576f40ef09812d66f8df1289134fbf0650a185e274c7befd2353942" \
  NEXT_PUBLIC_SITE_URL="https://<your-site>.netlify.app"
```
> `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` به‌صورت خودکار توسط پلتفرم تزریق می‌شوند.

### دیپلوی تابع‌ها
```powershell
supabase functions deploy run-pipeline
supabase functions deploy process-news
```

### زمان‌بندی روزانه (pg_cron)
1. Supabase Dashboard → **SQL Editor** → محتوای `supabase/schedule.sql` را اجرا کن.
2. این هر روز **۱۰:۰۰ تهران** یک POST به `run-pipeline` می‌زند.

> جزئیات کامل در `supabase/README.md` است.

---

## ✅ چک‌لیست نهایی

- [ ] build محلی موفق (`npm run build`)
- [ ] repo روی Git پوش شده و `.env` وارد نشده (ignore است)
- [ ] Netlify: Site ساخته و متغیرهای `NEXT_PUBLIC_*` ست شده
- [ ] Netlify: Deploy موفق و دامنه در `NEXT_PUBLIC_SITE_URL` به‌روز شد
- [ ] Supabase: `supabase link` انجام شده
- [ ] Supabase: secrets ست شده
- [ ] Supabase: `run-pipeline` و `process-news` دیپلوی شده
- [ ] Supabase: `schedule.sql` اجرا شده (pg_cron فعال)
- [ ] تست دستی: `curl -X POST .../functions/v1/run-pipeline -H "x-pipeline-secret: ..."`
