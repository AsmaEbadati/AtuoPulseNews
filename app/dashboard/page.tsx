import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "داشبورد — وضعیت پایپ‌لاین",
  description: "لاگ اجراهای پایپ‌لاین AutoPulse AI و وضعیت انتشار اخبار",
};

// --- Mock pipeline run data (فاز اول) ---
const mockRuns = [
  {
    id: "run-1",
    started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45000).toISOString(),
    status: "success",
    articles_found: 10,
    articles_new: 3,
    articles_published: 3,
    error_message: null,
  },
  {
    id: "run-2",
    started_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 26 * 60 * 60 * 1000 + 62000).toISOString(),
    status: "partial",
    articles_found: 10,
    articles_new: 2,
    articles_published: 1,
    error_message: "خطا در ارسال به اینستاگرام: Rate limit",
  },
  {
    id: "run-3",
    started_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    finished_at: new Date(Date.now() - 50 * 60 * 60 * 1000 + 38000).toISOString(),
    status: "success",
    articles_found: 10,
    articles_new: 4,
    articles_published: 4,
    error_message: null,
  },
];

const mockStats = {
  totalArticles: 9,
  totalPublished: 8,
  telegram: 7,
  instagram: 5,
  website: 9,
  lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  nextRun: "فردا ساعت ۰۸:۰۰",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("fa-IR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return `${(ms / 1000).toFixed(0)}ث`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    success: { label: "✓ موفق", cls: "badge--success" },
    partial: { label: "⚠ ناقص", cls: "badge--warning" },
    failed:  { label: "✗ خطا", cls: "badge--error" },
    running: { label: "⏳ در حال اجرا", cls: "badge--pending" },
  };
  const s = map[status] ?? map.running;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export default function DashboardPage() {
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
            { icon: "📰", label: "کل اخبار", value: mockStats.totalArticles, color: "var(--color-primary)" },
            { icon: "🌐", label: "سایت", value: mockStats.website, color: "var(--color-success)" },
            { icon: "✈️", label: "تلگرام", value: mockStats.telegram, color: "var(--color-accent)" },
            { icon: "📸", label: "اینستاگرام", value: mockStats.instagram, color: "#E1306C" },
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
                <div
                  style={{
                    fontSize: "var(--text-2xl)",
                    fontWeight: 800,
                    color: stat.color,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-muted)",
                  }}
                >
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
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              marginBottom: "var(--space-5)",
              color: "var(--color-text)",
            }}
          >
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
              { label: "وضعیت", value: "فعال", ok: true },
              { label: "آخرین اجرا", value: formatDate(mockStats.lastRun), ok: true },
              { label: "اجرای بعدی", value: mockStats.nextRun, ok: true },
              { label: "تکرار خبر", value: "۰ مورد", ok: true },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "var(--color-bg-alt)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-muted)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: 600,
                    color: item.ok ? "var(--color-success)" : "var(--color-error)",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Manual Trigger */}
          <div
            style={{
              marginTop: "var(--space-5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
              برای تست می‌توانید پایپ‌لاین را دستی اجرا کنید
            </p>
            <button className="btn btn--primary">
              ▶ اجرای دستی پایپ‌لاین
            </button>
          </div>
        </div>

        {/* Execution Log Table */}
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
            <h2
              style={{
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              لاگ اجراها
            </h2>
            <span
              style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}
            >
              {mockRuns.length} اجرا
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>زمان شروع</th>
                  <th>مدت</th>
                  <th>یافت‌شده</th>
                  <th>جدید</th>
                  <th>منتشرشده</th>
                  <th>وضعیت</th>
                  <th>خطا</th>
                </tr>
              </thead>
              <tbody>
                {mockRuns.map((run) => (
                  <tr key={run.id}>
                    <td style={{ color: "var(--color-text)" }}>
                      {formatDate(run.started_at)}
                    </td>
                    <td>
                      {run.finished_at
                        ? getDuration(run.started_at, run.finished_at)
                        : "—"}
                    </td>
                    <td>{run.articles_found}</td>
                    <td style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                      {run.articles_new}
                    </td>
                    <td style={{ color: "var(--color-success)", fontWeight: 600 }}>
                      {run.articles_published}
                    </td>
                    <td>
                      <StatusBadge status={run.status} />
                    </td>
                    <td
                      style={{
                        color: "var(--color-error)",
                        fontSize: "var(--text-xs)",
                        maxWidth: "200px",
                      }}
                    >
                      {run.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Env Checklist */}
        <div
          style={{
            marginTop: "var(--space-8)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-6)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              marginBottom: "var(--space-5)",
              color: "var(--color-text)",
            }}
          >
            🔧 وضعیت تنظیمات
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "var(--space-3)",
            }}
          >
            {[
              { label: "GEMINI_API_KEY", configured: false },
              { label: "SUPABASE_URL", configured: false },
              { label: "TELEGRAM_BOT_TOKEN", configured: false },
              { label: "INSTAGRAM_ACCESS_TOKEN", configured: false },
              { label: "Netlify Deploy", configured: true },
              { label: "Cron Job", configured: true },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-3)",
                  background: item.configured
                    ? "var(--color-success-bg)"
                    : "var(--color-error-bg)",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${
                    item.configured
                      ? "rgba(16,185,129,0.2)"
                      : "rgba(239,68,68,0.2)"
                  }`,
                }}
              >
                <span>{item.configured ? "✓" : "✗"}</span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: item.configured
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
