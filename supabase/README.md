# دیپلوی پایپ‌لاین خودکار — Supabase Edge Functions + pg_cron

این پروژه از **دو Edge Function** استفاده می‌کند (معماری مقاوم در برابر سقف ۱۵۰ ثانیه‌ای):

| تابع | نقش | مدت تقریبی |
|:--|:--|:--|
| `run-pipeline` | خواندن bama.ir، ذخیرهٔ خبر جدید، ارسال «بدون انتظار» به process-news، ثبت run_logs | چند ثانیه |
| `process-news` | پردازش کامل **یک** خبر: متن کامل، بازنویسی AI، انتشار سایت + تلگرام | تا ~۱۵۰ ثانیه |

منطق هر تابع دقیقاً همان کدِ تست‌شدهٔ `lib/` است (scraper، article، ai، telegram، slug).

---

## پیش‌نیازها

- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` یا `scoop install supabase`)
- لاگین: `supabase login`
- لینک پروژه: `supabase link --project-ref jcycygforwzryomjeyki`

> ⚠️ محیط تست (این لپ‌تاپ) Deno/Supabase CLI ندارد، پس تست local ممکن نبود.
> تست‌شدگی منطق در `lib/` (با Node) انجام شده و همین کد به Edge Functions پورت شده است.

---

## مرحلهٔ ۱ — تنظیم Secrets تابع‌ها

در داشبورد Supabase → **Edge Functions → Manage secrets** این‌ها را اضافه کن:

| Secret | مقدار | از کجا |
|:--|:--|:--|
| `NVIDIA_API_KEY` | کلید NVIDIA NIM | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | کلید service_role | Supabase → Settings → API |
| `TELEGRAM_BOT_TOKEN` | توکن بات | `.env` |
| `TELEGRAM_CHANNEL_ID` | آیدی عددی کانال/چت | `.env` (فعلاً ۱۰۴۰۶۷۵۲۶) |
| `PIPELINE_SECRET_KEY` | secret سفارشی | `.env` (فایل `cf12eae2…`) |

> `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` معمولاً خودکار تزریق می‌شوند؛
> ولی برای اطمینان، service_role را دستی هم اضافه کن.

---

## مرحلهٔ ۲ — دیپلوی تابع‌ها

از ریشهٔ پروژه (`autopulse-ai/`):

```bash
supabase functions deploy run-pipeline --no-verify-jwt
supabase functions deploy process-news  --no-verify-jwt
```

> `--no-verify-jwt` چون خودمان با `x-pipeline-secret` اعتبارسنجی می‌کنیم
> (و run-pipeline باید بتونه بدون JWT کاربر صداش بزند).

---

## مرحلهٔ ۳ — تست دستی

ابتدا یک خبر pending بساز (اگر همه ready/error هستند، یکی را reset کن).
سپس:

```bash
# تست run-pipeline (چند ثانیه)
curl -i -X POST "https://jcycygforwzryomjeyki.supabase.co/functions/v1/run-pipeline" \
  -H "x-pipeline-secret: cf12eae2d576f40ef09812d66f8df1289134fbf0650a185e274c7befd2353942"

# تست process-news روی یک خبر مشخص (جای news_id را بگذار)
curl -i -X POST "https://jcycygforwzryomjeyki.supabase.co/functions/v1/process-news" \
  -H "x-pipeline-secret: cf12eae2d576f40ef09812d66f8df1289134fbf0650a185e274c7befd2353942" \
  -H "Content-Type: application/json" \
  -d '{"news_id":"<uuid>"}'
```

پاسخ موفق: `{"ok":true,...,"site":"success","telegram":"success"}`

---

## مرحلهٔ ۴ — زمان‌بندی روزانه (pg_cron)

محتوای `supabase/schedule.sql` را در **SQL Editor** اجرا کن. این:
1. دو secret (`pipeline_url`, `pipeline_secret`) را در Vault می‌سازد،
2. یک cron روزانه (۰۶:۳۰ UTC = ۱۰:۰۰ تهران) می‌سازد که `run-pipeline` را صدا می‌زند.

بررسی:
```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
```

---

## جریان کامل

```
pg_cron (هر روز ۱۰:۰۰ تهران)
   │  POST + x-pipeline-secret
   ▼
run-pipeline ── ذخیرهٔ خبر جدید ──► process-news (per خبر، بدون انتظار)
                                          │
                                          ├─ متن کامل bama
                                          ├─ AI → rewritten + captions
                                          ├─ claim_publication(site)
                                          └─ publishToTelegram (idempotent)

[Netlify Next.js]  ── می‌خواند از viewهای public_news / public_status / public_runs
```

---

## نکات مهم

- **idempotency:** هر خبر با `claim_publication` جلوی انتشار تکراری گرفته می‌شود.
  اگر یک خبر وسط راه قطع شود، اجرای بعدی فقط مقصدهای ناموفق را ادامه می‌دهد.
- **SITE URL:** توی `process-news` لینک سایت از env `NEXT_PUBLIC_SITE_URL` خوانده می‌شود
  (fallback: `https://autopulsenews.netlify.app`). هنگام ست‌کردن secrets، آن را
  به دامنهٔ واقعی Netlify خودت تنظیم کن.
- **Instagram:** فعلاً در این معماری حذف شده (نیاز به Make/Webhook دارد). کپشن در
  `ig_caption` ذخیره می‌شود و هر وقت خواستی اضافه می‌کنیم.
