import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { AITone } from "./ai";

export interface PlatformScheduleConfig {
  enabled: boolean;
  mode: "instant" | "scheduled"; // instant: به محض انتشار در باما | scheduled: ساعت مشخص
  time: string; // e.g. "10:00"
  webhook_url?: string; // آدرس وب‌هوک (مانند Make.com Webhook)
  aspect_ratio?: "square" | "portrait"; // ابعاد عکس اختصاصی (مربع ۱:۱ یا عمودی ۴:۵)
}

export interface ScrapeScheduleConfig {
  enabled: boolean;
  times_per_day: number; // پیش‌فرض ۴ بار در شبانه‌روز
  schedule_times: string[]; // ساعات اجرای اسکرپ در روز (تهران)
  cron_expression: string; // کران جاب متناظر در pg_cron (UTC)
  auto_publish_on_new: boolean; // به محض مشاهده خبر جدید، تولید محتوا با AI و انتشار آنی انجام گیرد
}

export interface AppPublishSettings {
  website: PlatformScheduleConfig;
  telegram: PlatformScheduleConfig;
  instagram: PlatformScheduleConfig;
}

export interface AppAISettings {
  tone: AITone;
  model: string;
  custom_api_key?: string; // کلید اختصاصی واردشده در پنل کاربری (اختیاری)
}

export interface AppSettings {
  scrape_schedule: ScrapeScheduleConfig;
  publish_schedule: AppPublishSettings;
  ai_settings: AppAISettings;
  updated_at?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  scrape_schedule: {
    enabled: true,
    times_per_day: 4,
    schedule_times: ["09:30", "13:30", "17:30", "21:30"],
    cron_expression: "0 6,10,14,18 * * *",
    auto_publish_on_new: true,
  },
  publish_schedule: {
    website: {
      enabled: true,
      mode: "instant",
      time: "09:30",
    },
    telegram: {
      enabled: true,
      mode: "instant",
      time: "11:00",
    },
    instagram: {
      enabled: true,
      mode: "instant",
      time: "18:00",
      webhook_url: "https://hook.us2.make.com/p24hhdz7k98h6gx5aont3rq88lxc3x8p",
      aspect_ratio: "square",
    },
  },
  ai_settings: {
    tone: "formal",
    model: "openai/gpt-oss-20b",
    custom_api_key: "",
  },
};

// حافظه موقت در سرور
let inMemorySettings: AppSettings = { ...DEFAULT_SETTINGS };

/**
 * دریافت تنظیمات سراسری پلتفرم‌ها، اسکرپ و هوش مصنوعی
 */
export async function getAppSettings(): Promise<AppSettings> {
  if (!isSupabaseConfigured) {
    return inMemorySettings;
  }

  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", ["scrape_schedule", "publish_schedule", "ai_settings"]);

    if (error || !data || data.length === 0) {
      return inMemorySettings;
    }

    const loadedSettings: AppSettings = {
      scrape_schedule: { ...DEFAULT_SETTINGS.scrape_schedule },
      publish_schedule: { ...DEFAULT_SETTINGS.publish_schedule },
      ai_settings: { ...DEFAULT_SETTINGS.ai_settings },
    };

    let latestUpdated = "";

    for (const row of data) {
      if (row.key === "scrape_schedule" && row.value) {
        loadedSettings.scrape_schedule = {
          ...DEFAULT_SETTINGS.scrape_schedule,
          ...row.value,
        };
      }
      if (row.key === "publish_schedule" && row.value) {
        loadedSettings.publish_schedule = {
          ...DEFAULT_SETTINGS.publish_schedule,
          ...row.value,
        };
      }
      if (row.key === "ai_settings" && row.value) {
        loadedSettings.ai_settings = {
          ...DEFAULT_SETTINGS.ai_settings,
          ...row.value,
        };
      }
      if (row.updated_at && row.updated_at > latestUpdated) {
        latestUpdated = row.updated_at;
      }
    }

    if (latestUpdated) {
      loadedSettings.updated_at = latestUpdated;
    }

    inMemorySettings = loadedSettings;
    return loadedSettings;
  } catch (err) {
    console.warn("[settings] Failed to fetch settings from DB, using fallback:", err);
    return inMemorySettings;
  }
}

/**
 * ذخیره تنظیمات سراسری در Supabase و کش سرور
 */
export async function saveAppSettings(
  settings: Partial<AppSettings>
): Promise<AppSettings> {
  const merged: AppSettings = {
    scrape_schedule: {
      ...inMemorySettings.scrape_schedule,
      ...(settings.scrape_schedule || {}),
    },
    publish_schedule: {
      ...inMemorySettings.publish_schedule,
      ...(settings.publish_schedule || {}),
    },
    ai_settings: {
      ...inMemorySettings.ai_settings,
      ...(settings.ai_settings || {}),
    },
    updated_at: new Date().toISOString(),
  };

  inMemorySettings = merged;

  if (isSupabaseConfigured) {
    try {
      const db = getSupabaseClient();
      const rows = [
        {
          key: "scrape_schedule",
          value: merged.scrape_schedule,
          updated_at: merged.updated_at,
        },
        {
          key: "publish_schedule",
          value: merged.publish_schedule,
          updated_at: merged.updated_at,
        },
        {
          key: "ai_settings",
          value: merged.ai_settings,
          updated_at: merged.updated_at,
        },
      ];

      const { error } = await db.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) {
        console.warn("[settings] DB upsert failed (table might need migration):", error.message);
      }

      // همگام‌سازی مستقیم pg_cron در دیتابیس Supabase در صورت وجود تابع set_pipeline_cron
      if (merged.scrape_schedule?.cron_expression) {
        try {
          await db.rpc("set_pipeline_cron", { p_cron_expr: merged.scrape_schedule.cron_expression });
        } catch (rpcErr) {
          console.log("[settings] set_pipeline_cron RPC notice:", rpcErr);
        }
      }
    } catch (err) {
      console.warn("[settings] Error saving settings to Supabase:", err);
    }
  }

  return merged;
}
