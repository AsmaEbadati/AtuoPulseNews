# 📸 راهنمای کامل انتشار اینستاگرام با Graph API (بدون Make)

پایپ‌لاین ما خبرِ آماده را مستقیم با **Instagram Graph API** منتشر می‌کند.
این راه «تمیز» است: نه Make، نه واسطهٔ دیگر — فقط کد ما ↔ فیسبوک.

## جریان فنی (خودکار در کد)
1. `POST /{ig-user-id}/media?image_url=...&caption=...` → `creation_id`
2. `POST /{ig-user-id}/media_publish?creation_id=...` → `media_id`
3. `GET /{media_id}?fields=permalink` → لینک پست (در DB ذخیره می‌شود)

---

## گام ۱ — تبدیل اینستاگرام به Business (رایگان)
توصیه: یک **اکانت جدا** برای این پروژه بساز.
1. اپ اینستاگرام → **Settings → Account type and tools → Switch to professional account**
2. نوع **Business** (یا Creator) را انتخاب کن
3. دسته‌بندی انتخاب کن

## گام ۲ — صفحهٔ فیسبوک (رایگان)
1. با اکانت فیسبوک یک **Page** بساز (مثلاً «AutoPulse News»)
2. ادمین آن باش

## گام ۳ — وصل کردن اینستاگرام به صفحه
1. اینستاگرام → **Edit profile → بخش Page → Connect** (یا Accounts Center)
2. همان صفحهٔ فیسبوک را انتخاب کن

## گام ۴ — ساخت Facebook App
1. برو **https://developers.facebook.com/apps** → **Create App**
2. نوع: **Business** (یا "None" برای تست ساده)
3. بعد از ساخت، در داشبورد App → **Add Product** → **Instagram** → **API setup with Instagram login**
   - یا از منوی سمت چپ: **Instagram → API setup**

## گام ۵ — گرفتن Access Token + Account ID (بدون کدنویسی)
1. برو **https://developers.facebook.com/tools/explorer**
2. بالای صفحه: اپ خودت را انتخاب کن → **Generate Access Token**
3. در پنجرهٔ مجوزها، این‌ها را اضافه کن:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
4. توکن کوتاه‌مدت می‌گیری. برای **بلندمدت** کردن:
   - در همان ابزار، **Debug** را بزن → پایین گزینهٔ **Extend Access Token** → یک توکن ۶۰ روزه می‌گیری
   - (برای دائمی شدن باید refresh token بگیری، ولی ۶۰ روزه برای شروع کافیست)
5. برای گرفتن **Instagram Account ID**، این کوئری را در Explorer بزن:
   ```
   me/accounts?fields=instagram_business_account{id,username}
   ```
   عدد کنار `id` همان **Instagram Account ID** است (مثلاً `17841400000000000`)

> 💡 نکتهٔ مهم: در کد ما از متغیرهای زیر استفاده می‌شود:
> - `INSTAGRAM_ACCESS_TOKEN` = همان توکن بلندمدت
> - `INSTAGRAM_ACCOUNT_ID` = همان عدد ID

---

## گام ۶ — تست مستقیم (بعد از گرفتن توکن و ID)
```powershell
cd C:\Users\Asma\Desktop\AYAN\autopulse-ai
$env:INSTAGRAM_ACCESS_TOKEN="EAAB..."; $env:INSTAGRAM_ACCOUNT_ID="178414..."
node test_instagram_graph.cjs
```
این یک پست واقعی با یک تصویر نمونه می‌فرستد و permalink را چاپ می‌کند.

---

## گام ۷ — فعال‌سازی در پایپ‌لاین
وقتی تست موفق شد، توکن و ID را به Cline بده تا:
1. در `.env` و Supabase secrets بگذارد:
   - `INSTAGRAM_ACCESS_TOKEN=EAAB...`
   - `INSTAGRAM_ACCOUNT_ID=178414...`
2. `process-news` را دوباره deploy کند:
   ```powershell
   npx supabase functions deploy process-news --no-verify-jwt
   ```

---

## 🔎 رفع اشکال

| خطا | علت / راه‌حل |
|:---|:---|
| `Image URL must be public HTTPS` | تصویر باید روی URL عمومی HTTPS باشد |
| `media_publish failed` | معمولاً مجوز `instagram_content_publish` نداری |
| `does not exist, cannot be loaded...` | Account ID اشتباه است یا اکانت به Page وصل نیست |
| توکن منقضی شد | توکن کوتاه‌مدت ۱-۲ ساعته‌ست؛ باید بلندمدت (۶۰ روزه) بگیری |
