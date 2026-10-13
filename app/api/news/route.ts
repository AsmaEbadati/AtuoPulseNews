import { NextResponse } from "next/server";
import { getPublicClient, isPublicSupabaseConfigured } from "@/lib/supabase-public";

// همیشه داده تازه بخوان (ISR/کاش نکن) چون محتوا به‌صورت خودکار به‌روز می‌شود.
export const dynamic = "force-dynamic";

/**
 * GET /api/news
 * لیست اخبار منتشرشده برای نمایش در صفحه اصلی.
 * Query param اختیاری: ?limit=N (پیش‌فرض ۵۰)
 *
 * این endpoint فقط می‌خواند (از view عمومی public_news) و از anon key
 * استفاده می‌کند، پس نیازی به service_role روی Netlify نیست.
 */
export async function GET(request: Request) {
  if (!isPublicSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured", articles: [] },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;

  try {
    const db = getPublicClient();
    if (!db) {
      return NextResponse.json(
        { error: "Database client unavailable", articles: [] },
        { status: 503 }
      );
    }
    // فقط اخبار منتشرشده در وب‌سایت را برمی‌گردانیم (از view عمومی، جدیدترین اول)
    const { data, error } = await db
      .from("public_news")
      .select("id, slug, title, body, image_url, source_url, created_at")
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
