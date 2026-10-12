import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
// اجرای پایپ‌لاین ممکن است طول بکشد (fetch + درج چند رکورد)؛ حداکثر زمان را بالا می‌بریم.
export const maxDuration = 60;

/**
 * POST /api/pipeline
 * اجرای دستی پایپ‌لاین (Scrape → Dedup → ذخیره).
 *
 * محافظت: درخواست باید یکی از این‌ها را شامل شود:
 *   - هدر:  x-pipeline-secret: <PIPELINE_SECRET_KEY>
 *   - یا query: ?secret=<PIPELINE_SECRET_KEY>
 * اگر PIPELINE_SECRET_KEY تنظیم نشده باشد، endpoint قفل است (۴۰۳).
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.PIPELINE_SECRET_KEY;

  // اگر secret تعریف نشده، endpoint را کاملاً قفل می‌کنیم تا سوءاستفاده نشود.
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
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  try {
    const result = await runPipeline();
    const httpStatus = result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/pipeline — فقط برای سلامت/راهنما (اجرای پایپ‌لاین فقط با POST).
 */
export async function GET() {
  return NextResponse.json({
    message: "Use POST with x-pipeline-secret header or ?secret= to run the pipeline.",
  });
}
