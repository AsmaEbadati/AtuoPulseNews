import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

/**
 * POST /api/schedule/[id]
 * ذخیره زمانبندی انتشار + محتوای ویرایش‌شده برای یک خبر
 *
 * Body: {
 *   edited_website?:   string | null,
 *   edited_telegram?:  string | null,
 *   edited_instagram?: string | null,
 *   site_scheduled?:      string | null,  // ISO datetime
 *   telegram_scheduled?:  string | null,
 *   instagram_scheduled?: string | null,
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { id: newsId } = await params;
  if (!newsId) {
    return NextResponse.json({ error: "Missing news id" }, { status: 400 });
  }

  let body: {
    edited_website?: string | null;
    edited_telegram?: string | null;
    edited_instagram?: string | null;
    site_scheduled?: string | null;
    telegram_scheduled?: string | null;
    instagram_scheduled?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const db = getSupabaseClient();

  // ۱) ذخیره محتوای ویرایش‌شده روی news_items
  const articleUpdate: Record<string, unknown> = {};
  if (body.edited_website   !== undefined) articleUpdate.edited_website   = body.edited_website;
  if (body.edited_telegram  !== undefined) articleUpdate.edited_telegram  = body.edited_telegram;
  if (body.edited_instagram !== undefined) articleUpdate.edited_instagram = body.edited_instagram;

  if (Object.keys(articleUpdate).length > 0) {
    const { error: updErr } = await db
      .from("news_items")
      .update(articleUpdate)
      .eq("id", newsId);
    if (updErr) {
      return NextResponse.json({ error: `article update failed: ${updErr.message}` }, { status: 500 });
    }
  }

  // ۲) ذخیره زمانبندی برای هر مقصد در جدول publications
  const schedulePairs: Array<{ destination: string; scheduled_at: string | null }> = [];
  if (body.site_scheduled      !== undefined) schedulePairs.push({ destination: "site",      scheduled_at: body.site_scheduled });
  if (body.telegram_scheduled  !== undefined) schedulePairs.push({ destination: "telegram",  scheduled_at: body.telegram_scheduled });
  if (body.instagram_scheduled !== undefined) schedulePairs.push({ destination: "instagram", scheduled_at: body.instagram_scheduled });

  for (const pair of schedulePairs) {
    // ابتدا بررسی کن آیا ردیفی برای این خبر + مقصد وجود دارد
    const { data: existing } = await db
      .from("publications")
      .select("id, status")
      .eq("news_id", newsId)
      .eq("destination", pair.destination)
      .maybeSingle();

    if (existing) {
      // فقط اگر هنوز منتشر نشده، زمانبندی رو به‌روز کن
      if (existing.status !== "success") {
        await db
          .from("publications")
          .update({ scheduled_at: pair.scheduled_at })
          .eq("id", existing.id);
      }
    } else {
      // ردیف جدید با وضعیت pending بساز
      await db.from("publications").insert({
        news_id: newsId,
        destination: pair.destination,
        status: "pending",
        scheduled_at: pair.scheduled_at,
        attempts: 0,
      });
    }
  }

  return NextResponse.json({ ok: true, news_id: newsId });
}
