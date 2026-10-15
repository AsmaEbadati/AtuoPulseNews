import { NextRequest, NextResponse } from "next/server";
import { callModel, buildSystemPrompt } from "@/lib/ai";
import { getAppSettings } from "@/lib/settings";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "****";
  const start = key.slice(0, 8);
  const end = key.slice(-4);
  return `${start}...${end}`;
}

export async function GET(req: NextRequest) {
  const shouldTest = req.nextUrl.searchParams.get("test") === "true";
  const queryKey = req.nextUrl.searchParams.get("key")?.trim();

  // دریافت تنظیمات ذخیره‌شده در دیتابیس
  const settings = await getAppSettings().catch(() => null);
  const customKey = settings?.ai_settings?.custom_api_key?.trim() || "";
  const serverKey = process.env.NVIDIA_API_KEY?.trim() || "";

  // اولویت کلید: ۱) کلید ارسالی برای تست لحظه‌ای ۲) کلید اختصاصی ذخیره‌شده ۳) کلید پیش‌فرض سرور (بک‌اند)
  const effectiveKey = queryKey || customKey || serverKey;
  const keySource: "test_input" | "custom" | "server" | "none" = queryKey
    ? "test_input"
    : customKey
    ? "custom"
    : serverKey
    ? "server"
    : "none";

  if (!effectiveKey) {
    return NextResponse.json(
      {
        configured: false,
        keySource: "none",
        status: "missing_key",
        message: "کلید هوش مصنوعی نه در متغیرهای سرور (بک‌اند) و نه در پنل ثبت نشده است. لطفاً کلید خود را در کادر زیر وارد کنید.",
      },
      { status: 200 }
    );
  }

  // ۱) بررسی اینکه آیا آخرین خطای ذخیره‌شده در دیتابیس مربوط به اتمام سهمیه بوده است؟
  let dbQuotaError = false;
  let lastErrorMessage = "";

  if (isSupabaseConfigured && !queryKey) {
    try {
      const db = getSupabaseClient();
      const { data } = await db
        .from("news_items")
        .select("process_error, updated_at")
        .eq("process_status", "error")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.process_error) {
        lastErrorMessage = data.process_error;
        if (
          data.process_error.includes("AI_QUOTA_EXCEEDED") ||
          /quota|credit|insufficient|429|402|rate limit|resource_exhausted/i.test(
            data.process_error
          )
        ) {
          dbQuotaError = true;
        }
      }
    } catch {
      // ادامه با بررسی تستی
    }
  }

  // اگر تست درخواستی نبود و در دیتابیس هم خطای سهمیه بود، فوراً برگردان
  if (!shouldTest && dbQuotaError) {
    return NextResponse.json(
      {
        configured: true,
        keySource,
        maskedKey: maskApiKey(effectiveKey),
        status: "quota_exceeded",
        message:
          "توکن یا اعتبار سهمیه این کلید به پایان رسیده است. می‌توانید در کادر زیر یک کلید جدید وارد کنید تا جایگزین شود.",
        lastError: lastErrorMessage,
      },
      { status: 200 }
    );
  }

  // ۲) تست آنلاین ارتباط با کلید انتخابی
  if (shouldTest) {
    const start = Date.now();
    try {
      await callModel(
        buildSystemPrompt("formal"),
        'عنوان خبر: تست اتصال\nفقط یک شیء JSON برگردان: {"rewritten_text":"این یک تست کوتاه اتصال به سرویس هوش مصنوعی اتوپالس است.","tg_caption":"تست","ig_caption":"#تست"}',
        effectiveKey
      );
      const latencyMs = Date.now() - start;

      const sourceLabel =
        keySource === "custom"
          ? "کلید اختصاصی پنل"
          : keySource === "test_input"
          ? "کلید واردشده در کادر"
          : "کلید پیش‌فرض سرور (بک‌اند)";

      return NextResponse.json(
        {
          configured: true,
          keySource,
          maskedKey: maskApiKey(effectiveKey),
          status: "active",
          latencyMs,
          model: process.env.NVIDIA_API_MODEL || "openai/gpt-oss-20b",
          message: `سرویس هوش مصنوعی با موفقیت پاسخ داد (${sourceLabel} معتبر و فعال است).`,
        },
        { status: 200 }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota =
        msg.includes("AI_QUOTA_EXCEEDED") ||
        /quota|credit|insufficient|429|402|rate limit|resource_exhausted/i.test(msg);

      if (isQuota) {
        return NextResponse.json(
          {
            configured: true,
            keySource,
            maskedKey: maskApiKey(effectiveKey),
            status: "quota_exceeded",
            message:
              "سهمیه یا توکن این کلید API به پایان رسیده است. می‌توانید در کادر زیر یک کلید جدید وارد کنید.",
            rawError: msg,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          configured: true,
          keySource,
          maskedKey: maskApiKey(effectiveKey),
          status: "error",
          message: `خطا در فراخوانی مدل با این کلید: ${msg.slice(0, 160)}`,
        },
        { status: 200 }
      );
    }
  }

  // حالت پیش‌فرض بدون تست مستقیم
  const sourceLabel =
    keySource === "custom"
      ? "در حال استفاده از کلید اختصاصی واردشده در پنل"
      : "در حال استفاده از کلید پیش‌فرض سرور (بک‌اند)";

  return NextResponse.json(
    {
      configured: true,
      keySource,
      maskedKey: maskApiKey(effectiveKey),
      status: "ready",
      model: process.env.NVIDIA_API_MODEL || "openai/gpt-oss-20b",
      message: `${sourceLabel} (${maskApiKey(effectiveKey)})`,
    },
    { status: 200 }
  );
}
