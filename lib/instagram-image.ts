import sharp from "sharp";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export interface ImageValidationResult {
  valid: boolean;
  width?: number;
  height?: number;
  aspectRatio?: number;
  format?: string;
  sizeBytes?: number;
  isSquare?: boolean;
  isInstagramCompliant?: boolean;
  error?: string;
  url: string;
}

/**
 * بررسی و اعتبارسنجی تصویر قبل از ارسال به Make یا Instagram Graph API
 * - الزامات اینستاگرام:
 *   1. نسبت ابعاد بین 0.8 (4:5 پرتره) تا 1.91 (لنداسکیپ)
 *   2. فرمت JPEG یا PNG
 *   3. سایز حداکثر 8 مگابایت
 *   4. پروتکل امن HTTPS و عمومی
 */
export async function validateInstagramImage(url: string): Promise<ImageValidationResult> {
  if (!url || !url.startsWith("https://")) {
    return {
      valid: false,
      url,
      error: "آدرس تصویر باید با پروتکل امن https:// شروع شود.",
    };
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "AutoPulse-Instagram-Validator/1.0",
      },
    });

    if (!res.ok) {
      return {
        valid: false,
        url,
        error: `خطا در دریافت تصویر (کد وضعیت: ${res.status})`,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image/")) {
      return {
        valid: false,
        url,
        error: `نوع محتوا تصویر نیست: ${contentType}`,
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeBytes = buffer.length;

    if (sizeBytes > 8 * 1024 * 1024) {
      return {
        valid: false,
        url,
        sizeBytes,
        error: "حجم تصویر بیشتر از ۸ مگابایت (حداکثر مجاز اینستاگرام) است.",
      };
    }

    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const aspectRatio = height > 0 ? Number((width / height).toFixed(3)) : 0;
    const format = metadata.format || "unknown";

    // نسبت مجاز اینستاگرام بین 0.80 (4:5) تا 1.91
    const isCompliant = aspectRatio >= 0.8 && aspectRatio <= 1.91;
    const isSquare = Math.abs(aspectRatio - 1.0) < 0.05;

    return {
      valid: true,
      url,
      width,
      height,
      aspectRatio,
      format,
      sizeBytes,
      isSquare,
      isInstagramCompliant: isCompliant,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      url,
      error: `عدم امکان اعتبارسنجی تصویر: ${msg}`,
    };
  }
}

export type InstagramImageRatio = "square" | "portrait";

/**
 * تبدیل هوشمند هر تصویر خودرو به سایز استاندارد اینستاگرام:
 * - مربع ۱۰۸۰×۱۰۸۰ (نسبت ۱:۱): با حاشیه مات هماهنگ بلور شده در پس‌زمینه و خودروی شفاف در جلو
 * - عمودی ۱۰۸۰×۱۳۵۰ (نسبت ۴:۵): برای حداکثر دید در فید اینستاگرام
 * و سپس آپلود خودکار در Supabase Storage (باکت news)
 */
export async function prepareInstagramImage(
  sourceUrl: string,
  newsId: string,
  ratio: InstagramImageRatio = "square"
): Promise<{ success: boolean; finalUrl: string; width: number; height: number; error?: string }> {
  if (!sourceUrl || !sourceUrl.startsWith("https://")) {
    return {
      success: false,
      finalUrl: sourceUrl,
      width: 0,
      height: 0,
      error: "آدرس تصویر منبع معتبر نیست.",
    };
  }

  const targetWidth = 1080;
  const targetHeight = ratio === "portrait" ? 1350 : 1080;

  try {
    // ۱) دریافت بافر تصویر اصلی
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "AutoPulse-ImageProcessor/1.0" },
    });
    if (!res.ok) {
      throw new Error(`خطا در دانلود تصویر منبع: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // ۲) ساخت تصویر بهینه اینستاگرام با شارپ
    // برای اینکه ماشین هرگز دفرمه یا بریده نشود، یک پس‌زمینه بلور شیک از خود تصویر می‌سازیم
    // و تصویر اصلی را وسط‌چین و واضح روی آن قرار می‌دهیم (استاندارد پیج‌های حرفه‌ای خودرو)
    const background = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, { fit: "cover" })
      .blur(25)
      .modulate({ brightness: 0.65, saturation: 1.1 })
      .toBuffer();

    const foreground = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    const compositeImage = await sharp(background)
      .composite([{ input: foreground, gravity: "center" }])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    // ۳) آپلود در Supabase Storage
    if (isSupabaseConfigured) {
      const db = getSupabaseClient();
      const storagePath = `instagram/${newsId}-${ratio}.jpg`;

      const { error: uploadErr } = await db.storage
        .from("news")
        .upload(storagePath, compositeImage, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubData } = db.storage.from("news").getPublicUrl(storagePath);
        if (pubData?.publicUrl) {
          console.log(`[instagram-image] ✅ Prepared & uploaded ${ratio} image: ${pubData.publicUrl}`);
          return {
            success: true,
            finalUrl: pubData.publicUrl,
            width: targetWidth,
            height: targetHeight,
          };
        }
      } else {
        console.warn(`[instagram-image] Supabase upload failed: ${uploadErr.message}`);
      }
    }

    // اگر آپلود ممکن نبود، همان سورس اصلی برمی‌گردد
    return {
      success: true,
      finalUrl: sourceUrl,
      width: targetWidth,
      height: targetHeight,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[instagram-image] Failed to prepare image for ${newsId}: ${msg}`);
    return {
      success: false,
      finalUrl: sourceUrl,
      width: 0,
      height: 0,
      error: msg,
    };
  }
}
