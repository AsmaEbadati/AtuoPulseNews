// ارسال یک درخواست نمونه به وب‌هوک Make (برای مرحلهٔ "Run once").
// این دقیقاً همان ساختار بدنه‌ای است که publisher اینستاگرام می‌فرستد،
// تا Make ساختار فیلدها (image_url, caption, secret, ...) را بشناسد.
//
// استفاده:
//   node send_make_sample.cjs "https://hook.eu2.make.com/XXXXX"
//
// image_url باید یک تصویر عمومی و قابل دسترس از اینترنت باشد.

const WEBHOOK_URL = process.argv[2];
if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith("http")) {
  console.error("❌ URL وب‌هوک را به‌عنوان آرگومان بده:");
  console.error('   node send_make_sample.cjs "https://hook.eu2.make.com/XXXXX"');
  process.exit(1);
}

const SECRET = "autopulse_ig_secret_9f3a7c";

const body = {
  news_id: "sample-test-00000000",
  title: "تست انتشار خودکار AutoPulse",
  // یک تصویر واقعی عمومی (نمونهٔ یک خبر خودرو از باما)
  image_url:
    "https://statics.bama.ir/CarThumbnailImg/2024-11/20241118_1207_original.jpg",
  caption: "🚗 تست انتشار خودکار خبر خودرو\n\nاین پست با پایپ‌لاین AutoPulse AI ساخته شده است.\n\n#خودرو #اخبار_خودرو #باما",
  secret: SECRET,
};

(async () => {
  console.log("▶ ارسال نمونه به:", WEBHOOK_URL);
  console.log("بدنه:", JSON.stringify(body, null, 2));

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-make-secret": SECRET, // fallback (اگه فیلتر روی هدر بود)
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });

  console.log(`\nHTTP ${res.status}`);
  const text = await res.text();
  try {
    console.log("پاسخ:", JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log("پاسخ (متن):", text.slice(0, 500));
  }
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
