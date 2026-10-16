// اسکریپت اجرای مستقیم تست انتشار در سایت، تلگرام و اینستاگرام
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const DEFAULT_MAKE_WEBHOOK = "https://hook.us2.make.com/p24hhdz7k98h6gx5aont3rq88lxc3x8p";
const MAKE_WEBHOOK =
  process.env.MAKE_INSTAGRAM_WEBHOOK_URL ||
  process.env.INSTAGRAM_WEBHOOK_URL ||
  DEFAULT_MAKE_WEBHOOK;
const SITE_URL = "https://autopulsenews.netlify.app";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ متغیرهای Supabase در محیط یافت نشد.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("==================================================");
  console.log("🚀 شروع تست سراسری انتشار پایپ‌لاین AutoPulse");
  console.log("==================================================");

  const timestamp = Date.now();
  const title = `تست انتشار سراسری AutoPulse در سایت، تلگرام و اینستاگرام (${new Date().toLocaleTimeString("fa-IR")})`;
  const slug = `autopulse-test-${timestamp}`;
  const testImageUrl = "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80";

  // متن تستی باید 900-1100 کاراکتر باشد (constraint: rewritten_len_ok در Supabase)
  const rewrittenText =
    "سامانه هوشمند خبررسانی AutoPulse هم‌اکنون با موفقیت کامل زنجیره انتشار یکپارچه خود را در سه پلتفرم اصلی یعنی وب‌سایت رسمی، کانال تلگرام و صفحه اینستاگرام آزمایش کرد. " +
    "این خبر تستی به‌منظور راستی‌آزمایی صحت عملکرد وب‌هوک‌های سیستم، تنظیم خودکار ابعاد تصویر به استاندارد ۱۰۸۰×۱۰۸۰ پیکسل، هماهنگی کپشن‌های بهینه‌سازی‌شده برای شبکه‌های اجتماعی و بررسی صحت ارسال خودکار به تمام مقاصد ایجاد شده است. " +
    "تمام مراحل شامل اسکرپ خبر از منبع، تشخیص تکراری نبودن، بازنویسی هوشمند با هوش مصنوعی، تولید کپشن اختصاصی برای هر پلتفرم و در نهایت انتشار هم‌زمان در سه کانال ارتباطی به‌صورت کاملاً خودکار و بدون نیاز به دخالت انسانی انجام پذیرفت. " +
    "سامانه AutoPulse با بهره‌گیری از معماری مدرن و فناوری‌های پیشرفته پردازش زبان طبیعی، امکان پوشش اخبار لحظه‌ای صنعت خودرو را فراهم آورده و از طریق زمان‌بندی هوشمند، بهترین ساعات انتشار محتوا در هر پلتفرم را تعیین می‌کند. " +
    "موفقیت این آزمایش نشان‌دهنده آمادگی کامل زیرساخت برای فاز بهره‌برداری تجاری است.";

  const tgCaption =
    "⚡️ تست انتشار خودکار AutoPulse در سایت، تلگرام و اینستاگرام\n\nسامانه هوشمند خبررسانی خودرویی AutoPulse با موفقیت زنجیره انتشار ۳ پلتفرم را آزمایش کرد.\n\n🌐 جزئیات بیشتر در سایت: " + `${SITE_URL}/news/${slug}`;

  const igCaption =
    "🚗 تست انتشار یکپارچه AutoPulse\n\nاین پست تستی جهت بررسی پایپ‌لاین انتشار خودکار در سایت، تلگرام و اینستاگرام ارسال شده است.\n\nبه نظر شما سرعت و کیفیت انتشار چطوره؟ نظرتون رو کامنت کنید 👇\n\n#خودرو #ماشین #AutoPulse #تست_انتشار";

  // ۱) درج در جدول news_items
  console.log("\n1️⃣ ثبت خبر تستی در دیتابیس Supabase...");
  const { data: newsItem, error: insErr } = await supabase
    .from("news_items")
    .insert({
      source_url: `${SITE_URL}/test-${timestamp}`,
      title,
      slug,
      source_image_url: testImageUrl,
      image_url: testImageUrl,
      original_text: rewrittenText,
      rewritten_text: rewrittenText,
      tg_caption: tgCaption,
      ig_caption: igCaption,
      process_status: "ready",
    })
    .select("id, slug, title")
    .single();

  if (insErr || !newsItem) {
    console.error("❌ خطا در ثبت خبر:", insErr?.message);
    return;
  }
  const newsId = newsItem.id;
  console.log(`✅ خبر تستی با شناسه ${newsId} ایجاد شد.`);

  // ۲) انتشار در سایت
  console.log("\n2️⃣ انتشار در وب‌سایت AutoPulse...");
  const sitePostUrl = `${SITE_URL}/news/${slug}`;
  try {
    const { error: claimErr } = await supabase.rpc("claim_publication", {
      p_news_id: newsId,
      p_destination: "site",
    });
    if (!claimErr) {
      await supabase.rpc("complete_publication", {
        p_news_id: newsId,
        p_destination: "site",
        p_status: "success",
        p_post_url: sitePostUrl,
        p_error: null,
      });
      console.log(`✅ وب‌سایت: منتشر شد! آدرس خبر: ${sitePostUrl}`);
    } else {
      console.warn("⚠️ claim سایت:", claimErr.message);
    }
  } catch (e) {
    console.error("❌ خطا در انتشار سایت:", e.message);
  }

  // ۳) انتشار در تلگرام
  console.log("\n3️⃣ انتشار در کانال تلگرام...");
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHANNEL_ID,
          photo: testImageUrl,
          caption: tgCaption,
        }),
      });
      const tgJson = await tgRes.json();
      if (tgJson.ok) {
        const msgId = tgJson.result?.message_id;
        console.log(`✅ تلگرام: پیام با موفقیت در کانال منتشر شد! (Message ID: ${msgId})`);
        await supabase.rpc("claim_publication", { p_news_id: newsId, p_destination: "telegram" });
        await supabase.rpc("complete_publication", {
          p_news_id: newsId,
          p_destination: "telegram",
          p_status: "success",
          p_post_url: `https://t.me/${TELEGRAM_CHANNEL_ID.replace('@', '')}/${msgId}`,
          p_error: null,
        });
      } else {
        console.warn(`❌ تلگرام خطا داد: ${tgJson.description}`);
      }
    } catch (e) {
      console.error("❌ خطا در ارسال به تلگرام:", e.message);
    }
  } else {
    console.log("ℹ️ تلگرام: متغیرهای TELEGRAM_BOT_TOKEN یا TELEGRAM_CHANNEL_ID در این محیط تنظیم نشده‌اند.");
  }

  // ۴) انتشار در اینستاگرام (آماده‌سازی تصویر ۱۰۸۰×۱۰۸۰ + ارسال به Make)
  console.log("\n4️⃣ پردازش تصویر اینستاگرام و ارسال به Make...");
  try {
    // دریافت تنظیمات برای خواندن webhook_url اینستاگرام
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "publish_schedule")
      .maybeSingle();

    const igWebhook = settingsRows?.value?.instagram?.webhook_url || MAKE_WEBHOOK;

    // تبدیل عکس به مربع ۱۰۸۰×۱۰۸۰ استاندارد اینستاگرام
    console.log("🖼️ در حال تبدیل تصویر به سایز مربع ۱۰۸۰×۱۰۸۰ با حاشیه بلور شکیل...");
    const imgRes = await fetch(testImageUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    const background = await sharp(imgBuffer)
      .resize(1080, 1080, { fit: "cover" })
      .blur(25)
      .modulate({ brightness: 0.65, saturation: 1.1 })
      .toBuffer();

    const foreground = await sharp(imgBuffer)
      .resize(1080, 1080, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const compositeImage = await sharp(background)
      .composite([{ input: foreground, gravity: "center" }])
      .jpeg({ quality: 90 })
      .toBuffer();

    const storagePath = `instagram/${newsId}-test.jpg`;
    await supabase.storage.from("news").upload(storagePath, compositeImage, {
      contentType: "image/jpeg",
      upsert: true,
    });
    const { data: pubData } = supabase.storage.from("news").getPublicUrl(storagePath);
    const finalIgImageUrl = pubData.publicUrl;
    console.log(`✅ تصویر ۱۰۸۰×۱۰۸۰ در استوریج ذخیره شد: ${finalIgImageUrl}`);

    if (igWebhook && igWebhook.startsWith("https://")) {
      console.log(`🚀 در حال ارسال رویداد به وب‌هوک Make: ${igWebhook}...`);
      const makeRes = await fetch(igWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          news_id: newsId,
          title,
          caption: igCaption,
          image_url: finalIgImageUrl,
          aspect_ratio: "1:1",
          width: 1080,
          height: 1080,
          timestamp: new Date().toISOString(),
        }),
      });
      const makeText = await makeRes.text();
      console.log(`✅ وب‌هوک Make پاسخ داد (HTTP ${makeRes.status}): ${makeText}`);

      await supabase.rpc("claim_publication", { p_news_id: newsId, p_destination: "instagram" });
      await supabase.rpc("complete_publication", {
        p_news_id: newsId,
        p_destination: "instagram",
        p_status: "success",
        p_post_url: "https://instagram.com/autopulsenews",
        p_error: null,
      });
    } else {
      console.log("ℹ️ وب‌هوک Make هنوز در صفحه زمان‌بندی وارد نشده است. تصویر آماده است و به محض وارد کردن وب‌هوک ارسال می‌شود.");
    }
  } catch (e) {
    console.error("❌ خطا در فرآیند اینستاگرام:", e.message);
  }

  console.log("\n==================================================");
  console.log("🏁 تست سراسری به پایان رسید!");
  console.log("==================================================");
}

run();
