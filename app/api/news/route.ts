import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

// همیشه داده تازه بخوان (ISR/کاش نکن) چون محتوا به‌صورت خودکار به‌روز می‌شود.
export const dynamic = "force-dynamic";

/**
 * GET /api/news
 * لیست اخبار منتشرشده برای نمایش در صفحه اصلی.
 * Query param اختیاری: ?limit=N (پیش‌فرض ۵۰)
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured", articles: [] },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;

  try {
    const db = getSupabaseClient();
    // فقط اخبار منتشرشده در وب‌سایت را برمی‌گردانیم (جدیدترین اول)
    const { data, error } = await db
      .from("news_articles")
      .select(
        "id, slug, title, image_url, content_website, published_website, published_telegram, published_instagram, created_at"
      )
      .eq("published_website", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message, articles: [] }, { status: 500 });
    }

    return NextResponse.json(
      { articles: data ?? [], count: data?.length ?? 0 },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, articles: [] }, { status: 500 });
  }
}
