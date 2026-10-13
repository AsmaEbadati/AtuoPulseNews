# 📸 راهنمای کامل انتشار اینستاگرام با Make

پایپ‌لاین ما خبرِ آماده را با یک **POST به وب‌هوک Make** می‌فرستد. Make آن را
در اینستاگرام منتشر می‌کند و لینک (permalink) را برمی‌گرداند.

## بدنهٔ دقیقی که کد ما می‌فرستد (JSON)

```json
{
  "news_id": "uuid-خبر",
  "title": "عنوان خبر",
  "image_url": "https://.../image.jpg",
  "caption": "متن کپشن اینستاگرام + هشتگ‌ها",
  "secret": "autopulse_ig_secret_9f3a7c"
}
```

> ⚠️ **secret داخل بدنه** است (فیلد `secret`). برای انعطاف، کد آن را در هدر
> `x-make-secret` هم می‌فرستد؛ ولی **فیلتر Make را روی فیلد بدنهٔ `secret`**
> بگذار تا مطمئن کار کند.

---

## گام ۱ — تبدیل اینستاگرام به Business (رایگان)

توصیه: یک **اکانت جدا** فقط برای این پروژه بساز (اکانت شخصی را درگیر نکن).

1. در اپ اینستاگرام: **Settings → Account type and tools → Switch to professional account**
2. نوع **Business** (یا Creator) را انتخاب کن
3. یک دسته‌بندی انتخاب کن (مثلاً "News & media")
4. در تنظیمات Account، دسترسی **شبکهٔ اجتماعی (Social Networks)** را روشن کن

## گام ۲ — ساخت صفحهٔ فیسبوک (رایگان)

1. با اکانت فیسبوک یک **Page** بساز (مثلاً «AutoPulse News»)
2. باید **ادمین** همان صفحه باشی

## گام ۳ — وصل کردن اینستاگرام به صفحه

1. در اینستاگرام: **Edit profile → بخش Page → Connect or create** (یا Accounts Center)
2. همان صفحهٔ فیسبوک را انتخاب کن

---

## گام ۴ — ساخت Scenario در Make

### ۴-الف) Custom Webhook
1. Make → **Create a new scenario**
2. ماژول: **Webhooks → Custom webhook → Add**
3. یک اسم بده (مثلاً `autopulse-ig`) → **Save**
4. یک **URL** می‌بینی (مثل `https://hook.eu2.make.com/xxxx`) — نگه‌دار

### ۴-ب) Run once + درخواست نمونه (خیلی مهم ⭐)
بدون این مرحله Make فیلدها را نمی‌شناسد و در ماژول اینستاگرام چیزی برای
انتخاب نمی‌بینی:

1. پایین‌چپ روی **Run once** بزن
2. یک درخواست نمونه بفرست (توی PowerShell پروژه):
   ```powershell
   node send_make_sample.cjs "https://hook.eu2.make.com/xxxx"
   ```
   (URL را از گام ۴-الف بگذار؛ `send_make_sample.cjs` بدنهٔ واقعی را می‌فرستد)
3. Make پیام «Successfully determined» می‌ده و فیلدها را می‌بینی

### ۴-ج) Router / Filter (چک secret)
1. ماژول: **Flow Control → Router** (یا **Filter**)
2. شرط را روی **فیلد بدنه** بگذار:
   - `secret` ** equal to ** `autopulse_ig_secret_9f3a7c`
3. اگر مطابقت نکرد، مسیر بی‌اثر شود (درخواست نامعتبر رد می‌شود)

### ۴-د) Instagram for Business → Create a Photo Post
1. اولین بار ازت می‌خواهد اینستاگرام را وصل کنی (Connect)
2. ⚠️ در صفحهٔ مجوزهای فیسبوک حتماً:
   - همان **Page** را تیک بزن
   - همان **اکانت اینستاگرام** را تیک بزن
   - مجوزهای `instagram_basic`, `instagram_content_publish`, `pages_manage_posts` بده
   - (این رایج‌ترین دلیل «اکانت در لیست نیست» است)
3. فیلدها:
   - **Photo URL**: `{{1.image_url}}`
   - **Caption**: `{{1.caption}}`
   - **Instagram Account ID**: اکانت بیزینست

### ۴-ه) Instagram → Get Media (برای permalink)
1. ماژول **Instagram for Business → Get Media** با ID پست ساخته‌شده
2. مقدار `permalink` را بردار

### ۴-و) Webhooks → Webhook Response
```json
{ "status": "success", "post_url": "{{permalink}}" }
```
این همان چیزی است که کد ما در `publications.post_url` ذخیره می‌کند.

### ۴-ز) فعال‌سازی
1. **Save** scenario → **ON** کن
2. (اختیاری) Scheduling را روی "Immediately" بگذار

---

## گام ۵ — اتصال به پایپ‌لاین

بعد از اینکه URL وب‌هوک را گرفتی، آن را به Cline بده تا:

1. توی `.env` و Supabase secrets بگذارد:
   - `MAKE_WEBHOOK_URL=https://hook.eu2.make.com/xxxx`
   - `MAKE_SECRET=autopulse_ig_secret_9f3a7c`
2. `process-news` را دوباره deploy کند:
   ```powershell
   npx supabase functions deploy process-news --no-verify-jwt
   ```

از آن پس هر خبر «ready» خودکار به اینستاگرام هم می‌رود (idempotent).

---

## 🔎 رفع اشکال

| مشکل | راه‌حل |
|:---|:---|
| اکانت اینستاگرام در Make نیست | در مجوزهای فیسبوک، Page و اکانت IG را تیک بزن |
| ماژول IG فیلدی برای انتخاب ندارد | مرحلهٔ **Run once + ارسال نمونه** را نکردی |
| همهٔ درخواست‌ها رد می‌شوند | شرط Filter را روی فیلد بدنهٔ `secret` بگذار (نه هدر) |
| عکس آپلود نمی‌شود | مطمئن شو `image_url` عمومی و قابل دسترس است (HTTPS) |
