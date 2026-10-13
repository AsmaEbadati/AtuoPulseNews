import type { Metadata } from "next";
import Link from "next/link";
import { getPublicClient } from "@/lib/supabase-public";

export const metadata: Metadata = {
  title: "اخبار خودرو",
  description:
    "آخرین اخبار بازار خودرو ایران، پردازش‌شده با هوش مصنوعی و انتشار خودکار",
};

// خواندن اخبار منتشرشده روی سایت از view عمومی public_news (فقط خواندن با anon key)
async function getPublishedArticles() {
  const db = getPublicClient();
  if (!db) return [];
  const { data, error } = await db
    .from("public_news")
    .select("id, slug, title, body, image_url, source_url, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) {
    console.error("[home] public_news fetch failed:", error.message);
    return [];
  }
  return data ?? [];
}

interface Article {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffH < 1) return "چند دقیقه پیش";
  if (diffH < 24) return `${diffH} ساعت پیش`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} روز پیش`;
}

export default async function HomePage() {
  const articles: Article[] = await getPublishedArticles();
  const publishedCount = articles.length;
  // کل انتشارها = هر خبر روی سایت منتشر شده (۱ مقصد در دسترس این view)
  const totalPublished = articles.length;

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero__eyebrow">
            <span>⚡</span>
            <span>پایپ‌لاین هوشمند خبر خودرو</span>
          </div>

          <h1 className="hero__title">
            اخبار خودرو، <span>هوشمند و خودکار</span>
          </h1>

          <p className="hero__subtitle">
            پایش روزانه باما، پردازش با هوش مصنوعی و انتشار همزمان در سه
            پلتفرم — بدون دخالت انسانی
          </p>

          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value">{publishedCount}</div>
              <div className="hero__stat-label">خبر منتشرشده</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">۳</div>
              <div className="hero__stat-label">پلتفرم انتشار</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{totalPublished}</div>
              <div className="hero__stat-label">کل انتشارها</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">۰</div>
              <div className="hero__stat-label">تکرار</div>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {/* Pipeline Status Bar */}
          <div className="pipeline-bar">
            <div className="pipeline-bar__status">
              <div className="pipeline-bar__dot pipeline-bar__dot--active" />
              <div>
                <div className="pipeline-bar__label">سیستم فعال است</div>
                <div className="pipeline-bar__meta">
                  آخرین اجرا: امروز ساعت ۰۸:۰۰
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/dashboard" className="btn btn--secondary">
                📊 داشبورد لاگ‌ها
              </Link>
              <button className="btn btn--primary">▶ اجرای دستی</button>
            </div>
          </div>

          {/* Section Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              آخرین اخبار
            </h2>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-muted)",
              }}
            >
              {articles.length} خبر
            </span>
          </div>

          {/* Articles Grid */}
          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📰</div>
              <div className="empty-state__title">هنوز خبری منتشر نشده</div>
              <div className="empty-state__desc">
                پایپ‌لاین را اجرا کنید تا اخبار باما جمع‌آوری و منتشر شوند.
              </div>
            </div>
          ) : (
            <div className="news-grid">
              {articles.map((article, i) => (
                <Link
                  href={`/news/${article.slug}`}
                  key={article.id}
                  className="news-card animate-fade-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Image */}
                  <div className="news-card__image-wrap">
                    {article.image_url ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="news-card__image"
                      />
                    ) : (
                      <div className="news-card__image-placeholder">🚗</div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <span className="news-card__date">
                        🕐 {formatDate(article.created_at)}
                      </span>
                      <span
                        className="badge badge--success"
                        style={{ fontSize: "10px" }}
                      >
                        AI ✨
                      </span>
                    </div>

                    <h3 className="news-card__title">{article.title}</h3>

                    <p className="news-card__excerpt">
                      {article.body?.slice(0, 150) ?? ""}…
                    </p>

                    <div className="news-card__footer">
                      <span
                        className="badge badge--success"
                        style={{ fontSize: "10px" }}
                      >
                        ✓ منتشرشده
                      </span>
                      <span
                        className="btn btn--ghost"
                        style={{ padding: "0", fontSize: "var(--text-sm)" }}
                      >
                        بیشتر →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
