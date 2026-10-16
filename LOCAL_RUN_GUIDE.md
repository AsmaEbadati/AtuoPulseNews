# راهنمای اجرا و نصب لوکال — AutoPulse AI

این سند برای اجرا و توسعه پروژه روی macchina loーカル (Windows) نوشته شده است.

## ۱. پیش‌نیازها

| ابزار | نسخه پیشنهادی | چرا لازم است |
|:---|:---|:---|
| **Node.js** | 18+ | اجرا Next.js و npm |
| **npm** | bundled with Node | مدیریت پکیج‌ها |
| **Git** | هر نسخه | کلون_repo و کنترل ورژن |
| **Supabase CLI** (اختیاری) | آخرین نسخه | اجرای Edge Functions لوکال و Supabase dev |
| **Python** | **نصب نشده است** | ❌ برای `ui-ux-pro-max` CLI لازم است (حالاً طراحی دستی اعمال شده) |

---

## ۲. کلون/repo و نصب وابستگی‌ها

```powershell
# کلون ریپازیتوری (اگر هنوز نکرده‌ای)
git clone https://github.com/AsmaEbadati/AtuoPulseNews.git autopulse-ai
cd autopulse-ai

# نصب پکیج‌های npm
npm install
```

> دقت کنید: هرگز `npm install` را با `--legacy-peer-deps` اجرا نکنید مگر خطای peer dependency دریافت کنید.

---

## ۳. تنظیم متغیرهای محیطی (`.env`)

فایل نمونه را کپی کنید:

```powershell
copy .env.example .env
```

سپس مقادیر زیر را در `.env` پر کنید (بسته به محیط توسعه/تولیدی):

```env
# Supabase ( offent / client )
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# سایت
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # در dev، یا آدرس Netlify در prod

# راز امنیتی برای فراخوانی ایدج فنکشن‌ها
PIPELINE_SECRET_KEY=choose_a_strong_secret

# تلگرام (اختیاری — برای تست انتشار)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=your_channel_id

# اینستاگرام (اختیاری — برای لایو پست از طریق Make.com Webhook)
MAKE_INSTAGRAM_WEBHOOK_URL=https://hook.us2.make.com/your_webhook_url
# یا
INSTAGRAM_WEBHOOK_URL=https://hook.us2.make.com/your_webhook_url
```

> **نکته مهم:** اینستاگرام از طریق **Make.com Webhook** منتشر می‌شود. نیازی به `INSTAGRAM_ACCESS_TOKEN` یا `INSTAGRAM_ACCOUNT_ID` نیست. اگر وب‌هوک Make تنظیم نشده باشد، س이트 اجرا می‌شود ولی پست‌های اینستاگرام در `NewsLinkPills` به حالت disabled (کمرنگ) نمایش داده می‌شوند.

---

## ۴. راه‌اندازی دیتابیس (Supabase)

اگرSupabase Remote استفاده می‌کنید، فقط از داشبورد Supabase دستورالعمل‌های `schema.sql` و `supabase/schedule.sql` را اجرا کنید تا جداول و pg_cronها ساخته شوند.

اگر می‌خواهید Supabase لوکال اجرا کنید:

```powershell
supabase start
supabase db push
```

سپس فایل `supabase/schedule.sql` را در **SQL Editor** داشبورد Supabase اجرا کنید تا cronها (۱۰:۰۰ تهران و Her ۱۰ دقیقه) فعال شوند.

---

## ۵. اجرا در حالت توسعه (Dev)

```powershell
npm run dev
```

سایت روی `http://localhost:3000` در دسترس می‌شود.

| صفحه | مسیر لوکال |
|:---|:---|
| صفحه اصلی | `http://localhost:3000` |
| داشبورد | `http://localhost:3000/dashboard` |
| صفحهٔ خبر (نمونه) | `http://localhost:3000/news/[slug]` |

---

## ۶. بررسی TypeScript و Build

```powershell
# بررسی نوع‌ها بدون خارج‌سازی فایل
npx tsc --noEmit

# ساخت تولیدی
npm run build

# پیش نمایش build (اختیاری)
npm run start
```

اگر `tsc --noEmit` بدون خطا گذشت و `npm run build` با پیام `Compiled successfully` تمام شد، کد آماده pushed/deploy است.

---

## ۷. اجرای پایپ‌لاین (دستانی)

```powershell
# فراخوانی دستی Edge Function رن پ Linie (برابر با دکمه «اتوماسیون» در سایت)
npm run pipeline
```

یا از طریق Supabase Edge Functions:

```powershell
supabase functions serve run-pipeline --env-file .env
```

---

## ۸. تست لینک‌های انتشار (منبع / AI / تلگرام / اینستاگرام)

1. سایت لوکال را باز کنید: `http://localhost:3000`
2. هر کارت خبر دارای **۴ لینک pill** است:
   - **منبع** → لینک خبر اصلی در سایت باما
   - **نسخهٔ AI** → صفحهٔ بازنویسی‌شده روی خود سایت (`/news/[slug]`)
   - **تلگرام** → لینک پست تلگرام (اگر منتشر شده باشد، وگرنه disabled)
   - **اینستاگرام** → لینک پست اینستاگرام (اگر منتشر شده باشد، وگرنه disabled)
3. داشبورد (`/dashboard`) جدول وضعیت اجراها و جدول وضعیت انتشار را نشان می‌دهد. ستون **لینک** در جدول انتشار قابل کلیک است.

---

## ۹. آدرس‌های عمومی برای بررسی پست‌های منتشر شده

| پلتفرم | آدرس / نام کاربری | روش دسترسی |
|:---|:---|:---|
| **سایت AutoPulse AI** | [https://autopulsenews.netlify.app](https://autopulsenews.netlify.app) | صفحه اصلی و تمام اخبار |
| **داشبورد** | [https://autopulsenews.netlify.app/dashboard](https://autopulsenews.netlify.app/dashboard) | لاگ اجراها و وضعیت انتشار |
| **تلگرام** | [@autopulsenews_bot](https://t.me/autopulsenews_bot) | ستون لینک جدول انتشار یا دکمه تلگرام در هر کارت خبر |
| **اینستاگرام** | [autopulsenews](https://instagram.com/autopulsenews) | ستون لینک جدول انتشار یا دکمه اینستاگرام در هر کارت خبر |


> **نکته:** نام کاربری ربات تلگرام و آدرس اکانت اینستاگرام اکنون مشخص است:
> - **ربات تلگرام:** [@autopulsenews_bot](https://t.me/autopulsenews_bot)
> - **آکانت اینستاگرام:** [autopulsenews](https://instagram.com/autopulsenews)
> به راحتی می‌توانید آن‌ها را از **داشبورد سایت** (جدول وضعیت انتشار، ستون لینک) یا از جدول `public_status` در Supabase ببینید.

---

## ۱۰. نکات llegado (Windows PowerShell)

- فایل `.env` را هرگز به Git اضافه نکنید (در `.gitignore` است).
- اگر خطای execution policy در PowerShell دریافت کردید:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- برای stop کردن dev server: `Ctrl + C`
- artifactهای build (`build.log`, `build.err`) را قبل از commit پاک کنید.

---

**آدرس presumed سایت:** `https://autopulsenews.netlify.app` (دیپلوی خودکار بعد از هر push به branch `master` در GitHub)
