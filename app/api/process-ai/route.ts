import { NextRequest, NextResponse } from "next/server";
import { processPendingArticles } from "@/lib/pipeline";
import { isAIConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
// هر خبر ~۱۰۰ ثانیه AI می‌برد؛ با limit=3 به‌تناسب ۶ دقیقه مجاز می‌کنیم.
export const maxDuration = 300;

/**
 * POST /api/process-ai
 * پردازش اخبار «new» با AI (Scrape full body → بازنویسی → ready).
 *
 * محافظت: مثل /api/pipeline، نیاز به x-pipeline-secret یا ?secret= دارد.
 * اختیاری: ?limit=N برای تعیین تعداد خبر (پیش‌فرض ۳).
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

  if (!isAIConfigured) {
    return NextResponse.json({ error: "AI not configured (NVIDIA_API_KEY)." }, { status: 503 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "3", 10) || 3, 1), 5);

  try {
    const result = await processPendingArticles(limit);
    const status = result.failed > 0 && result.succeeded === 0 ? 500 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
