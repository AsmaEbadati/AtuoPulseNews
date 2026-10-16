import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { publishToSite } from "@/lib/publisher/site";
import { publishToTelegram } from "@/lib/publisher/telegram";
import { publishToInstagram } from "@/lib/publisher/instagram";
import { generateSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { success: false, error: "دیتابیس Supabase متصل نیست." },
      { status: 500 }
    );
  }

  const db = getSupabaseClient();
  const timestamp = Date.now();
  const testTitle = `تست انتشار خودکار AutoPulse در سایت، تلگرام و اینستاگرام (${new Date().toLocaleTimeString("fa-IR")})`;
  const testSlug = generateSlug(testTitle);

  // یک تصویر باکیفیت و استاندارد خودرو برای تست
  const testImageUrl =
    "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80";

  // متن تستی باید دقیقاً 900-1100 کاراکتر باشد (constraint: rewritten_len_ok در Supabase)
  const testRewritten =
    "سامانه هوشمند خبررسانی AutoPulse هم‌اکنون با موفقیت کامل زنجیره انتشار یکپارچه خود را در سه پلتفرم اصلی یعنی وب‌سایت رسمی، کانال تلگرام و صفحه اینستاگرام آزمایش کرد. " +
    "این خبر تستی به‌منظور راستی‌آزمایی صحت عملکرد وب‌هوک‌های سیستم، تنظیم خودکار ابعاد تصویر به استاندارد ۱۰۸۰×۱۰۸۰ پیکسل، هماهنگی کپشن‌های بهینه‌سازی‌شده برای شبکه‌های اجتماعی و بررسی صحت ارسال خودکار به تمام مقاصد ایجاد شده است. " +
    "تمام مراحل شامل اسکرپ خبر از منبع، تشخیص تکراری نبودن، بازنویسی هوشمند با هوش مصنوعی، تولید کپشن اختصاصی برای هر پلتفرم و در نهایت انتشار هم‌زمان در سه کانال ارتباطی به‌صورت کاملاً خودکار و بدون نیاز به دخالت انسانی انجام پذیرفت. " +
    "سامانه AutoPulse با بهره‌گیری از معماری مدرن و فناوری‌های پیشرفته پردازش زبان طبیعی، امکان پوشش اخبار لحظه‌ای صنعت خودرو را فراهم آورده و از طریق زمان‌بندی هوشمند، بهترین ساعات انتشار محتوا در هر پلتفرم را تعیین می‌کند. " +
    "موفقیت این آزمایش نشان‌دهنده آمادگی کامل زیرساخت برای فاز بهره‌برداری تجاری است.";

  const testTgCaption =
    `⚡️ تست انتشار خودکار AutoPulse در سایت، تلگرام و اینستاگرام\n\nسامانه هوشمند خبررسانی خودرویی AutoPulse با موفقیت زنجیره انتشار ۳ پلتفرم را آزمایش کرد.\n\n🌐 مطالعه خبر کامل در سایت:\nhttps://autopulsenews.netlify.app/news/${testSlug}`;

  const testIgCaption =
    "🚗 تست انتشار یکپارچه AutoPulse\n\nاین پست تستی جهت بررسی پایپ‌لاین انتشار خودکار در سایت، تلگرام و اینستاگرام ارسال شده است.\n\nبه نظر شما سرعت و کیفیت انتشار چطوره؟ برامون بنویسید 👇\n\n#خودرو #ماشین #AutoPulse #تست";

  try {
    // ۱) ایجاد یا ثبت رکورد تستی در جدول news_items
    const { data: insertedNews, error: insErr } = await db
      .from("news_items")
      .insert({
        source_url: `https://bama.ir/news/test-${timestamp}`,
        title: testTitle,
        slug: testSlug,
        source_image_url: testImageUrl,
        image_url: testImageUrl,
        original_text: testRewritten,
        rewritten_text: testRewritten,
        tg_caption: testTgCaption,
        ig_caption: testIgCaption,
        process_status: "ready",
      })
      .select("id, slug, title, rewritten_text, tg_caption, ig_caption, image_url, source_image_url, source_url")
      .single();

    if (insErr || !insertedNews) {
      throw new Error(`خطا در ثبت خبر تستی در دیتابیس: ${insErr?.message}`);
    }

    const newsId = insertedNews.id;

    // ۲) انتشار در سایت
    console.log(`[test-pipeline] Publishing to site...`);
    const siteResult = await publishToSite({
      id: newsId,
      title: insertedNews.title,
      slug: insertedNews.slug,
      rewritten_text: insertedNews.rewritten_text,
    });

    // ۳) انتشار در تلگرام
    console.log(`[test-pipeline] Publishing to telegram...`);
    const tgResult = await publishToTelegram({
      id: newsId,
      title: insertedNews.title,
      tg_caption: insertedNews.tg_caption,
      image_url: insertedNews.image_url,
      source_image_url: insertedNews.source_image_url,
    });

    // ۴) انتشار در اینستاگرام
    console.log(`[test-pipeline] Publishing to instagram...`);
    const igResult = await publishToInstagram({
      id: newsId,
      title: insertedNews.title,
      ig_caption: insertedNews.ig_caption,
      image_url: insertedNews.image_url,
      source_image_url: insertedNews.source_image_url,
      source_url: insertedNews.source_url,
    });

    return NextResponse.json({
      success: true,
      message: "تست سراسری پایپ‌لاین اجرا شد.",
      news: {
        id: newsId,
        title: insertedNews.title,
        slug: insertedNews.slug,
      },
      results: {
        website: siteResult,
        telegram: tgResult,
        instagram: igResult,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[test-pipeline] Failed: ${msg}`);
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger an instant 3-platform test publication.",
  });
}
