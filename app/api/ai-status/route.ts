import { NextRequest, NextResponse } from "next/server";
import { isAIConfigured, callModel, buildSystemPrompt } from "@/lib/ai";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shouldTest = req.nextUrl.searchParams.get("test") === "true";

  if (!isAIConfigured) {
    return NextResponse.json(
      {
        configured: false,
        status: "missing_key",
        message: "کلید NVIDIA_API_KEY در تنظیمات سرور ثبت نشده است.",
      },
      { status: 200 }
    );
  }

  // ۱) بررسی اینکه آیا آخرین خطای ذخیره‌شده در دیتابیس مربوط به اتمام سهمیه بوده است؟
  let dbQuotaError = false;
  let lastErrorMessage = "";

  if (isSupabaseConfigured) {
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
          /quota|credit|insufficient|429|rate limit|resource_exhausted/i.test(
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
        status: "quota_exceeded",
        message:
          "توکن یا اعتبار سهمیه API هوش مصنوعی به پایان رسیده است. باید منتظر شارژ سهمیه بمانید یا کلید جدید اضافه کنید.",
        lastError: lastErrorMessage,
      },
      { status: 200 }
    );
  }

  // اگر درخواست تست فعال بود
  if (shouldTest) {
    const start = Date.now();
    try {
      // یک پرامپت تستی بسیار کوتاه با ۱ جمله برای سنجش اعتبار سهمیه
      await callModel(
        buildSystemPrompt("formal"),
        'عنوان خبر: تست اتصال\nفقط یک شیء JSON برگردان: {"rewritten_text":"این یک تست کوتاه اتصال به سرویس هوش مصنوعی اتوپالس است.","tg_caption":"تست","ig_caption":"#تست"}'
      );
      const latencyMs = Date.now() - start;

      return NextResponse.json(
        {
          configured: true,
          status: "active",
          latencyMs,
          model: process.env.NVIDIA_API_MODEL || "openai/gpt-oss-20b",
          message: "سرویس هوش مصنوعی فعال است و سهمیه معتبر دارد.",
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
            status: "quota_exceeded",
            message:
              "توکن یا اعتبار سهمیه API هوش مصنوعی به پایان رسیده است. باید منتظر شارژ سهمیه بمانید یا کلید جدید اضافه کنید.",
            rawError: msg,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          configured: true,
          status: "error",
          message: `خطا در برقراری ارتباط با مدل: ${msg.slice(0, 150)}`,
        },
        { status: 200 }
      );
    }
  }

  // در حالت پیش‌فرض بدون تست مستقیم و بدون خطای ثبت‌شده
  return NextResponse.json(
    {
      configured: true,
      status: "ready",
      model: process.env.NVIDIA_API_MODEL || "openai/gpt-oss-20b",
      message: "سرویس هوش مصنوعی پیکربندی شده است.",
    },
    { status: 200 }
  );
}
