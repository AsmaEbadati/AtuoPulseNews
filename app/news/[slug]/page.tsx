import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublicClient } from "@/lib/supabase-public";

type PageProps = {
  params: Promise<{ slug: string }>;
};

interface Article {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
}

// خواندن یک خبر منتشرشده از view عمومی public_news (فقط خواندن با anon key).
// این view فقط خبرهایی را برمی‌گرداند که روی سایت success شده‌اند.
async function getArticle(slug: string): Promise<Article | null> {
  const db = getPublicClient();
  if (!db) return null;
  const { data, error } = await db
    .from("public_news")
    .select("id, slug, title, body, image_url, source_url, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[news] public_news fetch failed:", error.message);
    return null;
  }
  return (data as Article) ?? null;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return { title: "خبر یافت نشد" };
  }

  const desc = (article.body ?? "").slice(0, 160);
  return {
    title: article.title,
    description: desc,
    openGraph: {
      title: article.title,
      description: desc,
      type: "article",
      ...(article.image_url && { images: [article.image_url] }),
    },
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  // بدنه را به پاراگراف‌ها تقسیم می‌کنیم (هر خط یک پاراگراف).
  const paragraphs = (article.body ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article style={{ paddingBlock: "var(--space-10)" }}>
      <div className="container">
        <div className="article-body">
          {/* Breadcrumb */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "var(--space-6)",
              fontSize: "var(--text-sm)",
              color: "var(--color-muted)",
            }}
          >
            <Link href="/" className="btn btn--ghost" style={{ padding: 0 }}>
              خانه
            </Link>
            <span>›</span>
            <span style={{ color: "var(--color-text-2)" }}>{article.title}</span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: "var(--space-8)" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0.75rem",
                background: "var(--color-primary-glow)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: "9999px",
                fontSize: "var(--text-xs)",
                color: "var(--color-primary)",
                fontWeight: 600,
                marginBottom: "var(--space-4)",
              }}
            >
              ✨ پردازش‌شده با هوش مصنوعی
            </div>

            <h1
              style={{
                fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                fontWeight: 800,
                lineHeight: 1.3,
                marginBottom: "var(--space-4)",
                color: "var(--color-text)",
              }}
            >
              {article.title}
            </h1>

            {/* Meta */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                flexWrap: "wrap",
                marginBottom: "var(--space-5)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
                🕐 {formatDate(article.created_at)}
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
                📰 منبع: باما
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
                📝 {(article.body ?? "").length} کاراکتر
              </span>
            </div>

            {/* Hero Image or placeholder */}
            <div className="article-hero">
              {article.image_url ? (
                <img src={article.image_url} alt={article.title} />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--gradient-hero)",
                    fontSize: "6rem",
                    color: "var(--color-muted-2)",
                  }}
                >
                  🚗
                </div>
              )}
            </div>
          </header>

          {/* Content */}
          <div>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Source Link */}
          {article.source_url && (
            <div
              style={{
                marginTop: "var(--space-6)",
                padding: "var(--space-4)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                fontSize: "var(--text-sm)",
                color: "var(--color-muted)",
              }}
            >
              منبع اصلی:{" "}
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-primary)" }}
              >
                {article.source_url}
              </a>
            </div>
          )}

          {/* Back link */}
          <div style={{ marginTop: "var(--space-8)" }}>
            <Link href="/" className="btn btn--secondary">
              ← بازگشت به صفحهٔ اصلی
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

