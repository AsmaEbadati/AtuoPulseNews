"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Icon, IconBox, type IconName } from "../components/Icons";
import type { AppSettings, PlatformScheduleConfig } from "@/lib/settings";
import { AI_TONES, type AITone } from "@/lib/ai";
import type { ScheduleItem } from "./page";

interface Props {
  initialSettings: AppSettings;
  items: ScheduleItem[];
}

interface AIStatusResponse {
  configured: boolean;
  status: "active" | "quota_exceeded" | "ready" | "missing_key" | "error";
  message: string;
  keySource?: "test_input" | "custom" | "server" | "none";
  maskedKey?: string;
  latencyMs?: number;
  model?: string;
  rawError?: string;
}

export default function ScheduleClient({ initialSettings, items }: Props) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // وضعیت هوش مصنوعی و سهمیه
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [isCheckingAi, setIsCheckingAi] = useState(false);

  // نمایش پیش‌نمایش پرامپت
  const [showPromptInspector, setShowPromptInspector] = useState(false);

  // تب فعال در پایین (نمایش خبرها)
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<"website" | "telegram" | "instagram">("website");

  // تست فوری انتشار در ۳ پلتفرم
  const [isRunningTestPipeline, setIsRunningTestPipeline] = useState(false);
  const [pipelineTestResult, setPipelineTestResult] = useState<any | null>(null);

  const handleRunTestPipeline = async () => {
    setIsRunningTestPipeline(true);
    setPipelineTestResult(null);
    try {
      const res = await fetch("/api/test-pipeline-run", { method: "POST" });
      const data = await res.json();
      setPipelineTestResult(data);
    } catch {
      setPipelineTestResult({
        success: false,
        error: "خطا در برقراری ارتباط با سرور برای اجرای تست.",
      });
    } finally {
      setIsRunningTestPipeline(false);
    }
  };

  // تست وب‌هوک Make برای اینستاگرام
  const [testingMakeWebhook, setTestingMakeWebhook] = useState(false);
  const [makeTestResult, setMakeTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testMakeWebhook = async (url?: string) => {
    const targetUrl = url || settings.publish_schedule.instagram.webhook_url;
    if (!targetUrl || !targetUrl.trim()) {
      setMakeTestResult({ success: false, message: "لطفاً ابتدا آدرس وب‌هوک Make را وارد کنید." });
      return;
    }
    setTestingMakeWebhook(true);
    setMakeTestResult(null);
    try {
      const res = await fetch("/api/test-instagram-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: targetUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMakeTestResult({ success: true, message: data.message || "رویداد تستی با موفقیت به Make ارسال شد!" });
      } else {
        setMakeTestResult({ success: false, message: data.error || "خطا در فراخوانی وب‌هوک Make." });
      }
    } catch {
      setMakeTestResult({ success: false, message: "خطا در اتصال به سرور تست." });
    } finally {
      setTestingMakeWebhook(false);
    }
  };

  const [showApiKey, setShowApiKey] = useState(false);

  // دریافت وضعیت اولیه هوش مصنوعی
  useEffect(() => {
    fetchAiStatus(false);
  }, []);

  const fetchAiStatus = async (testPing = false, keyOverride?: string) => {
    setIsCheckingAi(true);
    try {
      const params = new URLSearchParams();
      if (testPing) params.set("test", "true");
      const keyToTest = keyOverride !== undefined ? keyOverride : settings.ai_settings.custom_api_key;
      if (keyToTest && keyToTest.trim()) {
        params.set("key", keyToTest.trim());
      }
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/ai-status${qs}`);
      const data = (await res.json()) as AIStatusResponse;
      setAiStatus(data);
    } catch {
      setAiStatus({
        configured: true,
        status: "error",
        message: "خطا در اتصال به سرویس ارزیابی هوش مصنوعی",
      });
    } finally {
      setIsCheckingAi(false);
    }
  };

  const updateCustomApiKey = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      ai_settings: {
        ...prev.ai_settings,
        custom_api_key: key,
      },
    }));
    setSaveSuccess(false);
  };

  // به‌روزرسانی تنظیمات پلتفرم
  const updatePlatformConfig = (
    platform: "website" | "telegram" | "instagram",
    partial: Partial<PlatformScheduleConfig>
  ) => {
    setSettings((prev) => ({
      ...prev,
      publish_schedule: {
        ...prev.publish_schedule,
        [platform]: {
          ...prev.publish_schedule[platform],
          ...partial,
        },
      },
    }));
    setSaveSuccess(false);
  };

  // به‌روزرسانی لحن هوش مصنوعی
  const updateTone = (tone: AITone) => {
    setSettings((prev) => ({
      ...prev,
      ai_settings: {
        ...prev.ai_settings,
        tone,
      },
    }));
    setSaveSuccess(false);
  };

  // ذخیره در سرور
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("خطا در ذخیره تنظیمات روی سرور");
      }

      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "خطایی رخ داد");
    } finally {
      setIsSaving(false);
    }
  };

  const currentToneInfo = AI_TONES[settings.ai_settings.tone] || AI_TONES.formal;

  const platforms: {
    key: "website" | "telegram" | "instagram";
    title: string;
    subtitle: string;
    icon: IconName;
    tone: "primary" | "accent" | "success";
    suggestedTimes: string[];
  }[] = [
    {
      key: "website",
      title: "وب‌سایت AutoPulse",
      subtitle: "انتشار روی پایگاه خبری اصلی سایت",
      icon: "globe",
      tone: "primary",
      suggestedTimes: ["09:00", "10:00", "12:00", "14:00"],
    },
    {
      key: "telegram",
      title: "کانال تلگرام",
      subtitle: "انتشار خودکار پست همراه با تصویر و متن کوتاه",
      icon: "telegram",
      tone: "accent",
      suggestedTimes: ["11:00", "13:30", "17:00", "20:00"],
    },
    {
      key: "instagram",
      title: "صفحه اینستاگرام",
      subtitle: "انتشار پست تصویری، کپشن کامل و هشتگ‌های پربازدید",
      icon: "instagram",
      tone: "success",
      suggestedTimes: ["12:30", "18:00", "19:30", "21:00"],
    },
  ];

  return (
    <div className="container" style={{ paddingBottom: "var(--space-12)" }}>
      {/* هدر صفحه */}
      <div className="page-head">
        <div>
          <div className="hero__eyebrow" style={{ marginBottom: "var(--space-2)" }}>
            <Icon name="sparkle" size={14} />
            <span>تنظیمات سراسری سیستم</span>
          </div>
          <h1 className="page-head__title">زمان‌بندی انتشار و هوش مصنوعی</h1>
          <p className="page-head__subtitle">
            قوانین انتشار خودکار در هر ۳ پلتفرم، سبک نگارش هوش مصنوعی و وضعیت سهمیه API را یکبار تعیین کنید.
          </p>
        </div>

        {/* دکمه‌های عملیاتی بالا */}
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleRunTestPipeline}
            disabled={isRunningTestPipeline}
            className="btn btn--outline"
            style={{
              padding: "10px 18px",
              fontSize: "13px",
              borderColor: "var(--color-primary)",
              color: "var(--color-primary)",
            }}
            title="انتشار فوری یک خبر تستی در سایت، تلگرام و اینستاگرام جهت اطمینان از سلامت پایپ‌لاین"
          >
            <Icon name="refresh" size={15} />
            <span>{isRunningTestPipeline ? "در حال اجرای تست انتشار..." : "🚀 تست فوری انتشار (سایت + تلگرام + اینستا)"}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`btn btn--primary ${isSaving ? "btn--loading" : ""}`}
            style={{ padding: "10px 24px", fontSize: "14px" }}
          >
            <Icon name="sparkle" size={15} />
            <span>{isSaving ? "در حال ذخیره..." : "ذخیره تنظیمات"}</span>
          </button>
        </div>
      </div>

      {/* گزارش نتایج تست فوری انتشار */}
      {pipelineTestResult && (
        <div
          className="card animate-fade-in"
          style={{
            marginBottom: "var(--space-6)",
            borderColor: pipelineTestResult.success ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
            background: "var(--color-surface-2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <IconBox
                name={pipelineTestResult.success ? "check" : "alert"}
                tone={pipelineTestResult.success ? "success" : "accent"}
                size={18}
              />
              <span style={{ fontWeight: 700, fontSize: "15px" }}>گزارش تست سراسری پایپ‌لاین:</span>
            </div>
            <button
              onClick={() => setPipelineTestResult(null)}
              className="btn btn--outline"
              style={{ fontSize: "11px", padding: "2px 8px", height: "auto" }}
            >
              بستن گزارش
            </button>
          </div>

          {pipelineTestResult.news && (
            <div style={{ fontSize: "13px", color: "var(--color-text-1)", marginBottom: "var(--space-3)", fontWeight: 600 }}>
              عنوان خبر تست: {pipelineTestResult.news.title}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
            {/* وب‌سایت */}
            <div style={{ padding: "var(--space-3)", background: "var(--color-surface-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>🌐 وب‌سایت</span>
                <span className={`badge badge--${pipelineTestResult.results?.website?.status === "success" ? "success" : "error"}`}>
                  {pipelineTestResult.results?.website?.status === "success" ? "منتشر شد" : "ناموفق / رد شد"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-text-2)", margin: 0 }}>
                {pipelineTestResult.results?.website?.post_url ? (
                  <a href={pipelineTestResult.results.website.post_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>
                    مشاهده خبر در سایت ↗
                  </a>
                ) : (
                  pipelineTestResult.results?.website?.error || "بدون خطا"
                )}
              </p>
            </div>

            {/* تلگرام */}
            <div style={{ padding: "var(--space-3)", background: "var(--color-surface-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>✈️ کانال تلگرام</span>
                <span className={`badge badge--${pipelineTestResult.results?.telegram?.status === "success" ? "success" : pipelineTestResult.results?.telegram?.status === "skipped" ? "neutral" : "error"}`}>
                  {pipelineTestResult.results?.telegram?.status === "success" ? "ارسال شد" : pipelineTestResult.results?.telegram?.status === "skipped" ? "رد شد (عدم تنظیم)" : "خطا"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-text-2)", margin: 0 }}>
                {pipelineTestResult.results?.telegram?.post_url ? (
                  <a href={pipelineTestResult.results.telegram.post_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>
                    مشاهده پست در تلگرام ↗
                  </a>
                ) : (
                  pipelineTestResult.results?.telegram?.error || "ارسال تلگرام با موفقیت انجام شد."
                )}
              </p>
            </div>

            {/* اینستاگرام */}
            <div style={{ padding: "var(--space-3)", background: "var(--color-surface-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>📸 اینستاگرام (Make)</span>
                <span className={`badge badge--${pipelineTestResult.results?.instagram?.status === "success" ? "success" : pipelineTestResult.results?.instagram?.status === "skipped" ? "neutral" : "error"}`}>
                  {pipelineTestResult.results?.instagram?.status === "success" ? "ارسال شد" : pipelineTestResult.results?.instagram?.status === "skipped" ? "رد شد (عدم تنظیم)" : "خطا"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-text-2)", margin: 0 }}>
                {pipelineTestResult.results?.instagram?.status === "success" ? (
                  "رویداد همراه با عکس ۱۰۸۰×۱۰۸۰ به وب‌هوک Make فرستاده شد."
                ) : (
                  pipelineTestResult.results?.instagram?.error || "وضعیت نامشخص"
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* پیام موفقیت یا خطا در ذخیره */}
      {saveSuccess && (
        <div className="alert alert--success animate-fade-in" style={{ marginBottom: "var(--space-6)" }}>
          <IconBox name="check" tone="success" size={16} />
          <div style={{ flex: 1 }}>
            <strong>تنظیمات با موفقیت ذخیره شد!</strong>
            <p style={{ margin: "2px 0 0", fontSize: "13px", opacity: 0.9 }}>
              پایپ‌لاین از این پس طبق ساعات مشخص‌شده و با لحن انتخابی «{currentToneInfo.name}» اقدام به بازنویسی و انتشار می‌کند.
            </p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="alert alert--error animate-fade-in" style={{ marginBottom: "var(--space-6)" }}>
          <IconBox name="alert" tone="accent" size={16} />
          <div>{saveError}</div>
        </div>
      )}

      {/* بنر وضعیت سهمیه و اعتبار هوش مصنوعی */}
      <div
        className="card"
        style={{
          marginBottom: "var(--space-6)",
          borderColor:
            aiStatus?.status === "quota_exceeded"
              ? "rgba(239, 68, 68, 0.4)"
              : "var(--color-border-1)",
          background:
            aiStatus?.status === "quota_exceeded"
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, var(--color-surface-1) 100%)"
              : "var(--color-surface-1)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <IconBox
              name={aiStatus?.status === "quota_exceeded" ? "alert" : "sparkle"}
              tone={aiStatus?.status === "quota_exceeded" ? "accent" : "primary"}
              size={20}
            />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ fontWeight: 700, fontSize: "15px" }}>
                  وضعیت توکن و اعتبار هوش مصنوعی (NVIDIA AI)
                </span>
                {aiStatus?.status === "quota_exceeded" ? (
                  <span className="badge badge--error">اتمام سهمیه / توکن</span>
                ) : aiStatus?.status === "active" ? (
                  <span className="badge badge--success">فعال و دارای اعتبار</span>
                ) : (
                  <span className="badge badge--neutral">آماده به کار</span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--color-text-2)" }}>
                {aiStatus?.message || "در حال ارزیابی وضعیت اتصال..."}
                {aiStatus?.latencyMs && ` · تاخیر پاسخ: ${aiStatus.latencyMs} میلی‌ثانیه`}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <button
              onClick={() => fetchAiStatus(true)}
              disabled={isCheckingAi}
              className="btn btn--outline"
              style={{ fontSize: "12px", padding: "6px 14px" }}
              title="تست پینگ به API هوش مصنوعی برای سنجش اعتبار"
            >
              <Icon name="refresh" size={13} />
              <span>{isCheckingAi ? "در حال تست..." : "بررسی و تست آنلاین سهمیه"}</span>
            </button>
          </div>
        </div>

        {/* فیلد اختصاصی وارد کردن کلید API هوش مصنوعی */}
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-2)",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-1)" }}>
                🔑 کلید اختصاصی API هوش مصنوعی (اختیاری):
              </span>
              {settings.ai_settings.custom_api_key?.trim() ? (
                <span className="badge badge--primary">استفاده از کلید اختصاصی پنل</span>
              ) : aiStatus?.keySource === "server" ? (
                <span className="badge badge--success">استفاده از کلید پیش‌فرض سرور (بک‌اند)</span>
              ) : (
                <span className="badge badge--neutral">بدون کلید فعال</span>
              )}
            </div>

            {settings.ai_settings.custom_api_key?.trim() && (
              <button
                type="button"
                onClick={() => updateCustomApiKey("")}
                className="btn btn--outline"
                style={{ fontSize: "11px", padding: "2px 8px", height: "auto" }}
                title="حذف کلید اختصاصی و بازگشت به کلید پیش‌فرض بک‌اند"
              >
                بازنشانی به کلید پیش‌فرض سرور
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                type={showApiKey ? "text" : "password"}
                dir="ltr"
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (یا کلید جدید خود را وارد کنید)"
                value={settings.ai_settings.custom_api_key || ""}
                onChange={(e) => updateCustomApiKey(e.target.value)}
                className="input"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  paddingLeft: "70px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  color: "var(--color-text-2)",
                  padding: "2px 6px",
                }}
              >
                {showApiKey ? "مخفی" : "نمایش"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchAiStatus(true, settings.ai_settings.custom_api_key)}
              disabled={isCheckingAi}
              className="btn btn--outline"
              style={{ fontSize: "12px", padding: "8px 14px", whiteSpace: "nowrap" }}
              title="تست مستقیم این کلید"
            >
              {isCheckingAi ? "در حال تست..." : "تست این کلید"}
            </button>
          </div>

          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--color-text-2)", lineHeight: 1.5 }}>
            💡 به صورت پیش‌فرض سیستم از کلید سرور (NVIDIA_API_KEY در بک‌اند) استفاده می‌کند. اگر کلید جدیدی دارید یا می‌خواهید سهمیه جدیدی ست کنید، آن را در این کادر قرار داده و دکمه «ذخیره تنظیمات» را بزنید. در صورتی که این کادر خالی باشد، کلید سرور به عنوان پیش‌فرض فعال است.
          </p>
        </div>

        {/* پیام ویژه در صورت اتمام سهمیه */}
        {aiStatus?.status === "quota_exceeded" && (
          <div
            style={{
              marginTop: "var(--space-4)",
              padding: "var(--space-4)",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              fontSize: "13px",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, color: "#f87171", marginBottom: "4px" }}>
              ⚠️ توجه: سهمیه API هوش مصنوعی به پایان رسیده است!
            </div>
            <div>
              اعتبار اکانت شما در سرویس هوش مصنوعی تمام شده و فرآیند بازنویسی خبرهای جدید متوقف شده است.
              <ul style={{ margin: "6px 0 0", paddingRight: "18px" }}>
                <li>صبر کنید تا سهمیه دوره جدید شما در سایت ارائه‌دهنده (NVIDIA / OpenRouter) ریست و شارژ شود.</li>
                <li>یا کلید جدید را در متغیر محیطی <code>NVIDIA_API_KEY</code> در تنظیمات Netlify قرار دهید.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* بخش اول: زمان‌بندی انتشار پلتفرم‌ها */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div className="section-head">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <IconBox name="clock" tone="primary" size={18} />
            <h2 className="section-head__title">۱. تنظیمات زمان‌بندی انتشار در پلتفرم‌ها</h2>
          </div>
          <span className="section-head__meta">سایت · تلگرام · اینستاگرام</span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--color-text-2)", marginTop: "-12px", marginBottom: "var(--space-4)" }}>
          نحوه انتشار هر پلتفرم را مشخص کنید. می‌توانید تعیین کنید به محض انتشار در باما فوری منتشر شود یا در ساعت مشخصی از روز.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
          {platforms.map((p) => {
            const config = settings.publish_schedule[p.key];

            return (
              <div
                key={p.key}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                  borderColor: config.enabled ? "var(--color-border-1)" : "var(--color-border-2)",
                  opacity: config.enabled ? 1 : 0.65,
                  transition: "all 0.2s ease",
                }}
              >
                {/* سربرگ کارت پلتفرم */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <IconBox name={p.icon} tone={p.tone} size={22} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "15px" }}>{p.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-2)" }}>{p.subtitle}</div>
                    </div>
                  </div>

                  {/* سوئیچ فعال/غیرفعال */}
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      cursor: "pointer",
                      fontSize: "12px",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updatePlatformConfig(p.key, { enabled: e.target.checked })}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                    <span style={{ fontWeight: 600 }}>{config.enabled ? "فعال" : "غیرفعال"}</span>
                  </label>
                </div>

                <hr style={{ border: 0, borderTop: "1px solid var(--color-border-2)", margin: 0 }} />

                {/* گزینه‌های رادیویی نحوه انتشار */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-1)" }}>
                    حالت انتشار:
                  </div>

                  {/* گزینه ۱: به محض انتشار در باما (فوری) */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid",
                      borderColor:
                        config.mode === "instant"
                          ? "var(--color-primary)"
                          : "var(--color-border-2)",
                      background:
                        config.mode === "instant"
                          ? "var(--color-surface-2)"
                          : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name={`mode-${p.key}`}
                      value="instant"
                      checked={config.mode === "instant"}
                      onChange={() => updatePlatformConfig(p.key, { mode: "instant" })}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>⚡ به محض انتشار در باما (آنی)</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-2)", marginTop: "2px" }}>
                        بلافاصله پس از دریافت خبر از باما و بازنویسی با هوش مصنوعی، منتشر شود.
                      </div>
                    </div>
                  </label>

                  {/* گزینه ۲: زمان‌بندی روزانه در ساعت مشخص */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid",
                      borderColor:
                        config.mode === "scheduled"
                          ? "var(--color-primary)"
                          : "var(--color-border-2)",
                      background:
                        config.mode === "scheduled"
                          ? "var(--color-surface-2)"
                          : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name={`mode-${p.key}`}
                      value="scheduled"
                      checked={config.mode === "scheduled"}
                      onChange={() => updatePlatformConfig(p.key, { mode: "scheduled" })}
                      style={{ marginTop: "3px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>⏰ زمان‌بندی روزانه (ساعت مشخص)</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-2)", marginTop: "2px" }}>
                        خبرها ذخیره و در ساعت مشخصی از روز به‌صورت خودکار ارسال شوند.
                      </div>

                      {/* فیلد ساعت اگر scheduled انتخاب شده باشد */}
                      {config.mode === "scheduled" && (
                        <div style={{ marginTop: "var(--space-3)" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span style={{ fontSize: "12px", color: "var(--color-text-2)" }}>ساعت انتشار:</span>
                            <input
                              type="time"
                              value={config.time || "10:00"}
                              onChange={(e) => updatePlatformConfig(p.key, { time: e.target.value })}
                              className="input"
                              style={{ width: "110px", padding: "4px 8px", fontSize: "13px", textAlign: "center" }}
                            />
                          </div>

                          {/* ساعت‌های پیشنهادی سریع */}
                          <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "var(--color-text-3)", alignSelf: "center" }}>پیشنهادی:</span>
                            {p.suggestedTimes.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => updatePlatformConfig(p.key, { time: t })}
                                className="btn btn--outline"
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  height: "auto",
                                  background: config.time === t ? "var(--color-primary)" : "transparent",
                                  color: config.time === t ? "#fff" : "inherit",
                                }}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* بخش اختصاصی تنظیمات پیشرفته اینستاگرام و Make */}
                {p.key === "instagram" && (
                  <div
                    style={{
                      marginTop: "var(--space-2)",
                      padding: "var(--space-3)",
                      background: "var(--color-surface-2)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border-2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-3)",
                    }}
                  >
                    {/* آدرس وب‌هوک Make */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-1)" }}>
                          🔗 آدرس وب‌هوک Make.com (Instagram):
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--color-primary)" }}>بدون کدنویسی</span>
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <input
                          type="url"
                          dir="ltr"
                          placeholder="https://hook.eu1.make.com/xxxxxxxxxxxxxxxx"
                          value={config.webhook_url || ""}
                          onChange={(e) => updatePlatformConfig("instagram", { webhook_url: e.target.value })}
                          className="input"
                          style={{ flex: 1, padding: "6px 10px", fontSize: "12px", fontFamily: "monospace" }}
                        />
                        <button
                          type="button"
                          onClick={() => testMakeWebhook()}
                          disabled={testingMakeWebhook || !config.webhook_url}
                          className="btn btn--outline"
                          style={{ fontSize: "11px", padding: "6px 12px", whiteSpace: "nowrap" }}
                        >
                          {testingMakeWebhook ? "در حال ارسال..." : "تست وب‌هوک"}
                        </button>
                      </div>

                      {makeTestResult && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "11px",
                            padding: "6px 10px",
                            borderRadius: "var(--radius-sm)",
                            background: makeTestResult.success ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                            color: makeTestResult.success ? "#22c55e" : "#ef4444",
                            border: `1px solid ${makeTestResult.success ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                          }}
                        >
                          {makeTestResult.message}
                        </div>
                      )}
                    </div>

                    {/* ابعاد تصویر برای اینستاگرام */}
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "var(--color-text-1)" }}>
                        📐 سایز عکس اختصاصی اینستاگرام:
                      </div>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <label
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            padding: "6px 8px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid",
                            borderColor: config.aspect_ratio !== "portrait" ? "var(--color-primary)" : "var(--color-border-2)",
                            background: config.aspect_ratio !== "portrait" ? "var(--color-surface-3)" : "transparent",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <input
                            type="radio"
                            name="ig-ratio"
                            checked={config.aspect_ratio !== "portrait"}
                            onChange={() => updatePlatformConfig("instagram", { aspect_ratio: "square" })}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>مربع ۱:۱ (۱۰۸۰×۱۰۸۰)</div>
                            <div style={{ fontSize: "10px", color: "var(--color-text-2)" }}>استاندارد فید و گرید پیج</div>
                          </div>
                        </label>

                        <label
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            padding: "6px 8px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid",
                            borderColor: config.aspect_ratio === "portrait" ? "var(--color-primary)" : "var(--color-border-2)",
                            background: config.aspect_ratio === "portrait" ? "var(--color-surface-3)" : "transparent",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <input
                            type="radio"
                            name="ig-ratio"
                            checked={config.aspect_ratio === "portrait"}
                            onChange={() => updatePlatformConfig("instagram", { aspect_ratio: "portrait" })}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>عمودی ۴:۵ (۱۰۸۰×۱۳۵۰)</div>
                            <div style={{ fontSize: "10px", color: "var(--color-text-2)" }}>پوشش تمام‌صفحه اکسپلور</div>
                          </div>
                        </label>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-2)", marginTop: "6px", lineHeight: 1.4 }}>
                        ✓ سیستم قبل از انتشار، عکس خودرو را به ابعاد انتخابی با حاشیه بلور شکیل و باکیفیت تبدیل کرده و در فضای ذخیره‌سازی ابری با لینک مستقیم HTTPS آپلود می‌کند.
                      </div>
                    </div>

                    {/* مشخصات کپشن استاندارد */}
                    <div
                      style={{
                        padding: "8px",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px dashed var(--color-border-2)",
                        fontSize: "11px",
                        color: "var(--color-text-2)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--color-text-1)" }}>📝 مشخصات کپشن اینستاگرام:</span>
                      <div style={{ marginTop: "2px" }}>
                        متن کوتاه (۴۰ تا ۶۰ کلمه) · هوک جذاب با ایموجی · ۲ نکته کلیدی خودرو · دعوت به تعامل و کامنت · ۳ تا ۵ هشتگ پربازدید خودرویی.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* بخش دوم: تنظیمات سبک و لحن ادبی هوش مصنوعی */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div className="section-head">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <IconBox name="sparkle" tone="primary" size={18} />
            <h2 className="section-head__title">۲. لحن و سبک ادبی بازنویسی هوش مصنوعی</h2>
          </div>
          <span className="section-head__meta">{currentToneInfo.name}</span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--color-text-2)", marginTop: "-12px", marginBottom: "var(--space-4)" }}>
          هوش مصنوعی اخبار خام خودرو را طبق سبک انتخابی زیر بازنویسی خواهد کرد:
        </p>

        {/* ۴ سبک لحن انتخابی */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-3)" }}>
          {(Object.keys(AI_TONES) as AITone[]).map((tKey) => {
            const tone = AI_TONES[tKey];
            const isSelected = settings.ai_settings.tone === tKey;

            return (
              <div
                key={tKey}
                onClick={() => updateTone(tKey)}
                className="card"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  borderColor: isSelected ? "var(--color-primary)" : "var(--color-border-2)",
                  background: isSelected ? "var(--color-surface-2)" : "var(--color-surface-1)",
                  boxShadow: isSelected ? "0 0 0 1px var(--color-primary)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: "18px" }}>
                      {tKey === "formal" && "👔"}
                      {tKey === "exciting" && "🔥"}
                      {tKey === "technical" && "🏎️"}
                      {tKey === "concise" && "✍️"}
                    </span>
                    <strong style={{ fontSize: "14px" }}>{tone.name}</strong>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: "11px",
                      background: isSelected ? "rgba(99, 102, 241, 0.2)" : "var(--color-surface-3)",
                      color: isSelected ? "var(--color-primary)" : "var(--color-text-2)",
                    }}
                  >
                    {tone.badge}
                  </span>
                </div>

                <p style={{ fontSize: "12px", color: "var(--color-text-2)", margin: 0, lineHeight: 1.5 }}>
                  {tone.description}
                </p>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "var(--space-2)",
                    borderTop: "1px dashed var(--color-border-2)",
                    fontSize: "11px",
                    color: "var(--color-text-3)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>نمونه تیتر: </span>
                  {tone.sampleHeadline}
                </div>
              </div>
            );
          })}
        </div>

        {/* بازشونده بررسی پرامپت ارسالی به هوش مصنوعی */}
        <div style={{ marginTop: "var(--space-4)" }}>
          <button
            type="button"
            onClick={() => setShowPromptInspector(!showPromptInspector)}
            className="btn btn--outline"
            style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
          >
            <Icon name="search" size={13} />
            <span>{showPromptInspector ? "بستن پرامپت هوش مصنوعی" : "مشاهده دقیق پرامپت ارسالی به هوش مصنوعی (شفافیت)"}</span>
          </button>

          {showPromptInspector && (
            <div
              className="card animate-fade-in"
              style={{
                marginTop: "var(--space-3)",
                background: "var(--color-surface-2)",
                fontFamily: "monospace",
                fontSize: "12px",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                color: "var(--color-text-1)",
                direction: "rtl",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--color-primary)", marginBottom: "var(--space-2)" }}>
                // System Prompt (دستور سیستمی):
              </div>
              <div style={{ padding: "8px", background: "var(--color-surface-1)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-3)" }}>
                {`تو یک ویراستار ارشد و کارشناس تولید محتوای تخصصی خودرو به زبان فارسی برای رسانه AutoPulse هستی.
سبک و لحن نگارش انتخابی: «${currentToneInfo.name}».
دستورالعمل لحن: ${currentToneInfo.instruction}
قوانین مهم:
۱. فقط بر اساس اطلاعات داده‌شده در متن منبع کار کن؛ هرگز عدد، نام، مشخصات یا ادعای غیرواقعی ایجاد نکن.
۲. پاسخ را «همیشه و صرفاً» به‌صورت یک شیء JSON استاندارد با ۳ کلید (rewritten_text, tg_caption, ig_caption) برگردان بدون هیچ توضیح اضافه‌ای.`}
              </div>

              <div style={{ fontWeight: 700, color: "var(--color-accent)", marginBottom: "var(--space-2)" }}>
                // User Prompt Template (قالب درخواست خبر):
              </div>
              <div style={{ padding: "8px", background: "var(--color-surface-1)", borderRadius: "var(--radius-sm)" }}>
                {`عنوان خبر: [عنوان خبر دریافتی از باما]
متن/خلاصهٔ منبع: [متن کامل گزارش یا خلاصه منبع]

وظیفه: با رعایت لحن «${currentToneInfo.name}»، این سه خروجی را به فارسی تولید کن:
1. "rewritten_text": یک پاراگراف خبری کامل، زنده و منسجم برای سایت، دقیقاً بین ۹۰۰ تا ۱۱۰۰ کاراکتر (۴ تا ۶ جمله کامل با زمینه، جزئیات مهم و نتیجه‌گیری).
2. "tg_caption": یک کپشن کوتاه و جذاب برای تلگرام (حداکثر ۲۲۰ کاراکتر)، با یک ایموجی مرتبط در ابتدا، مناسب فرمت Markdown.
3. "ig_caption": یک کپشن برای اینستاگرام (حداکثر ۳۲۰ کاراکتر)، با ۳ تا ۵ هشتگ مرتبط فارسی در انتها.

فقط و فقط یک شیء JSON معتبر با همین سه کلید برگردان.`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* دکمه ذخیره بزرگ پایین */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          background: "linear-gradient(135deg, var(--color-surface-2) 0%, var(--color-surface-1) 100%)",
          marginBottom: "var(--space-10)",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px" }}>آماده اعمال تنظیمات هستید؟</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-2)", marginTop: "2px" }}>
            با زدن دکمه زیر، تمام تنظیمات زمان‌بندی و سبک ادبی فوراً ذخیره شده و در اجراهای بعدی اعمال می‌شوند.
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`btn btn--primary ${isSaving ? "btn--loading" : ""}`}
          style={{ padding: "12px 28px", fontSize: "14px" }}
        >
          <Icon name="check" size={16} />
          <span>{isSaving ? "در حال ذخیره..." : "ذخیره نهایی تنظیمات"}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* بخش سوم: فهرست آخرین اخبار پردازش‌شده (اختیاری جهت بررسی) */}
      {/* ─────────────────────────────────────────────────────────── */}
      <div>
        <div className="section-head">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <IconBox name="chart" tone="primary" size={18} />
            <h2 className="section-head__title">۳. آخرین اخبار پردازش‌شده در سیستم</h2>
          </div>
          <span className="section-head__meta">{items.length} خبر اخیر</span>
        </div>

        <p style={{ fontSize: "13px", color: "var(--color-text-2)", marginTop: "-12px", marginBottom: "var(--space-4)" }}>
          خبرها به طور خودکار طبق قوانین فوق در پلتفرم‌ها منتشر می‌شوند. در صورت تمایل می‌توانید متن تولیدی AI هر خبر را قبل از انتشار مشاهده یا ویرایش نمایید.
        </p>

        {items.length === 0 ? (
          <div className="empty-state">
            <IconBox name="image" size={32} />
            <div className="empty-state__title">خبری در صف پردازش یافت نشد</div>
            <div className="empty-state__desc">
              پایپ‌لاین با شروع کار، خبرهای جدید را پایش کرده و بر اساس زمان‌بندی بالا آماده خواهد کرد.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {items.map((item) => {
              const isExpanded = expandedNewsId === item.id;

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    padding: "var(--space-4)",
                    borderColor: isExpanded ? "var(--color-primary)" : "var(--color-border-2)",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedNewsId(isExpanded ? null : item.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: 1 }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          style={{
                            width: "56px",
                            height: "56px",
                            objectFit: "cover",
                            borderRadius: "var(--radius-md)",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "56px",
                            height: "56px",
                            background: "var(--color-surface-2)",
                            borderRadius: "var(--radius-md)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Icon name="image" size={20} />
                        </div>
                      )}

                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px", lineHeight: 1.4 }}>
                          {item.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            marginTop: "4px",
                            fontSize: "12px",
                            color: "var(--color-text-2)",
                          }}
                        >
                          <span>سایت: {item.site_status === "success" ? "✅ منتشرشده" : "در انتظار"}</span>
                          <span>·</span>
                          <span>تلگرام: {item.tg_status === "success" ? "✅ منتشرشده" : "در انتظار"}</span>
                          <span>·</span>
                          <span>اینستاگرام: {item.ig_status === "success" ? "✅ منتشرشده" : "در انتظار"}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn--outline"
                      style={{ fontSize: "12px", padding: "4px 10px", height: "auto" }}
                    >
                      {isExpanded ? "بستن متن" : "مشاهده محتوا"}
                    </button>
                  </div>

                  {/* بخش بازشونده متن خبر برای ۳ پلتفرم */}
                  {isExpanded && (
                    <div
                      className="animate-fade-in"
                      style={{
                        marginTop: "var(--space-4)",
                        paddingTop: "var(--space-4)",
                        borderTop: "1px solid var(--color-border-2)",
                      }}
                    >
                      {/* تب‌های پلتفرم */}
                      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlatformTab("website")}
                          className={`btn ${selectedPlatformTab === "website" ? "btn--primary" : "btn--outline"}`}
                          style={{ fontSize: "12px", padding: "5px 12px" }}
                        >
                          متن سایت ({item.edited_website?.length || item.rewritten_text?.length || 0} کاراکتر)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPlatformTab("telegram")}
                          className={`btn ${selectedPlatformTab === "telegram" ? "btn--primary" : "btn--outline"}`}
                          style={{ fontSize: "12px", padding: "5px 12px" }}
                        >
                          کپشن تلگرام
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPlatformTab("instagram")}
                          className={`btn ${selectedPlatformTab === "instagram" ? "btn--primary" : "btn--outline"}`}
                          style={{ fontSize: "12px", padding: "5px 12px" }}
                        >
                          کپشن اینستاگرام
                        </button>
                      </div>

                      <div
                        style={{
                          padding: "var(--space-3)",
                          background: "var(--color-surface-2)",
                          borderRadius: "var(--radius-md)",
                          fontSize: "13px",
                          lineHeight: 1.8,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {selectedPlatformTab === "website" && (item.edited_website || item.rewritten_text || "هنوز متنی تولید نشده است.")}
                        {selectedPlatformTab === "telegram" && (item.edited_telegram || item.tg_caption || "کپشن تلگرام موجود نیست.")}
                        {selectedPlatformTab === "instagram" && (item.edited_instagram || item.ig_caption || "کپشن اینستاگرام موجود نیست.")}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
