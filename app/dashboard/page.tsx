import type { Metadata } from "next";
import { getPublicClient } from "@/lib/supabase-public";
import { Icon, IconBox, type IconName } from "../components/Icons";

export const metadata: Metadata = {
  title: "داشبورد — وضعیت پایپ‌لاین",
  description: "لاگ اجراهای پایپ‌لاین AutoPulse AI و وضعیت انتشار اخبار",
};

interface RunRow {
  started_at: string;
  finished_at: string | null;
  trigger: string;
  found_count: number;
  new_count: number;
  success_count: number;
  error_count: number;
  note: string | null;
}

interface StatusRow {
  slug: string;
  title: string;
  process_status: string;
  created_at: string;
  updated_at: string;
  destination: string;
  status: string;
  post_url: string | null;
  error_message: string | null;
  attempts: number;
}

async function getRuns(): Promise<RunRow[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data } = await db
    .from("public_runs")
    .select(
      "started_at, finished_at, trigger, found_count, new_count, success_count, error_count, note"
    )
    .order("started_at", { ascending: false })
    .limit(30);
  return (data as RunRow[]) ?? [];
}

async function getStatuses(): Promise<StatusRow[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data } = await db
    .from("public_status")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as StatusRow[]) ?? [];
}

function computeStats(statuses: StatusRow[]) {
  const success = (d: string) =>
    statuses.filter((s) => s.destination === d && s.status === "success").length;
  const uniqueArticles = new Set(statuses.map((s) => s.slug)).size;
  return {
    totalArticles: uniqueArticles,
    website: success("site"),
    telegram: success("telegram"),
    instagram: success("instagram"),
  };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("fa-IR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDuration(start: string, end: string | null) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return `${(ms / 1000).toFixed(0)}ث`;
}

export default async function DashboardPage() {
  const [runs, statuses] = await Promise.all([getRuns(), getStatuses()]);
  const stats = computeStats(statuses);
  const lastRun = runs[0] ?? null;
  const hasError = lastRun ? (lastRun.error_count ?? 0) > 0 : false;

  const statCards: { icon: IconName; tone: "primary" | "success" | "accent" | "neutral"; label: string; value: number }[] = [
    { icon: "chart", tone: "primary", label: "کل اخبار", value: stats.totalArticles },
    { icon: "grid", tone: "success", label: "سایت", value: stats.website },
    { icon: "telegram", tone: "accent", label: "تلگرام", value: stats.telegram },
    { icon: "instagram", tone: "neutral", label: "اینستاگرام", value: stats.instagram },
  ];

  // جمع وضعیت‌ها برای گزارش انتشار
  const siteSuccesses   = statuses.filter(s => s.destination === "site"      && s.status === "success");
  const tgSuccesses     = statuses.filter(s => s.destination === "telegram"  && s.status === "success");
  const igSuccesses     = statuses.filter(s => s.destination === "instagram" && s.status === "success");
  const siteErrors      = statuses.filter(s => s.destination === "site"      && s.status === "error");
  const tgErrors        = statuses.filter(s => s.destination === "telegram"  && s.status === "error");
  const igErrors        = statuses.filter(s => s.destination === "instagram" && s.status === "error");
  const lastSite        = siteSuccesses[0];
  const lastTg          = tgSuccesses[0];
  const lastIg          = igSuccesses[0];

  const systemItems = [
    { label: "وضعیت", value: hasError ? "خطا در آخرین اجرا" : lastRun ? "فعال" : "بدون اجرا", ok: !hasError && Boolean(lastRun) },
    { label: "آخرین اجرا", value: lastRun ? formatDate(lastRun.started_at) : "—", ok: Boolean(lastRun) },
    { label: "یافت‌شده / جدید", value: lastRun ? `${lastRun.found_count} / ${lastRun.new_count}` : "—", ok: true },
    { label: "خطاهای آخرین اجرا", value: lastRun ? String(lastRun.error_count) : "—", ok: !hasError },
  ];

  return (
    <div className="section">
      <div className="container">
        {/* Page Header */}
        <div className="dash-head">
          <div className="dash-head__row">
            <IconBox name="grid" tone="primary" size={26} />
            <div>
              <h1 className="dash-head__title">داشبورد پایپ‌لاین</h1>
              <p className="dash-head__sub">وضعیت لحظه‌ای سیستم، لاگ اجراها و آمار انتشار</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stat-grid stat-grid--4">
          {statCards.map((s) => (
            <div key={s.label} className="stat-card">
              <IconBox name={s.icon} tone={s.tone} size={20} />
              <div>
                <div className="stat-card__value">{s.value}</div>
                <div className="stat-card__label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Publish Report — 3 Platforms */}
        <div className="pub-report-grid">
          {/* Site */}
          <div className="pub-report-card">
            <div className="pub-report-card__head">
              <div className="pub-report-card__title">
                <IconBox name="grid" tone="success" size={18} />
                سایت
              </div>
              <span className="badge badge--error">{siteErrors.length} خطا</span>
            </div>
            <div className="pub-report-card__count pub-report-card__count--success">{siteSuccesses.length}</div>
            <div className="pub-report-card__meta">آخرین انتشار: {lastSite ? formatDate(lastSite.updated_at) : "—"}</div>
            {lastSite?.post_url && (
              <a href={lastSite.post_url} target="_blank" rel="noopener noreferrer" className="pub-report-card__link">
                <Icon name="external" size={11} />
                مشاهده آخرین پست
              </a>
            )}
          </div>
          {/* Telegram */}
          <div className="pub-report-card">
            <div className="pub-report-card__head">
              <div className="pub-report-card__title">
                <IconBox name="telegram" tone="primary" size={18} />
                تلگرام
              </div>
              <span className="badge badge--error">{tgErrors.length} خطا</span>
            </div>
            <div className="pub-report-card__count pub-report-card__count--primary">{tgSuccesses.length}</div>
            <div className="pub-report-card__meta">آخرین انتشار: {lastTg ? formatDate(lastTg.updated_at) : "—"}</div>
            {lastTg?.post_url && (
              <a href={lastTg.post_url} target="_blank" rel="noopener noreferrer" className="pub-report-card__link">
                <Icon name="external" size={11} />
                مشاهده آخرین پست
              </a>
            )}
          </div>
          {/* Instagram */}
          <div className="pub-report-card">
            <div className="pub-report-card__head">
              <div className="pub-report-card__title">
                <IconBox name="instagram" tone="accent" size={18} />
                اینستاگرام
              </div>
              <span className="badge badge--error">{igErrors.length} خطا</span>
            </div>
            <div className="pub-report-card__count pub-report-card__count--success">{igSuccesses.length}</div>
            <div className="pub-report-card__meta">آخرین انتشار: {lastIg ? formatDate(lastIg.updated_at) : "—"}</div>
            {lastIg?.post_url && (
              <a href={lastIg.post_url} target="_blank" rel="noopener noreferrer" className="pub-report-card__link">
                <Icon name="external" size={11} />
                مشاهده آخرین پست
              </a>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="panel">
          <div className="panel__head">
            <div className="panel__head-title">
              <IconBox name="check" tone={hasError ? "danger" : "success"} size={18} />
              <h2>وضعیت سیستم</h2>
            </div>
          </div>
          <div className="panel__body">
            <div className="sys-grid">
              {systemItems.map((item) => (
                <div key={item.label} className="sys-item">
                  <div className="sys-item__label">{item.label}</div>
                  <div className={`sys-item__value ${item.ok ? "is-ok" : "is-err"}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {lastRun?.note && (
              <p className="sys-note">
                <Icon name="alert" size={14} />
                یادداشت آخرین اجرا: {lastRun.note}
              </p>
            )}
          </div>
        </div>


        {/* Execution Log Table */}
        <div className="panel">
          <div className="panel__head">
            <div className="panel__head-title">
              <IconBox name="clock" tone="primary" size={18} />
              <h2>لاگ اجراها</h2>
            </div>
            <span className="panel__head-meta">{runs.length} اجرا</span>
          </div>
          {runs.length === 0 ? (
            <div className="panel__empty">هنوز هیچ اجرایی ثبت نشده است.</div>
          ) : (
            <div className="panel__scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>زمان شروع</th>
                    <th>نوع</th>
                    <th>مدت</th>
                    <th>یافت‌شده</th>
                    <th>جدید</th>
                    <th>موفق</th>
                    <th>خطا</th>
                    <th>یادداشت</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.started_at}>
                      <td>{formatDate(run.started_at)}</td>
                      <td>
                        <span className="badge badge--pending">
                          <Icon name={run.trigger === "cron" ? "clock" : "sparkle"} size={11} />
                          {run.trigger === "cron" ? "cron" : "دستی"}
                        </span>
                      </td>
                      <td>{getDuration(run.started_at, run.finished_at)}</td>
                      <td>{run.found_count}</td>
                      <td>{run.new_count}</td>
                      <td className="is-ok">{run.success_count}</td>
                      <td className={run.error_count > 0 ? "is-err" : ""}>{run.error_count}</td>
                      <td className="cell-note">{run.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {/* Publications Status Table */}
        <div className="panel">
          <div className="panel__head">
            <div className="panel__head-title">
              <IconBox name="external" tone="primary" size={18} />
              <h2>وضعیت انتشار اخبار</h2>
            </div>
            <span className="panel__head-meta">{statuses.length} ردیف</span>
          </div>
          {statuses.length === 0 ? (
            <div className="panel__empty">هنوز خبری پردازش نشده است.</div>
          ) : (
            <div className="panel__scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>خبر</th>
                    <th>مقصد</th>
                    <th>وضعیت</th>
                    <th>تلاش</th>
                    <th>لینک</th>
                    <th>خطا</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((s, idx) => (
                    <tr key={`${s.slug}-${s.destination}-${idx}`}>
                      <td className="cell-title">{s.title}</td>
                      <td>
                        <span className="badge badge--pending">
                          <Icon
                            name={
                              s.destination === "site"
                                ? "grid"
                                : s.destination === "telegram"
                                ? "telegram"
                                : "instagram"
                            }
                            size={11}
                          />
                          {s.destination === "site" ? "سایت" : s.destination === "telegram" ? "تلگرام" : "اینستاگرام"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            s.status === "success"
                              ? "badge--success"
                              : s.status === "error"
                              ? "badge--error"
                              : "badge--pending"
                          }`}
                        >
                          {s.status === "success" ? "موفق" : s.status === "error" ? "خطا" : "منتظر"}
                        </span>
                      </td>
                      <td>{s.attempts}</td>
                      <td>
                        {s.post_url ? (
                          <a className="cell-link" href={s.post_url} target="_blank" rel="noopener noreferrer">
                            <Icon name="external" size={12} />
                            مشاهده
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="cell-note is-err">{s.error_message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

