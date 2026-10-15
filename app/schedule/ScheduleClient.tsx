"use client";

import { useState } from "react";
import { Icon, IconBox } from "../components/Icons";

interface PlatformSchedule {
  scheduled_at: string; // ISO local datetime string برای input
  enabled: boolean;     // آیا این پلتفرم باید منتشر بشه
}

interface ArticleScheduleState {
  edited_website: string;
  edited_telegram: string;
  edited_instagram: string;
  site: PlatformSchedule;
  telegram: PlatformSchedule;
  instagram: PlatformSchedule;
}

interface ScheduleItem {
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

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    // فرمت مورد نیاز input type="datetime-local": YYYY-MM-DDTHH:MM
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch {
    return "";
  }
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") {
    return (
      <span className="badge badge--pending">
        <Icon name="clock" size={10} />
        منتظر
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="badge badge--success">
        <Icon name="check" size={10} />
        منتشرشده
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="badge badge--error">
        <Icon name="alert" size={10} />
        خطا
      </span>
    );
  }
  return <span className="badge badge--pending">{status}</span>;
}

function ScheduleCard({
  item,
  onSaved,
}: {
  item: ScheduleItem;
  onSaved: (id: string) => void;
}) {
  const defaultDatetime = toLocalDatetime(new Date(Date.now() + 3600_000).toISOString());

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"site" | "telegram" | "instagram">("site");

  const [state, setState] = useState<ArticleScheduleState>({
    edited_website:   item.edited_website  ?? item.rewritten_text  ?? "",
    edited_telegram:  item.edited_telegram ?? item.tg_caption      ?? "",
    edited_instagram: item.edited_instagram ?? item.ig_caption     ?? "",
    site: {
      scheduled_at: item.site_scheduled ? toLocalDatetime(item.site_scheduled) : defaultDatetime,
      enabled: item.site_status !== "success",
    },
    telegram: {
      scheduled_at: item.tg_scheduled ? toLocalDatetime(item.tg_scheduled) : defaultDatetime,
      enabled: item.tg_status !== "success",
    },
    instagram: {
      scheduled_at: item.ig_scheduled ? toLocalDatetime(item.ig_scheduled) : defaultDatetime,
      enabled: item.ig_status !== "success",
    },
  });

  function updatePlatform(
    platform: "site" | "telegram" | "instagram",
    field: keyof PlatformSchedule,
    value: string | boolean
  ) {
    setState((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edited_website:   state.edited_website   || null,
          edited_telegram:  state.edited_telegram  || null,
          edited_instagram: state.edited_instagram || null,
          site_scheduled:      state.site.enabled      ? new Date(state.site.scheduled_at).toISOString()      : null,
          telegram_scheduled:  state.telegram.enabled  ? new Date(state.telegram.scheduled_at).toISOString()  : null,
          instagram_scheduled: state.instagram.enabled ? new Date(state.instagram.scheduled_at).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setSaved(true);
      onSaved(item.id);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const platforms: Array<{
    key: "site" | "telegram" | "instagram";
    label: string;
    icon: "grid" | "telegram" | "instagram";
    status: string | null;
    url: string | null;
    attempts: number | null;
    editKey: "edited_website" | "edited_telegram" | "edited_instagram";
    originalKey: "rewritten_text" | "tg_caption" | "ig_caption";
    charHint: string;
  }> = [
    {
      key: "site",
      label: "سایت",
      icon: "grid",
      status: item.site_status,
      url: item.site_url,
      attempts: item.site_attempts,
      editKey: "edited_website",
      originalKey: "rewritten_text",
      charHint: "۹۰۰–۱۱۰۰ کاراکتر",
    },
    {
      key: "telegram",
      label: "تلگرام",
      icon: "telegram",
      status: item.tg_status,
      url: item.tg_url,
      attempts: item.tg_attempts,
      editKey: "edited_telegram",
      originalKey: "tg_caption",
      charHint: "کپشن Markdown",
    },
    {
      key: "instagram",
      label: "اینستاگرام",
      icon: "instagram",
      status: item.ig_status,
      url: item.ig_url,
      attempts: item.ig_attempts,
      editKey: "edited_instagram",
      originalKey: "ig_caption",
      charHint: "کپشن + هشتگ",
    },
  ];

  const activePlatform = platforms.find((p) => p.key === activeTab)!;

  return (
    <div className={`sched-card ${expanded ? "sched-card--open" : ""}`}>
      {/* ─── Header ─── */}
      <div className="sched-card__head" onClick={() => setExpanded(!expanded)}>
        <div className="sched-card__img">
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} loading="lazy" />
          ) : (
            <div className="sched-card__img-placeholder">
              <Icon name="image" size={20} />
            </div>
          )}
        </div>

        <div className="sched-card__info">
          <div className="sched-card__meta">
            <span className="badge badge--primary">
              <Icon name="ai" size={10} />
              AI
            </span>
            <StatusBadge status={item.site_status} />
            <StatusBadge status={item.tg_status} />
            <StatusBadge status={item.ig_status} />
          </div>
          <h3 className="sched-card__title">{item.title}</h3>

          <div className="sched-card__platforms">
            {platforms.map((p) => (
              <span key={p.key} className={`sched-platform-chip ${p.status === "success" ? "sched-platform-chip--done" : ""}`}>
                <Icon name={p.icon} size={11} />
                {p.label}
                {p.status === "success" && p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="sched-platform-chip__link"
                  >
                    <Icon name="external" size={10} />
                  </a>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <button className="sched-card__toggle" aria-label={expanded ? "بستن" : "باز کردن"}>
          <Icon name={expanded ? "alert" : "sparkle"} size={14} />
          {expanded ? "بستن" : "ویرایش و زمانبندی"}
        </button>
      </div>

      {/* ─── Expanded Editor ─── */}
      {expanded && (
        <div className="sched-card__body">
          {/* Tab bar */}
          <div className="sched-tabs">
            {platforms.map((p) => (
              <button
                key={p.key}
                className={`sched-tab ${activeTab === p.key ? "sched-tab--active" : ""}`}
                onClick={() => setActiveTab(p.key)}
              >
                <Icon name={p.icon} size={13} />
                {p.label}
                {p.status === "success" && (
                  <span className="sched-tab__dot sched-tab__dot--success" />
                )}
              </button>
            ))}
          </div>

          {/* Editor area */}
          <div className="sched-editor">
            <div className="sched-editor__row">
              {/* Text editor */}
              <div className="sched-editor__col">
                <div className="sched-editor__label">
                  <Icon name="ai" size={12} />
                  متن محتوا ({activePlatform.charHint})
                  <span className="sched-editor__charcount">
                    {(state[activePlatform.editKey] || "").length} کاراکتر
                  </span>
                </div>
                <textarea
                  className="sched-textarea"
                  value={state[activePlatform.editKey] || ""}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      [activePlatform.editKey]: e.target.value,
                    }))
                  }
                  placeholder={`متن ${activePlatform.label} را وارد کنید...`}
                  rows={10}
                />
                {activePlatform.status === "success" && activePlatform.url && (
                  <a
                    href={activePlatform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sched-pub-link"
                  >
                    <Icon name="external" size={12} />
                    مشاهده پست منتشرشده در {activePlatform.label}
                  </a>
                )}
              </div>

              {/* Schedule panel */}
              <div className="sched-editor__side">
                <div className="sched-time-panel">
                  <div className="sched-time-panel__head">
                    <IconBox name={activePlatform.icon} tone="primary" size={16} />
                    <span>زمانبندی {activePlatform.label}</span>
                  </div>

                  {activePlatform.status === "success" ? (
                    <div className="sched-time-panel__done">
                      <Icon name="check" size={14} />
                      <span>منتشر شده</span>
                      {activePlatform.url && (
                        <a href={activePlatform.url} target="_blank" rel="noopener noreferrer">
                          <Icon name="external" size={11} />
                          مشاهده
                        </a>
                      )}
                    </div>
                  ) : (
                    <>
                      <label className="sched-time-panel__toggle">
                        <input
                          type="checkbox"
                          checked={state[activePlatform.key].enabled}
                          onChange={(e) =>
                            updatePlatform(activePlatform.key, "enabled", e.target.checked)
                          }
                        />
                        <span>فعال‌سازی انتشار در {activePlatform.label}</span>
                      </label>

                      {state[activePlatform.key].enabled && (
                        <div className="sched-time-panel__input-wrap">
                          <div className="sched-time-panel__label">
                            <Icon name="clock" size={12} />
                            زمان انتشار
                          </div>
                          <input
                            type="datetime-local"
                            className="sched-datetime-input"
                            value={state[activePlatform.key].scheduled_at}
                            onChange={(e) =>
                              updatePlatform(activePlatform.key, "scheduled_at", e.target.value)
                            }
                          />
                          {activePlatform.attempts != null && activePlatform.attempts > 0 && (
                            <div className="sched-attempts">
                              <Icon name="alert" size={11} />
                              {activePlatform.attempts} بار تلاش شده
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Quick status summary */}
                <div className="sched-status-summary">
                  {platforms.map((p) => (
                    <div key={p.key} className="sched-status-row">
                      <Icon name={p.icon} size={12} />
                      <span>{p.label}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="sched-editor__actions">
              {error && (
                <div className="sched-error">
                  <Icon name="alert" size={13} />
                  {error}
                </div>
              )}
              <button
                className={`btn btn--primary ${saving ? "btn--loading" : ""}`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="btn-spinner" />
                    در حال ذخیره...
                  </>
                ) : saved ? (
                  <>
                    <Icon name="check" size={14} />
                    ذخیره شد ✓
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" size={14} />
                    ذخیره زمانبندی و محتوا
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScheduleClient({
  items,
}: {
  items: ScheduleItem[];
}) {
  const [localItems, setLocalItems] = useState(items);

  function handleSaved(id: string) {
    // فقط نشانه می‌گذاریم، داده‌ها تغییر نمی‌کنن چون سمت سرور fetch هست
    setLocalItems((prev) => prev); // no-op، فقط برای future use
    void id;
  }

  const readyCount   = localItems.filter((i) => i.process_status === "ready").length;
  const publishedCount = localItems.filter((i) => i.site_status === "success").length;
  const pendingCount = localItems.filter(
    (i) => i.process_status === "ready" && i.site_status !== "success"
  ).length;

  return (
    <div className="section">
      <div className="container">
        {/* Header */}
        <div className="dash-head">
          <div className="dash-head__row">
            <IconBox name="clock" tone="primary" size={26} />
            <div>
              <h1 className="dash-head__title">کنترل انتشار</h1>
              <p className="dash-head__sub">
                زمانبندی انتشار در هر پلتفرم و ویرایش محتوای هوش مصنوعی
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid stat-grid--4">
          <div className="stat-card">
            <IconBox name="chart" tone="primary" size={20} />
            <div>
              <div className="stat-card__value">{localItems.length}</div>
              <div className="stat-card__label">کل اخبار</div>
            </div>
          </div>
          <div className="stat-card">
            <IconBox name="sparkle" tone="accent" size={20} />
            <div>
              <div className="stat-card__value">{readyCount}</div>
              <div className="stat-card__label">آماده انتشار</div>
            </div>
          </div>
          <div className="stat-card">
            <IconBox name="clock" tone="neutral" size={20} />
            <div>
              <div className="stat-card__value">{pendingCount}</div>
              <div className="stat-card__label">در انتظار</div>
            </div>
          </div>
          <div className="stat-card">
            <IconBox name="check" tone="success" size={20} />
            <div>
              <div className="stat-card__value">{publishedCount}</div>
              <div className="stat-card__label">منتشرشده</div>
            </div>
          </div>
        </div>

        {/* List */}
        {localItems.length === 0 ? (
          <div className="empty-state">
            <IconBox name="clock" size={40} />
            <div className="empty-state__title">هیچ خبری برای زمانبندی وجود ندارد</div>
            <div className="empty-state__desc">
              پس از پردازش اخبار با هوش مصنوعی، آن‌ها اینجا نمایش داده می‌شوند.
            </div>
          </div>
        ) : (
          <div className="sched-list">
            {localItems.map((item) => (
              <ScheduleCard key={item.id} item={item} onSaved={handleSaved} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
