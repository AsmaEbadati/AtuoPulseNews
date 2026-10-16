import type { Metadata } from "next";
import { getPublicClient } from "@/lib/supabase-public";
import { getAppSettings } from "@/lib/settings";
import ScheduleClient from "./ScheduleClient";

export const metadata: Metadata = {
  title: "تنظیمات زمانبندی انتشار و هوش مصنوعی",
  description: "تنظیم سراسری زمانبندی انتشار اخبار در سایت، تلگرام و اینستاگرام و انتخاب لحن بازنویسی هوش مصنوعی",
};

export const dynamic = "force-dynamic";
export const revalidate = 0; // بدون کش، دریافت آنی تنظیمات

export interface ScheduleItem {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  process_status: string;
  rewritten_text: string | null;
  edited_website: string | null;
  tg_caption: string | null;
  edited_telegram: string | null;
  ig_caption: string | null;
  edited_instagram: string | null;
  created_at: string;
  site_status: string | null;
  tg_status: string | null;
  ig_status: string | null;
  site_url: string | null;
  tg_url: string | null;
  ig_url: string | null;
  site_scheduled: string | null;
  tg_scheduled: string | null;
  ig_scheduled: string | null;
  site_error: string | null;
  tg_error: string | null;
  ig_error: string | null;
  site_attempts: number | null;
  tg_attempts: number | null;
  ig_attempts: number | null;
}

async function getScheduleItems(): Promise<ScheduleItem[]> {
  const db = getPublicClient();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from("public_schedule")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("[schedule] public_schedule fetch failed:", error.message);
      return [];
    }
    return (data ?? []) as ScheduleItem[];
  } catch (err) {
    console.warn("[schedule] Fetch error:", err);
    return [];
  }
}

export default async function SchedulePage() {
  const [settings, items] = await Promise.all([
    getAppSettings(),
    getScheduleItems(),
  ]);

  return <ScheduleClient initialSettings={settings} items={items} />;
}
