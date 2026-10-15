import type { Metadata } from "next";
import { getPublicClient } from "@/lib/supabase-public";
import ScheduleClient from "./ScheduleClient";

export const metadata: Metadata = {
  title: "کنترل انتشار — زمانبندی و ویرایش",
  description: "زمانبندی انتشار اخبار در سایت، تلگرام و اینستاگرام و ویرایش محتوای هوش مصنوعی",
};

export const revalidate = 60; // هر ۶۰ ثانیه داده‌های تازه

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

  const { data, error } = await db
    .from("public_schedule")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[schedule] public_schedule fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as ScheduleItem[];
}

export default async function SchedulePage() {
  const items = await getScheduleItems();
  return <ScheduleClient items={items} />;
}
