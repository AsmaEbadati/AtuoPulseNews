// تست مستقیم Instagram Graph API — یک پست واقعی با تصویر نمونه.
// نیاز به env: INSTAGRAM_ACCESS_TOKEN و INSTAGRAM_ACCOUNT_ID
//   (می‌توانی موقتاً در همین سشن ست کنی، یا در .env بگذار)

const fs = require("fs");
const path = require("path");

// بارگذاری .env اگر موجود باشد (بدون نوشتن روی متغیرهای از قبل ست‌شده)
(function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

if (!TOKEN || !ACCOUNT_ID) {
  console.error("❌ INSTAGRAM_ACCESS_TOKEN و INSTAGRAM_ACCOUNT_ID را ست کن.");
  console.error("   مثال:");
  console.error('   $env:INSTAGRAM_ACCESS_TOKEN="EAAB..."; $env:INSTAGRAM_ACCOUNT_ID="178414..."');
  process.exit(1);
}

// تصویر نمونه عمومی (یک تصویر خودرو از باما)
const IMAGE_URL = "https://statics.bama.ir/CarThumbnailImg/2024-11/20241118_1207_original.jpg";
const CAPTION = "🚗 تست انتشار خودکار AutoPulse AI\n\nاین پست با پایپ‌لاین خودکار خبر خودرو ساخته شده است.\n\n#خودرو #اخبار_خودرو #باما";

async function call(method, path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url.toString(), { method, signal: AbortSignal.timeout(60000) });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`${method} ${path}: ${json?.error?.message ?? res.status}`);
  }
  return json;
}

(async () => {
  console.log("▶ 1) ساخت container...");
  const container = await call("POST", `${ACCOUNT_ID}/media`, {
    image_url: IMAGE_URL,
    caption: CAPTION,
  });
  const creationId = container.id;
  console.log("   creation_id:", creationId);

  console.log("▶ 2) publish...");
  const published = await call("POST", `${ACCOUNT_ID}/media_publish`, {
    creation_id: creationId,
  });
  console.log("   media_id:", published.id);

  console.log("▶ 3) گرفتن permalink...");
  try {
    const media = await call("GET", `${published.id}`, { fields: "permalink" });
    console.log("\n✅ منتشر شد! لینک:", media.permalink);
  } catch (e) {
    console.log("\n✅ منتشر شد (ولی permalink گرفته نشد):", e.message);
    console.log("   media_id برای بررسی دستی:", published.id);
  }
})().catch((e) => {
  console.error("❌ FAILED:", e.message);
  process.exit(1);
});
