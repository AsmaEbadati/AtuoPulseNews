import { NextRequest, NextResponse } from "next/server";
import { publishReadyArticles } from "@/lib/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
// انتشار (سایت + تلگرام) برای چند خبر؛ حداکثر زمان متوسط.
export const maxDuration = 120;

/**
 * POST /api/publish
 * انتشار اخبار «ready» در مقاصد: سایت (علامت‌گذاری) + تلگرام.
 * idempotent: هر مقصدی که از قبل success شده، skip می‌شود.
 *
 * محافظت: مثل بقیه endpointها نیاز به x-pipeline-secret یا ?secret= دارد.
 * اختیاری: ?limit=N (پیش‌فرض ۵).
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PIPELINE_SECRET_KEY;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "PIPELINE_SECRET_KEY is not configured on the server." },
      { status: 403 }
    );
  }

  const headerSecret = request.headers.get("x-pipeline-secret");
  const urlSecret = new URL(request.url).searchParams.get("secret");
  if (headerSecret !== expectedSecret && urlSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "5", 10) || 5, 1), 20);

  try {
    const result = await publishReadyArticles(limit);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/publish — فقط راهنما (اجرا با POST). */
export async function GET() {
  return NextResponse.json({
    message: "Use POST with x-pipeline-secret header or ?secret= to publish ready articles.",
  });
}
