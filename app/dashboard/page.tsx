import type { Metadata } from "next";
import { getPublicClient } from "@/lib/supabase-public";

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
  destination: string;
  status: string;
  post_url: string | null;
  error_message: string | null;
  attempts: number;
  updated_at: string;
}

async function getRuns(): Promise<RunRow[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("public_runs")
    .select(
      "started_at, finished_at, trigger, found_count, new_count, success_count, error_count, note"
    )
    .order("started_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("[dashboard] public_runs fetch failed:", error.message);
    return [];
  }
  return (data as RunRow[]) ?? [];
}

async function getStatuses(): Promise<StatusRow[]> {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("public_status")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[dashboard] public_status fetch failed:", error.message);
    return [];
  }
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

const DEST_LABEL: Record<string, string> = {
  site: "🌐 سایت",
  telegram: "✈️ تلگرام",
  instagram: "📸 اینستاگرام",
};

const PROC_LABEL: Record<string, string> = {
  new: "🆕 جدید",
  processing: "⏳ در حال پردازش",
  ready: "✅ آماده انتشار",
  error: "❌ خطا",
};
export default async function DashboardPage() {
  const [runs, statuses] = await Promise.all([getRuns(), getStatuses()]);
  const stats = computeStats(statuses);

  const lastRun = runs[0] ?? null;
  const lastRunNote = lastRun?.note;
  const hasError = lastRun ? (lastRun.error_count ?? 0) > 0 : false;

  return (
    <div className="section">
      <div className="container">
        {/* Page Header */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h1
            style={{
              fontSize: "var(--text-3xl)",
              fontWeight: 800,
              color: "var(--color-text)",
              marginBottom: "var(--space-2)",
            }}
          >
            📊 داشبورد پایپ‌لاین
          </h1>
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-sm)" }}>
            وضعیت لحظه‌ای سیستم، لاگ اجراها و آمار انتشار
          </p>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "var(--space-4)",
            marginBottom: "var(--space-8)",
          }}
        >
          {[
            { icon: "📰", label: "کل اخبار", value: stats.totalArticles, color: "var(--color-primary)" },
            { icon: "🌐", label: "سایت", value: stats.website, color: "var(--color-success)" },
            { icon: "✈️", label: "تلگرام", value: stats.telegram, color: "var(--color-accent)" },
            { icon: "📸", label: "اینستاگرام", value: stats.instagram, color: "#E1306C" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-5)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ fontSize: "1.75rem" }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: stat.color }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* System Status */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-6)",
            marginBottom: "var(--space-8)",
          }}
        >
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-5)", color: "var(--color-text)" }}>
            وضعیت سیستم
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {[
              { label: "وضعیت", value: hasError ? "خطا در آخرین اجرا" : lastRun ? "فعال" : "بدون اجرا", ok: !hasError && Boolean(lastRun) },
              { label: "آخرین اجرا", value: lastRun ? formatDate(lastRun.started_at) : "—", ok: Boolean(lastRun) },
              { label: "یافت‌شده / جدید (آخرین)", value: lastRun ? `${lastRun.found_count} / ${lastRun.new_count}` : "—", ok: true },
              { label: "خطاهای آخرین اجرا", value: lastRun ? String(lastRun.error_count) : "—", ok: !hasError },
            ].map((item) => (
              <div
                key={item.label}
                style={{ background: "var(--color-bg-alt)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}
              >
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginBottom: "var(--space-1)" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: item.ok ? "var(--color-success)" : "var(--color-error)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {lastRunNote && (
            <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-error)" }}>
              یادداشت آخرین اجرا: {lastRunNote}
            </p>
          )}
        </div>

        {/* Execution Log Table */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            marginBottom: "var(--space-8)",
          }}
        >
          <div
            style={{
              padding: "var(--space-5) var(--space-6)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-text)" }}>
              لاگ اجراها
            </h2>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
              {runs.length} اجرا
            </span>
          </div>

          {runs.length === 0 ? (
            <div style={{ padding: "var(--space-6)", color: "var(--color-muted)" }}>
              هنوز هیچ اجرایی ثبت نشده است.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="dashboard-table">
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
                      <td style={{ color: "var(--color-text)" }}>{formatDate(run.started_at)}</td>
                      <td>{run.trigger === "cron" ? "⏰ cron" : "👆 دستی"}</td>
                      <td>{getDuration(run.started_at, run.finished_at)}</td>
                      <td>{run.found_count}</td>
                      <td style={{ color: "var(--color-primary)", fontWeight: 600 }}>{run.new_count}</td>
                      <td style={{ color: "var(--color-success)", fontWeight: 600 }}>{run.success_count}</td>
                      <td style={{ color: run.error_count > 0 ? "var(--color-error)" : "var(--color-muted)", fontWeight: 600 }}>
                        {run.error_count}
                      </td>
                      <td style={{ color: "var(--color-error)", fontSize: "var(--text-xs)", maxWidth: "200px" }}>
                        {run.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Publications Status Table */}
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "var(--space-5) var(--space-6)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--color-text)" }}>
              وضعیت انتشار اخبار
            </h2>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
              {statuses.length} ردیف
            </span>
          </div>

          {statuses.length === 0 ? (
            <div style={{ padding: "var(--space-6)", color: "var(--color-muted)" }}>
              هنوز خبری پردازش نشده است.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>خبر</th>
                    <th>پردازش</th>
                    <th>مقصد</th>
                    <th>وضعیت</th>
                    <th>تلاش</th>
                    <th>خطا</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((s, idx) => (
                    <tr key={`${s.slug}-${s.destination}-${idx}`}>
                      <td style={{ color: "var(--color-text)", maxWidth: "240px" }}>{s.title}</td>
                      <td>{PROC_LABEL[s.process_status] ?? s.process_status}</td>
                      <td>{DEST_LABEL[s.destination] ?? s.destination}</td>
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
                          {s.status === "success" ? "✓ موفق" : s.status === "error" ? "✗ خطا" : "○ منتظر"}
                        </span>
                      </td>
                      <td>{s.attempts}</td>
                      <td style={{ color: "var(--color-error)", fontSize: "var(--text-xs)", maxWidth: "200px" }}>
                        {s.error_message ?? "—"}
                      </td>
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

